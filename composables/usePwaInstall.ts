import { computed, onBeforeUnmount, onMounted, ref } from "vue";

// One source of truth for "is this the installed app?", because push
// notifications are now gated on it everywhere -- the settings toggle, the
// enable prompt, and the install button itself all have to agree.

export function isIosBrowser(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
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
  const installedHere = ref(false);

  const installed = computed(
    () =>
      installedHere.value || Boolean($pwa?.isPWAInstalled) || isStandalone(),
  );

  const canInstall = computed(() => {
    if (installed.value) {
      return false;
    }

    // iOS has no beforeinstallprompt at all -- Add to Home Screen is manual,
    // so the instructions are always worth offering.
    if (isIosBrowser()) {
      return true;
    }

    // beforeinstallprompt fires once, shortly after load, usually before a
    // component that wanted to listen for it has mounted. The vite-pwa plugin
    // captures it at app init and exposes it reactively.
    return $pwa?.showInstallPrompt === true;
  });

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
    install: () => $pwa?.install(),
  };
}
