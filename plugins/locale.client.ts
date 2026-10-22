import {
  LEGACY_LOCALE_COOKIE,
  legacyPickedLocale,
  readPickedLocale,
  resolveLocale,
  savePickedLocale,
} from "~/utilities/locale";

export default defineNuxtPlugin(async () => {
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

  await i18n.setLocale(
    resolveLocale(
      i18n.localeCodes.value,
      navigator.languages,
      readPickedLocale(),
    ) as typeof i18n.locale.value,
  );
});
