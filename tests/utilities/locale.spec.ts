import { afterEach, describe, expect, it } from "vitest";
import {
  legacyPickedLocale,
  matchBrowserLocale,
  resolveLocale,
} from "~/utilities/locale";
import {
  resetBrowserLanguages,
  setBrowserLanguages,
} from "../helpers/browserLocale";

const i18n = () =>
  useNuxtApp().$i18n as unknown as {
    localeCodes: { value: string[] };
    getBrowserLocale: () => string | undefined;
  };

const codes = () => i18n().localeCodes.value;

afterEach(resetBrowserLanguages);

describe("the language a browser is shown", () => {
  it.each([
    ["zh-TW", "zh-Hant"],
    ["zh-HK", "zh-Hant"],
    ["zh-MO", "zh-Hant"],
    ["zh-Hant-TW", "zh-Hant"],
    ["zh-CN", "zh-Hans"],
    ["zh-SG", "zh-Hans"],
    ["zh", "zh-Hans"],
    ["pt-BR", "pt"],
    ["pt-PT", "pt"],
    ["en-US", "en"],
    ["de", "de"],
  ])("%s gets %s", (tag, expected) => {
    expect(matchBrowserLocale(tag, codes())).toBe(expected);
  });

  it("falls back to English when we don't have it", () => {
    expect(resolveLocale(codes(), "nl-NL", null)).toBe("en");
  });

  it("matches nothing for a tag the browser mangled", () => {
    expect(matchBrowserLocale("en_US!", codes())).toBeUndefined();
  });
});

describe("the site's default language", () => {
  it("is shown when we don't have the browser's language", () => {
    expect(resolveLocale(codes(), "nl-NL", null, "pt")).toBe("pt");
  });

  it("is English when none is set", () => {
    expect(resolveLocale(codes(), "nl-NL", null, undefined)).toBe("en");
  });

  it("gives way to a browser language we have", () => {
    expect(resolveLocale(codes(), "de-DE", null, "pt")).toBe("de");
  });

  it("falls back to English when it names a language we don't have", () => {
    expect(resolveLocale(codes(), "nl-NL", null, "lv")).toBe("en");
  });
});

describe("a visitor's own pick", () => {
  it("wins over the browser", () => {
    expect(resolveLocale(codes(), "zh-TW", "ja")).toBe("ja");
  });

  it("wins over the site's default", () => {
    expect(resolveLocale(codes(), "nl-NL", "ja", "pt")).toBe("ja");
  });

  it("is ignored when it names a language we no longer have", () => {
    expect(resolveLocale(codes(), "zh-TW", "lv")).toBe("zh-Hant");
  });
});

describe("the old i18n_redirected cookie", () => {
  it("is not a pick when it holds the guess the old detection made", () => {
    setBrowserLanguages(["zh-TW"]);
    const oldGuess = i18n().getBrowserLocale() || "en";

    expect(legacyPickedLocale("zh-Hans", oldGuess)).toBeNull();
  });

  it("is a pick when it differs from that guess", () => {
    setBrowserLanguages(["en-US"]);
    const oldGuess = i18n().getBrowserLocale() || "en";

    expect(legacyPickedLocale("de", oldGuess)).toBe("de");
  });

  it("is not a pick when it holds the English fallback", () => {
    setBrowserLanguages(["nl-NL"]);
    const oldGuess = i18n().getBrowserLocale() || "en";

    expect(legacyPickedLocale("en", oldGuess)).toBeNull();
  });
});
