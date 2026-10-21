import { afterEach, describe, expect, it } from "vitest";
import compactDuration, {
  durationUnit,
  unitFormatter,
} from "~/utilities/compactDuration";
import { pinBrowserLocale } from "../helpers/browserLocale";

pinBrowserLocale("en-US");

const i18n = () =>
  useNuxtApp().$i18n as unknown as { locale: { value: string } };

afterEach(() => {
  i18n().locale.value = "en";
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function inLocale<T>(locale: string, read: () => T) {
  i18n().locale.value = locale;
  return read();
}

describe("compactDuration", () => {
  it.each([
    ["en", ["45s", "6m", "3h", "2d"]],
    ["de", ["45 Sek.", "6 Min.", "3h", "2 T"]],
  ])("names only the largest unit in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        [
          45 * SECOND,
          6 * MINUTE + 5 * SECOND,
          3 * HOUR + 4 * MINUTE,
          2 * DAY + 3 * HOUR,
        ].map((ms) => compactDuration(ms)),
      ),
    ).toEqual(expected);
  });

  it.each([
    ["en", ["45s", "3m 05s", "2h 03m"]],
    ["de", ["45 Sek.", "3 Min. 05 Sek.", "2h 03 Min."]],
  ])("adds the next unit down, padded, in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        [45 * SECOND, 3 * MINUTE + 5 * SECOND, 2 * HOUR + 3 * MINUTE].map(
          (ms) => compactDuration(ms, { largest: "hour", parts: 2, pad: true }),
        ),
      ),
    ).toEqual(expected);
  });

  it.each([
    ["en", ["45s", "3m 5s", "1h 0m"]],
    ["de", ["45 Sek.", "3 Min. 5 Sek.", "1h 0 Min."]],
  ])("adds the next unit down as it is in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        [45 * SECOND, 3 * MINUTE + 5 * SECOND, HOUR + 20 * SECOND].map((ms) =>
          compactDuration(ms, { largest: "hour", parts: 2 }),
        ),
      ),
    ).toEqual(expected);
  });

  it.each([
    ["en", ["0m", "95m"]],
    ["de", ["0 Min.", "95 Min."]],
  ])("counts in minutes alone in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        [-5 * MINUTE, 95 * MINUTE + 30 * SECOND].map((ms) =>
          compactDuration(ms, { largest: "minute", smallest: "minute" }),
        ),
      ),
    ).toEqual(expected);
  });

  it("follows a switch of language", () => {
    expect(inLocale("en", () => compactDuration(5 * MINUTE))).toBe("5m");
    expect(inLocale("fr", () => compactDuration(3 * DAY))).toBe("3j");
    expect(inLocale("ru", () => compactDuration(5 * MINUTE))).toBe("5 мин");
  });

  it.each([
    ["en", "4.20s"],
    ["de", "4,20 Sek."],
  ])("keeps the fraction digits it is given in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        durationUnit(4.2, "second", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      ),
    ).toBe(expected);
  });
});

describe("durationUnit", () => {
  it.each([
    ["en", ["1000s", "1440m"]],
    ["de", ["1000 Sek.", "1440 Min."]],
  ])("never groups the digits in %s", (locale, expected) => {
    expect(
      inLocale(locale, () => [
        durationUnit(1000, "second"),
        compactDuration(1440 * MINUTE, {
          largest: "minute",
          smallest: "minute",
        }),
      ]),
    ).toEqual(expected);
  });

  it("builds each formatter once for its language, unit and options", () => {
    const minute = unitFormatter("minute");

    expect(unitFormatter("minute")).toBe(minute);
    expect(unitFormatter("second")).not.toBe(minute);
    expect(unitFormatter("minute", { minimumIntegerDigits: 2 })).toBe(
      unitFormatter("minute", { minimumIntegerDigits: 2 }),
    );
    expect(unitFormatter("minute", { minimumIntegerDigits: 2 })).not.toBe(
      minute,
    );
    expect(inLocale("de", () => unitFormatter("minute"))).not.toBe(minute);
    expect(inLocale("en", () => unitFormatter("minute"))).toBe(minute);
  });
});
