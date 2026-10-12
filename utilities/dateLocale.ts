import { tryUseNuxtApp } from "#app";

export type BrowserClock = {
  locale: string;
  hourCycle: string | undefined;
};

let resolvedCache:
  | { ui: string; browser: string | null; value: string | undefined }
  | undefined;

function uiLocale(): string | undefined {
  const locale = (tryUseNuxtApp()?.$i18n as { locale?: unknown } | undefined)
    ?.locale;
  const value =
    typeof locale === "string"
      ? locale
      : (locale as { value?: unknown } | undefined)?.value;

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// The user's content language, not Intl's default: Firefox resolves the
// default to its own UI language, whatever the user asked pages to use.
function browserLanguage(): string | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  return navigator.languages?.[0] || navigator.language || null;
}

export function browserClock(locale: string | null): BrowserClock | null {
  if (!locale) {
    return null;
  }
  try {
    return {
      locale,
      hourCycle: new Intl.DateTimeFormat(locale, {
        hour: "numeric",
      }).resolvedOptions().hourCycle,
    };
  } catch {
    return null;
  }
}

function sameWritingSystem(a: Intl.Locale, b: Intl.Locale) {
  const left = a.maximize();
  const right = b.maximize();
  return left.language === right.language && left.script === right.script;
}

// Words and order follow the UI language, the 12/24-hour clock follows the
// browser; a browser that speaks the UI language lends its whole region
// (en-GB gets "17 Oct" as well as 21:30).
export function resolveDateLocale(
  ui: string | undefined,
  browser: BrowserClock | null,
): string | undefined {
  if (!ui) {
    return undefined;
  }
  if (!browser?.locale) {
    return ui;
  }
  try {
    const browserLocale = new Intl.Locale(browser.locale);
    const base = sameWritingSystem(new Intl.Locale(ui), browserLocale)
      ? browserLocale
      : new Intl.Locale(ui);
    if (!browser.hourCycle) {
      return base.toString();
    }
    return new Intl.Locale(base, {
      hourCycle: browser.hourCycle as Intl.LocaleHourCycleKey,
    }).toString();
  } catch {
    return ui;
  }
}

export function dateLocale(): string | undefined {
  const ui = uiLocale();
  if (!ui) {
    return undefined;
  }
  const browser = browserLanguage();
  if (resolvedCache?.ui !== ui || resolvedCache.browser !== browser) {
    resolvedCache = {
      ui,
      browser,
      value: resolveDateLocale(ui, browserClock(browser)),
    };
  }
  return resolvedCache.value;
}
