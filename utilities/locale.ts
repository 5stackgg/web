const PICKED_LOCALE_KEY = "5stack:locale";

export const LEGACY_LOCALE_COOKIE = "i18n_redirected";

export function readPickedLocale(): string | null {
  try {
    return localStorage.getItem(PICKED_LOCALE_KEY);
  } catch {
    return null;
  }
}

export function savePickedLocale(code: string) {
  try {
    localStorage.setItem(PICKED_LOCALE_KEY, code);
  } catch {}
}

function findCode(codes: readonly string[], tag: string) {
  return codes.find((code) => code.toLowerCase() === tag.toLowerCase());
}

// Browsers send a region (zh-TW, zh-HK), never the script our Chinese locales
// are named by; maximize() supplies the script that region writes in.
export function matchBrowserLocale(
  tag: string | null | undefined,
  codes: readonly string[],
): string | undefined {
  if (!tag) {
    return;
  }

  let locale: Intl.Locale;
  try {
    locale = new Intl.Locale(tag).maximize();
  } catch {
    return;
  }

  return (
    findCode(codes, tag) ??
    findCode(codes, `${locale.language}-${locale.script}`) ??
    findCode(codes, locale.language)
  );
}

// Only the browser's first language counts. The rest of its list is usually
// English added as a fallback, which would beat the site default for nearly
// every visitor.
export function resolveLocale(
  codes: readonly string[],
  browserLanguage: string | null,
  picked: string | null,
  siteDefault?: string | null,
): string {
  if (picked && codes.includes(picked)) {
    return picked;
  }
  const browser = matchBrowserLocale(browserLanguage, codes);
  if (browser) {
    return browser;
  }
  if (siteDefault && codes.includes(siteDefault)) {
    return siteDefault;
  }
  return "en";
}

// The old cookie was written on every first visit, so it holds the browser
// guess as often as a real pick. Only a value that guess wouldn't have made is
// known to be the visitor's own choice.
export function legacyPickedLocale(
  cookie: string | null | undefined,
  oldGuess: string,
): string | null {
  return cookie && cookie !== oldGuess ? cookie : null;
}
