import { watch, onMounted } from "vue";
import { useApplicationSettingsStore } from "~/stores/applicationSettings";

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

    const dataLayerParam = "dataLayer" !== "dataLayer" ? "&l=dataLayer" : "";
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId.trim()}${dataLayerParam}`;

    document.head.appendChild(script);
  };

  watch(
    getGtmCode,
    (newVal) => {
      if (newVal) loadGtm(newVal);
    },
    { immediate: true },
  );

  onMounted(() => {
    const gtmId = getGtmCode();
    if (gtmId) {
      loadGtm(gtmId);
    }
  });
}
