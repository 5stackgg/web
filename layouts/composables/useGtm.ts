import { watch, onMounted } from "vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { afterReveal } from "~/utilities/afterReveal";

// GTM costs ~320ms of main thread on a mid-range device -- more than our own
// entry chunk's compile+eval. It has nothing to do with first render, so it
// waits for the app to actually be on screen before it goes anywhere near the
// main thread.
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
