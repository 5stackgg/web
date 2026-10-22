import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayersPage from "~/pages/players/index.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(false) }),
}));

const LIVE = "76561198000000001";
const QUIET = "76561198000000002";
const LATER = "76561198000000003";

const hit = (steamId: string, name: string) => ({
  document: { steam_id: steamId, name, wins: 0, losses: 0 },
});

let liveSteamIds: string[];
let fetched: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

const searches = () =>
  fetched.mock.calls
    .filter(([url]) => url === "/api/players-search")
    .map(([, options]) => options.body);

const lastSearch = () => searches().at(-1);

async function mountPage() {
  const wrapper = await mountSuspended(PlayersPage, { route: "/players" });
  unmount = () => wrapper.unmount();
  await vi.waitFor(() =>
    expect(
      wrapper.findAll("tr").some((row) => row.text().includes("marlowe")),
    ).toBe(true),
  );
  await flushPromises();
  return wrapper;
}

const liveTag = (wrapper: any, name: string) =>
  wrapper
    .findAll("tr")
    .find((row: any) => row.text().includes(name))
    ?.find("[data-test='twitch-live-tag']");

beforeEach(() => {
  localStorage.removeItem("players-filters");
  liveSteamIds = [LIVE];
  useApplicationSettingsStore().settings = [
    { name: "public.supports_twitch", value: "true" },
  ];
  fetched = vi.fn((url: string) => {
    if (url === "/api/players-search") {
      return Promise.resolve({
        found: 2,
        hits: [hit(LIVE, "kappa"), hit(QUIET, "marlowe")],
      });
    }
    if (String(url).endsWith("/twitch/live")) {
      return Promise.resolve({ steam_ids: liveSteamIds });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("$fetch", fetched);
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  localStorage.removeItem("players-filters");
  useApplicationSettingsStore().settings = [];
  await flushPromises();
});

describe("players page, Live on Twitch", () => {
  it("tags live players' names whether or not the filter is on", async () => {
    const wrapper = await mountPage();

    await vi.waitFor(() =>
      expect(liveTag(wrapper, "kappa")?.text()).toBe("Live"),
    );
    expect(liveTag(wrapper, "marlowe")?.exists() ?? false).toBe(false);
    expect(lastSearch().live_steam_ids).toBeUndefined();
  });

  it("offers the filter next to Online", async () => {
    const wrapper = await mountPage();
    (wrapper.vm as any).filtersPopoverOpen = true;
    await flushPromises();

    const labels = wrapper
      .findAllComponents(FilterToggle)
      .map((toggle) => toggle.props("label"));
    expect(labels.indexOf("Live on Twitch")).toBe(
      labels.indexOf("Online") + 1,
    );
  });

  it("sends who is live when the filter is on, and adds a chip", async () => {
    const wrapper = await mountPage();
    const before = searches().length;

    (wrapper.vm as any).onlyLiveOnTwitch = true;
    await vi.waitFor(() =>
      expect(searches().length).toBeGreaterThan(before),
    );

    expect(lastSearch().live_steam_ids).toEqual([LIVE]);
    expect(
      (wrapper.vm as any).activeFilterChips.map((chip: any) => chip.label),
    ).toContain("Live on Twitch");
    expect(
      JSON.parse(localStorage.getItem("players-filters")!).onlyLiveOnTwitch,
    ).toBe(true);
  });

  it("searches again by itself when someone goes live", async () => {
    const wrapper = await mountPage();
    (wrapper.vm as any).onlyLiveOnTwitch = true;
    await vi.waitFor(() =>
      expect(lastSearch().live_steam_ids).toEqual([LIVE]),
    );

    (wrapper.vm as any).twitchLive.steamIds = [LIVE, LATER];
    await vi.waitFor(() =>
      expect(lastSearch().live_steam_ids).toEqual([LIVE, LATER]),
    );
  });

  it("has no Twitch filter, chip or tags while Twitch is not set up", async () => {
    useApplicationSettingsStore().settings = [];
    localStorage.setItem(
      "players-filters",
      JSON.stringify({ onlyLiveOnTwitch: true }),
    );
    const wrapper = await mountPage();
    (wrapper.vm as any).filtersPopoverOpen = true;
    await flushPromises();

    expect(
      wrapper
        .findAllComponents(FilterToggle)
        .map((toggle) => toggle.props("label")),
    ).not.toContain("Live on Twitch");
    expect((wrapper.vm as any).activeFilterChips).toEqual([]);
    expect(lastSearch().live_steam_ids).toBeUndefined();
    expect(liveTag(wrapper, "kappa")?.exists() ?? false).toBe(false);
    expect(
      fetched.mock.calls.filter(([url]) => String(url).includes("/twitch/")),
    ).toEqual([]);
  });
});
