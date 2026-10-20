import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TimeAgo from "~/components/TimeAgo.vue";

const i18n = () => (useNuxtApp() as any).$i18n;

let unmount: (() => void) | null = null;

afterEach(async () => {
  unmount?.();
  unmount = null;
  await i18n().setLocale("en");
});

async function mountFiveMinutesAgo() {
  const wrapper = await mountSuspended(TimeAgo, {
    props: { date: new Date(Date.now() - 5 * 60 * 1000), hideIcon: true },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("TimeAgo", () => {
  it.each([
    ["de", "vor 5 Minuten"],
    ["pt", "há 5 minutos"],
    ["zh-Hans", "5分钟前"],
    ["zh-Hant", "5 分鐘前"],
  ])("says how long ago in %s", async (locale, text) => {
    await i18n().setLocale(locale);

    const wrapper = await mountFiveMinutesAgo();

    await vi.waitFor(() => expect(wrapper.text()).toBe(text));
  });

  it("follows a switch of language without a remount", async () => {
    const wrapper = await mountFiveMinutesAgo();
    expect(wrapper.text()).toBe("5 minutes ago");

    await i18n().setLocale("ja");
    await vi.waitFor(() => expect(wrapper.text()).toBe("5 分前"));

    await i18n().setLocale("en");
    await vi.waitFor(() => expect(wrapper.text()).toBe("5 minutes ago"));
  });
});
