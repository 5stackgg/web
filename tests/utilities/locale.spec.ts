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
    expect(matchBrowserLocale([tag], codes())).toBe(expected);
  });

  it("takes the first language the browser lists that we have", () => {
    expect(matchBrowserLocale(["nl-NL", "zh-TW", "en-US"], codes())).toBe(
      "zh-Hant",
    );
  });

  it("falls back to English when we have none of them", () => {
    expect(resolveLocale(codes(), ["nl-NL", "fi"], null)).toBe("en");
  });

  it("skips a tag the browser mangled", () => {
    expect(matchBrowserLocale(["en_US!", "de-DE"], codes())).toBe("de");
  });
});

describe("a visitor's own pick", () => {
  it("wins over the browser", () => {
    expect(resolveLocale(codes(), ["zh-TW"], "ja")).toBe("ja");
  });

  it("is ignored when it names a language we no longer have", () => {
    expect(resolveLocale(codes(), ["zh-TW"], "lv")).toBe("zh-Hant");
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
