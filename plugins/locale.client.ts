import { watch } from "vue";
import {
  cachedSetting,
  useApplicationSettingsStore,
} from "~/stores/ApplicationSettings";
import { browserLanguage } from "~/utilities/dateLocale";
import {
  LEGACY_LOCALE_COOKIE,
  legacyPickedLocale,
  readPickedLocale,
  resolveLocale,
  savePickedLocale,
} from "~/utilities/locale";

export default defineNuxtPlugin(async (nuxtApp) => {
  const i18n = useNuxtApp().$i18n;

  const legacy = useCookie<string | null>(LEGACY_LOCALE_COOKIE);
  if (legacy.value) {
    const picked = legacyPickedLocale(
      legacy.value,
      i18n.getBrowserLocale() || "en",
    );
    if (picked && !readPickedLocale()) {
      savePickedLocale(picked);
    }
    legacy.value = null;
  }

  const resolve = (siteDefault?: string | null) =>
    resolveLocale(
      i18n.localeCodes.value,
      browserLanguage(),
      readPickedLocale(),
      siteDefault,
    ) as typeof i18n.locale.value;

  await i18n.setLocale(resolve(cachedSetting("public.default_language")));

  nuxtApp.hook("app:mounted", () => {
    watch(
      () => useApplicationSettingsStore().defaultLanguage,
      (siteDefault) => {
        const locale = resolve(siteDefault);
        if (locale !== i18n.locale.value) {
          i18n.setLocale(locale);
        }
      },
      { immediate: true },
    );
  });
});
