import { computed, watch } from "vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const lightColorMap: Record<string, string> = {
  // Core
  "public.color_background": "--background",
  "public.color_foreground": "--foreground",
  "public.color_primary": "--primary",
  "public.color_primary_foreground": "--primary-foreground",
  "public.color_secondary": "--secondary",
  "public.color_secondary_foreground": "--secondary-foreground",
  "public.color_accent": "--accent",
  "public.color_accent_foreground": "--accent-foreground",
  "public.color_muted": "--muted",
  "public.color_muted_foreground": "--muted-foreground",
  "public.color_destructive": "--destructive",
  // Cards & Borders
  "public.color_card": "--card",
  "public.color_card_foreground": "--card-foreground",
  "public.color_border": "--border",
  // Sidebar
  "public.color_sidebar_background": "--sidebar-background",
  "public.color_sidebar_foreground": "--sidebar-foreground",
  "public.color_sidebar_accent": "--sidebar-accent",
  "public.color_sidebar_accent_foreground": "--sidebar-accent-foreground",
  "public.color_sidebar_border": "--sidebar-border",
};

const darkColorMap: Record<string, string> = {
  // Core
  "public.color_dark_background": "--background",
  "public.color_dark_foreground": "--foreground",
  "public.color_dark_primary": "--primary",
  "public.color_dark_primary_foreground": "--primary-foreground",
  "public.color_dark_secondary": "--secondary",
  "public.color_dark_secondary_foreground": "--secondary-foreground",
  "public.color_dark_accent": "--accent",
  "public.color_dark_accent_foreground": "--accent-foreground",
  "public.color_dark_muted": "--muted",
  "public.color_dark_muted_foreground": "--muted-foreground",
  "public.color_dark_destructive": "--destructive",
  // Cards & Borders
  "public.color_dark_card": "--card",
  "public.color_dark_card_foreground": "--card-foreground",
  "public.color_dark_border": "--border",
  // Sidebar
  "public.color_dark_sidebar_background": "--sidebar-background",
  "public.color_dark_sidebar_foreground": "--sidebar-foreground",
  "public.color_dark_sidebar_accent": "--sidebar-accent",
  "public.color_dark_sidebar_accent_foreground": "--sidebar-accent-foreground",
  "public.color_dark_sidebar_border": "--sidebar-border",
};

export function useBranding() {
  const store = useApplicationSettingsStore();
  const colorMode = useColorMode();

  const brandName = computed(() => {
    return store.settings.find(
      (s: { name: string }) => s.name === "public.brand_name",
    )?.value;
  });

  const logoUrl = computed(() => {
    const setting = store.settings.find(
      (s: { name: string }) => s.name === "public.logo_url",
    );
    if (setting?.value) {
      return `https://${useRuntimeConfig().public.apiDomain}/branding/logo`;
    }
    return null;
  });

  // Apply custom CSS variables based on color mode
  watch(
    [() => store.settings, () => colorMode.value],
    () => {
      const isDark = colorMode.value === "dark";
      const map = isDark ? darkColorMap : lightColorMap;

      for (const [settingKey, cssVar] of Object.entries(map)) {
        const setting = store.settings.find(
          (s: { name: string }) => s.name === settingKey,
        );
        if (setting?.value) {
          document.documentElement.style.setProperty(cssVar, setting.value);
        } else {
          document.documentElement.style.removeProperty(cssVar);
        }
      }
    },
    { immediate: true, deep: true },
  );

  // Update favicon when setting changes
  watch(
    () => store.settings,
    () => {
      const faviconSetting = store.settings.find(
        (s: { name: string }) => s.name === "public.favicon_url",
      );
      if (faviconSetting?.value) {
        const link = document.querySelector(
          "link[rel='icon']",
        ) as HTMLLinkElement;
        if (link) {
          link.href = `https://${useRuntimeConfig().public.apiDomain}/branding/favicon`;
        }
      }
    },
    { immediate: true, deep: true },
  );

  // Update document title when brand name changes
  watch(
    () => store.settings,
    () => {
      const brandSetting = store.settings.find(
        (s: { name: string }) => s.name === "public.brand_name",
      );
      if (brandSetting?.value) {
        document.title = `${brandSetting.value} | Counter-Strike Management System`;
      }
    },
    { immediate: true, deep: true },
  );

  return { brandName, logoUrl };
}
