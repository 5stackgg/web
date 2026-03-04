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
  "public.color_destructive_foreground": "--destructive-foreground",
  "public.color_warning": "--warning",
  "public.color_warning_foreground": "--warning-foreground",
  // Cards & Borders
  "public.color_card": "--card",
  "public.color_card_foreground": "--card-foreground",
  "public.color_border": "--border",
  "public.color_popover": "--popover",
  "public.color_popover_foreground": "--popover-foreground",
  "public.color_input": "--input",
  "public.color_ring": "--ring",
  // Sidebar
  "public.color_sidebar_background": "--sidebar-background",
  "public.color_sidebar_foreground": "--sidebar-foreground",
  "public.color_sidebar_accent": "--sidebar-accent",
  "public.color_sidebar_accent_foreground": "--sidebar-accent-foreground",
  "public.color_sidebar_border": "--sidebar-border",
  "public.color_sidebar_primary": "--sidebar-primary",
  "public.color_sidebar_primary_foreground": "--sidebar-primary-foreground",
  "public.color_sidebar_ring": "--sidebar-ring",
  // Top Nav
  "public.color_topnav_background": "--topnav-background",
  "public.color_topnav_foreground": "--topnav-foreground",
  "public.color_topnav_accent": "--topnav-accent",
  "public.color_topnav_accent_foreground": "--topnav-accent-foreground",
  "public.color_topnav_border": "--topnav-border",
  "public.color_topnav_primary": "--topnav-primary",
  "public.color_topnav_primary_foreground": "--topnav-primary-foreground",
  "public.color_topnav_ring": "--topnav-ring",
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
  "public.color_dark_destructive_foreground": "--destructive-foreground",
  "public.color_dark_warning": "--warning",
  "public.color_dark_warning_foreground": "--warning-foreground",
  // Cards & Borders
  "public.color_dark_card": "--card",
  "public.color_dark_card_foreground": "--card-foreground",
  "public.color_dark_border": "--border",
  "public.color_dark_popover": "--popover",
  "public.color_dark_popover_foreground": "--popover-foreground",
  "public.color_dark_input": "--input",
  "public.color_dark_ring": "--ring",
  // Sidebar
  "public.color_dark_sidebar_background": "--sidebar-background",
  "public.color_dark_sidebar_foreground": "--sidebar-foreground",
  "public.color_dark_sidebar_accent": "--sidebar-accent",
  "public.color_dark_sidebar_accent_foreground": "--sidebar-accent-foreground",
  "public.color_dark_sidebar_border": "--sidebar-border",
  "public.color_dark_sidebar_primary": "--sidebar-primary",
  "public.color_dark_sidebar_primary_foreground":
    "--sidebar-primary-foreground",
  "public.color_dark_sidebar_ring": "--sidebar-ring",
  // Top Nav
  "public.color_dark_topnav_background": "--topnav-background",
  "public.color_dark_topnav_foreground": "--topnav-foreground",
  "public.color_dark_topnav_accent": "--topnav-accent",
  "public.color_dark_topnav_accent_foreground": "--topnav-accent-foreground",
  "public.color_dark_topnav_border": "--topnav-border",
  "public.color_dark_topnav_primary": "--topnav-primary",
  "public.color_dark_topnav_primary_foreground": "--topnav-primary-foreground",
  "public.color_dark_topnav_ring": "--topnav-ring",
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

      // Handle border radius (not a color, it's a rem value)
      const radiusSetting = store.settings.find(
        (s: { name: string }) => s.name === "public.border_radius",
      );
      if (radiusSetting?.value) {
        document.documentElement.style.setProperty(
          "--radius",
          radiusSetting.value,
        );
      } else {
        document.documentElement.style.removeProperty("--radius");
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

  const loginFooterText = computed(() => {
    return store.settings.find(
      (s: { name: string }) => s.name === "public.login_footer_text",
    )?.value;
  });

  const loginFooterUrl = computed(() => {
    return store.settings.find(
      (s: { name: string }) => s.name === "public.login_footer_url",
    )?.value;
  });

  const loginShowFooter = computed(() => {
    return (
      store.settings.find(
        (s: { name: string; value: string | null }) =>
          s.name === "public.login_show_footer",
      )?.value !== "false"
    );
  });

  return {
    brandName,
    logoUrl,
    loginFooterText,
    loginFooterUrl,
    loginShowFooter,
  };
}
