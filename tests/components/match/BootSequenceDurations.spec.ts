import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import BootSequence from "~/components/match/BootSequence.vue";
import { pinBrowserLocale } from "../../helpers/browserLocale";

pinBrowserLocale("en-US");

const i18n = () => (useNuxtApp() as any).$i18n;

const BOOTED = Date.parse("2026-10-21T12:00:00Z");
const at = (seconds: number) => new Date(BOOTED + seconds * 1000).toISOString();

let unmount: (() => void) | null = null;

afterEach(async () => {
  unmount?.();
  unmount = null;
  vi.useRealTimers();
  await i18n().setLocale("en");
});

async function mountBoot() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOTED + 230 * 1000);

  const wrapper = await mountSuspended(BootSequence, {
    props: {
      mode: "live",
      histories: [
        [
          { status: "booting", at: at(0) },
          { status: "launching_steam", at: at(185) },
        ],
      ],
      status: "launching_steam",
    },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

const stageTimes = (wrapper: any) =>
  wrapper
    .findAll("li span.tabular-nums")
    .map((span: any) => span.text())
    .filter(Boolean);

describe("BootSequence", () => {
  it.each([
    ["en", ["3m 05s", "45s"]],
    ["de", ["3 Min. 05 Sek.", "45 Sek."]],
  ])("times its stages in %s", async (locale, expected) => {
    await i18n().setLocale(locale);

    const wrapper = await mountBoot();

    expect(stageTimes(wrapper)).toEqual(expected);
  });
});
