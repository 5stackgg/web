import { tryUseNuxtApp } from "#app";

// `toLocale*(undefined, …)` formats using the *browser's* locale, not the app's.
// A player reading the UI in Japanese from an en-US browser still got American
// date formats — which stopped being defensible once all 16 locales were filled
// in. The configured locale codes are already valid BCP-47 tags (en, de,
// zh-Hans, …), so they can be handed straight to Intl.
//
// Returns undefined — i.e. the previous browser-locale behaviour — whenever
// there is no Nuxt context to read from, so this can never throw at render.
export function dateLocale(): string | undefined {
  const locale = (tryUseNuxtApp()?.$i18n as { locale?: unknown } | undefined)
    ?.locale;
  const value =
    typeof locale === "string"
      ? locale
      : (locale as { value?: unknown } | undefined)?.value;

  return typeof value === "string" && value.length > 0 ? value : undefined;
}
