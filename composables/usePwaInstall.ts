import { computed, onBeforeUnmount, onMounted, ref } from "vue";

// One source of truth for "is this the installed app?", because push
// notifications are now gated on it everywhere -- the settings toggle, the
// enable prompt, and the install button itself all have to agree.

export type ManualInstallPlatform = "ios" | "android" | "in_app";

export function isIosBrowser(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
}

export function isAndroidBrowser(): boolean {
  return (
    typeof navigator !== "undefined" && /Android/.test(navigator.userAgent)
  );
}

// "; wv)" marks Android's WebView (in-app browsers), where nothing can install.
export function isAndroidWebView(): boolean {
  return isAndroidBrowser() && /; wv\)/.test(navigator.userAgent);
}

// $pwa.isPWAInstalled only checks the display-mode media query, which iOS
// Safari never sets -- navigator.standalone is the only honest answer there.
export function isStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true || window.matchMedia("(display-mode: standalone)").matches
  );
}

export function usePwaInstall() {
  const { $pwa } = useNuxtApp();

  // Installing from a browser tab can't flip the checks above: the browser
  // opens the installed app in its own window and leaves this one a plain tab.
  // `appinstalled` is the only signal this side ever gets, and it matters --
  // the tab and the installed app share one service worker registration, so a
  // subscription made here is the same one the app will use.
  const installedHere = useState("pwa-installed-here", () => false);

  const showInstructions = ref(false);

  const installed = computed(
    () =>
      installedHere.value || Boolean($pwa?.isPWAInstalled) || isStandalone(),
  );

  const hasNativePrompt = computed(
    () => !installed.value && $pwa?.showInstallPrompt === true,
  );

  const manualInstall = computed<ManualInstallPlatform | null>(() => {
    if (installed.value) {
      return null;
    }

    // iOS has no beforeinstallprompt at all -- Add to Home Screen is manual,
    // so the instructions are always worth offering.
    if (isIosBrowser()) {
      return "ios";
    }

    // beforeinstallprompt fires once, shortly after load, usually before a
    // component that wanted to listen for it has mounted. The vite-pwa plugin
    // captures it at app init and exposes it reactively.
    if (hasNativePrompt.value) {
      return null;
    }

    // Android falls back to browser-menu steps; desktop deliberately gets none.
    if (isAndroidWebView()) {
      return "in_app";
    }

    if (isAndroidBrowser()) {
      return "android";
    }

    return null;
  });

  const canInstall = computed(
    () => hasNativePrompt.value || manualInstall.value !== null,
  );

  async function install() {
    if (manualInstall.value) {
      showInstructions.value = true;
      return;
    }

    const choice = await $pwa?.install();

    // Don't wait for appinstalled: it lands after Android builds the app.
    if (choice?.outcome === "accepted") {
      installedHere.value = true;
    }
  }

  function onAppInstalled() {
    installedHere.value = true;
  }

  onMounted(() => {
    window.addEventListener("appinstalled", onAppInstalled);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("appinstalled", onAppInstalled);
  });

  return {
    installed,
    canInstall,
    manualInstall,
    showInstructions,
    install,
  };
}
