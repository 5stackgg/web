import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerTwitchLink from "~/components/player/PlayerTwitchLink.vue";
import PlayerTwitchWatchCard from "~/components/player/PlayerTwitchWatchCard.vue";

const STARTED = new Date("2026-10-14T10:00:00Z");

const live = {
  steam_id: "76561198000000002",
  login: "kappa_cs",
  display_name: "Kappa_CS",
  is_live: true,
  title: "FACEIT grind then scrims w/ Northwind",
  game_name: "Counter-Strike",
  viewer_count: 1204,
  started_at: STARTED.toISOString(),
  thumbnail_url:
    "https://static-cdn.jtvnw.net/previews-ttv/live_user_kappa_cs-640x360.jpg",
};

const offline = {
  ...live,
  is_live: false,
  title: null,
  game_name: null,
  viewer_count: null,
  started_at: null,
  thumbnail_url: null,
};

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.useRealTimers();
});

async function mount(component: any, stream: Record<string, unknown>) {
  const wrapper = await mountSuspended(component, { props: { stream } });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

describe("profile Twitch link", () => {
  it("shows a red Live pill with the viewer count while live", async () => {
    const wrapper = await mount(PlayerTwitchLink, live);
    const pill = wrapper.get("[data-test='twitch-live']");

    expect(pill.text()).toBe("Live · 1.2K");
    expect(pill.attributes("href")).toBe("https://www.twitch.tv/kappa_cs");
    expect(pill.attributes("target")).toBe("_blank");
    expect(pill.attributes("aria-label")).toBe(
      "Live on Twitch · 1,204 watching",
    );
    expect(wrapper.find("[data-test='twitch-channel']").exists()).toBe(false);
  });

  it("is just a Twitch icon button while offline", async () => {
    const wrapper = await mount(PlayerTwitchLink, offline);
    const button = wrapper.get("[data-test='twitch-channel']");

    expect(button.text()).toBe("");
    expect(button.attributes("aria-label")).toBe("Twitch Channel");
    expect(button.attributes("href")).toBe("https://www.twitch.tv/kappa_cs");
    expect(wrapper.find("[data-test='twitch-live']").exists()).toBe(false);
  });
});

describe("profile Twitch watch card", () => {
  it("shows Twitch's thumbnail and the stream's details without loading the stream", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(STARTED.getTime() + (2 * 60 + 14) * 60_000));
    const wrapper = await mount(PlayerTwitchWatchCard, live);

    expect(wrapper.get("img").attributes("src")).toBe(live.thumbnail_url);
    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).toContain("FACEIT grind then scrims w/ Northwind");
    expect(wrapper.text()).toContain(
      "Counter-Strike · 1,204 watching · live 2h 14m",
    );
    expect(
      wrapper
        .get("a[href='https://www.twitch.tv/kappa_cs']")
        .text(),
    ).toBe("Open on Twitch");
  });

  it("loads the Twitch player only when play is pressed", async () => {
    const wrapper = await mount(PlayerTwitchWatchCard, live);

    await wrapper.get("button[aria-label='Play Stream']").trigger("click");
    await flushPromises();

    const src = new URL(wrapper.get("iframe").attributes("src")!);
    expect(src.origin).toBe("https://player.twitch.tv");
    expect(src.searchParams.get("channel")).toBe("kappa_cs");
    expect(src.searchParams.get("parent")).toBe(window.location.hostname);
  });

  it("falls back to the channel name when the stream has no title", async () => {
    const wrapper = await mount(PlayerTwitchWatchCard, { ...live, title: null });

    expect(wrapper.text()).toContain("Kappa_CS");
  });
});
