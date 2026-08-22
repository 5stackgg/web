import { watch, onMounted } from "vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

// GTM costs ~320ms of main thread on a mid-range device -- more than our own
// entry chunk's compile+eval. It has nothing to do with first render, so it
// waits for the app to actually be on screen before it goes anywhere near the
// main thread.
//
// requestIdleCallback alone is NOT enough here: boot is full of idle gaps while
// chunks and GraphQL are in flight, so rIC fires *during* the boot -- measured
// at 828ms against a 979ms reveal. The pre-loader overlay coming down is the
// real signal (plugins/preloader.client.ts removes the `pre-loader` class once
// the root Suspense has resolved), so gate on that and only then ask for idle.
function afterReveal(run: () => void) {
  if (typeof window === "undefined") {
    return;
  }

  let scheduled = false;

  const idle = () => {
    if (scheduled) {
      return;
    }
    scheduled = true;

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 5000 });
      return;
    }

    setTimeout(run, 1000);
  };

  // Already revealed -- a client-side navigation, or the overlay is long gone.
  if (!document.body.classList.contains("pre-loader")) {
    idle();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.body.classList.contains("pre-loader")) {
      observer.disconnect();
      idle();
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // Never strand the tag if the overlay ever stops being torn down.
  setTimeout(() => {
    observer.disconnect();
    idle();
  }, 10000);
}

export function useGtm() {
  const settingsStore = useApplicationSettingsStore();

  const getGtmCode = () =>
    settingsStore.settings.find(
      (setting) => setting.name === "public.google_tagmanager_code",
    )?.value;

  const loadGtm = (gtmId: string) => {
    if (!gtmId || document.getElementById("gtm-script")) {
      return;
    }

    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js",
    });

    const script = document.createElement("script");
    script.id = "gtm-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId.trim()}`;

    document.head.appendChild(script);
  };

  const queueGtm = (gtmId?: string) => {
    if (!gtmId || document.getElementById("gtm-script")) {
      return;
    }

    afterReveal(() => loadGtm(gtmId));
  };

  watch(getGtmCode, (newVal) => queueGtm(newVal), { immediate: true });

  onMounted(() => queueGtm(getGtmCode()));
}
