import { afterEach, describe, expect, it } from "vitest";
import {
  browserClock,
  dateLocale,
  resolveDateLocale,
} from "~/utilities/dateLocale";
import {
  resetBrowserLanguages,
  setBrowserLanguages,
} from "../helpers/browserLocale";

const matchStart = new Date("2026-10-17T21:30:00Z");

function format(locale: string | undefined) {
  return matchStart.toLocaleString(locale, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

describe("resolveDateLocale", () => {
  it("keeps the American format for an en-US browser reading English", () => {
    const locale = resolveDateLocale("en", {
      locale: "en-US",
      hourCycle: "h12",
    });

    expect(format(locale)).toBe("Sat, Oct 17, 9:30 PM");
  });

  it("uses the whole browser locale when it speaks the UI language", () => {
    const locale = resolveDateLocale("en", {
      locale: "en-GB",
      hourCycle: "h23",
    });

    expect(format(locale)).toBe("Sat 17 Oct, 21:30");
  });

  it("keeps English words but takes the 24-hour clock from a German browser", () => {
    const locale = resolveDateLocale("en", {
      locale: "de-DE",
      hourCycle: "h23",
    });

    expect(format(locale)).toBe("Sat, Oct 17, 21:30");
  });

  it("gives a German UI the 12-hour clock of an American browser", () => {
    const locale = resolveDateLocale("de", {
      locale: "en-US",
      hourCycle: "h12",
    });

    expect(format(locale)).toBe(format("de").replace("21:30", "9:30 PM"));
  });

  it("does not borrow a region whose script differs from the UI's", () => {
    const locale = resolveDateLocale("zh-Hans", {
      locale: "zh-TW",
      hourCycle: "h12",
    });

    expect(locale).toBe("zh-Hans-u-hc-h12");
  });

  it("keeps the UI language's number separators", () => {
    const locale = resolveDateLocale("en", {
      locale: "de-DE",
      hourCycle: "h23",
    });

    expect(new Intl.NumberFormat(locale).format(1234.5)).toBe("1,234.5");
  });

  it("falls back to the UI language when the browser reports nothing", () => {
    expect(resolveDateLocale("en", null)).toBe("en");
    expect(resolveDateLocale("en", { locale: "", hourCycle: undefined })).toBe(
      "en",
    );
  });

  it("falls back to the UI language when the browser locale is unreadable", () => {
    expect(
      resolveDateLocale("en", { locale: "not a locale", hourCycle: "h23" }),
    ).toBe("en");
  });

  it("falls back to the browser's own locale when there is no UI language", () => {
    expect(
      resolveDateLocale(undefined, { locale: "en-GB", hourCycle: "h23" }),
    ).toBeUndefined();
  });
});

describe("browserClock", () => {
  it("reads the hour cycle of the browser's language", () => {
    expect(browserClock("en-US")).toEqual({
      locale: "en-US",
      hourCycle: "h12",
    });
    expect(browserClock("en-GB")).toEqual({
      locale: "en-GB",
      hourCycle: "h23",
    });
  });

  it("has nothing to lend without a readable language", () => {
    expect(browserClock(null)).toBeNull();
    expect(browserClock("not a locale")).toBeNull();
  });
});

describe("dateLocale", () => {
  const i18n = () =>
    useNuxtApp().$i18n as unknown as { locale: { value: string } };

  afterEach(() => {
    resetBrowserLanguages();
    i18n().locale.value = "en";
  });

  // One of the two differs from whatever Intl's own default is on the host,
  // so this fails if the browser's language list is not what is read.
  it("takes the region and clock from the browser's first language", () => {
    setBrowserLanguages(["en-GB", "en-US"]);
    expect(format(dateLocale())).toBe("Sat 17 Oct, 21:30");

    setBrowserLanguages(["en-US", "en-GB"]);
    expect(format(dateLocale())).toBe("Sat, Oct 17, 9:30 PM");
  });

  it("keeps the UI language and takes only the clock from another language", () => {
    setBrowserLanguages(["de-DE"]);

    expect(format(dateLocale())).toBe("Sat, Oct 17, 21:30");
  });

  it("falls back to navigator.language when the language list is empty", () => {
    setBrowserLanguages([], "en-GB");

    expect(format(dateLocale())).toBe("Sat 17 Oct, 21:30");
  });

  it("follows a switch of the UI language", () => {
    setBrowserLanguages(["en-US"]);
    expect(format(dateLocale())).toBe("Sat, Oct 17, 9:30 PM");

    i18n().locale.value = "de";

    expect(format(dateLocale())).toBe("Sa., 17. Okt., 9:30 PM");
  });
});
