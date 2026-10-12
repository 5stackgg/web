import { afterEach, beforeEach } from "vitest";

// dateLocale() lends dates the browser's region and clock, read from
// navigator.languages. Formatted dates in a spec depend on it.
export function setBrowserLanguages(
  languages: string[],
  language = languages[0] ?? "",
) {
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    get: () => languages,
  });
  Object.defineProperty(navigator, "language", {
    configurable: true,
    get: () => language,
  });
}

export function resetBrowserLanguages() {
  delete (navigator as { languages?: unknown }).languages;
  delete (navigator as { language?: unknown }).language;
}

export function pinBrowserLocale(...languages: string[]) {
  beforeEach(() => setBrowserLanguages(languages));
  afterEach(resetBrowserLanguages);
}
