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
  browserTags: readonly string[],
  codes: readonly string[],
): string | undefined {
  for (const tag of browserTags) {
    let locale: Intl.Locale;
    try {
      locale = new Intl.Locale(tag).maximize();
    } catch {
      continue;
    }

    const code =
      findCode(codes, tag) ??
      findCode(codes, `${locale.language}-${locale.script}`) ??
      findCode(codes, locale.language);
    if (code) {
      return code;
    }
  }
}

export function resolveLocale(
  codes: readonly string[],
  browserTags: readonly string[],
  picked: string | null,
): string {
  if (picked && codes.includes(picked)) {
    return picked;
  }
  return matchBrowserLocale(browserTags, codes) ?? "en";
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
