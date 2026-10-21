import { afterEach, describe, expect, it } from "vitest";
import {
  renderLength,
  since,
} from "~/components/render-queue/renderQueueDisplay";
import { formatDuration } from "~/components/database/dbHealth";
import { formatElapsed } from "~/components/gpu-nodes/gpuSessions";
import { formatDuration as buildDuration } from "~/types/cs2Build";
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

describe("the render queue's ages", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");

  it.each([
    ["en", ["45s", "6m", "1h 04m", "3d"]],
    ["de", ["45 Sek.", "6 Min.", "1h 04 Min.", "3 T"]],
  ])("reads in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        [45 * SECOND, 6 * MINUTE, HOUR + 4 * MINUTE, 3 * DAY + HOUR].map(
          (ago) => since(now - ago, now),
        ),
      ),
    ).toEqual(expected);
  });

  it.each([
    ["en", "20s"],
    ["de", "20 Sek."],
  ])("gives a render's length in %s", (locale, expected) => {
    expect(inLocale(locale, () => renderLength(19_600))).toBe(expected);
    expect(renderLength(null)).toBeNull();
  });
});

describe("the database explorer's durations", () => {
  it.each([
    ["en", ["4.20s", "12.3s", "3m 05s", "2h 03m"]],
    ["de", ["4,20 Sek.", "12,3 Sek.", "3 Min. 05 Sek.", "2h 03 Min."]],
  ])("read in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        [4.2, 12.34, 185, 7380].map((seconds) => formatDuration(seconds)),
      ),
    ).toEqual(expected);
  });
});

describe("the GPU nodes page's elapsed times", () => {
  it.each([
    ["en", ["<1m", "41m", "1h 3m"]],
    ["de", ["<1 Min.", "41 Min.", "1h 3 Min."]],
  ])("read in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        [20 * SECOND, 41 * MINUTE, 63 * MINUTE].map((ms) => formatElapsed(ms)),
      ),
    ).toEqual(expected);
  });
});

describe("the CS2 build card's run times", () => {
  it.each([
    ["en", ["42s", "12m 40s", "2h 1m"]],
    ["de", ["42 Sek.", "12 Min. 40 Sek.", "2h 1 Min."]],
  ])("read in %s", (locale, expected) => {
    expect(
      inLocale(locale, () =>
        [42, 760, 7260].map((seconds) => buildDuration(seconds)),
      ),
    ).toEqual(expected);
  });
});
