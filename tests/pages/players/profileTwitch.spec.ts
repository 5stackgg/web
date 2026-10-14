import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerPage from "~/pages/players/[id].vue";
import PlayerTwitchLink from "~/components/player/PlayerTwitchLink.vue";
import PlayerTwitchWatchCard from "~/components/player/PlayerTwitchWatchCard.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const client = vi.hoisted(() => ({
  query: () => Promise.resolve({ data: {} }),
  subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(false) }),
}));

const TARGET = "76561198000000002";

const stream = (isLive: boolean) => ({
  steam_id: TARGET,
  login: "kappa_cs",
  display_name: "kappa_cs",
  is_live: isLive,
  title: isLive ? "FACEIT grind" : null,
  game_name: isLive ? "Counter-Strike" : null,
  viewer_count: isLive ? 1204 : null,
  started_at: isLive ? "2026-10-14T10:00:00Z" : null,
  thumbnail_url: null,
});

let twitch: () => Promise<unknown>;
let fetched: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

async function mountProfile() {
  const wrapper = await mountSuspended(PlayerPage, {
    shallow: true,
    route: `/players/${TARGET}`,
    global: { renderStubDefaultSlot: true },
  } as any);
  unmount = () => wrapper.unmount();
  (wrapper.vm as any).player = {
    steam_id: TARGET,
    name: "Dana",
    role: e_player_roles_enum.user,
    profile_url: "https://steamcommunity.com/profiles/1",
  };
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Viewer",
    role: e_player_roles_enum.user,
  } as any;
  useApplicationSettingsStore().settings = [
    { name: "public.supports_twitch", value: "true" },
  ];
  fetched = vi.fn((url: string) =>
    String(url).includes(`/twitch/players/${TARGET}`)
      ? twitch()
      : Promise.reject(new Error(`unexpected ${url}`)),
  );
  vi.stubGlobal("$fetch", fetched);
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useAuthStore().me = undefined;
  useApplicationSettingsStore().settings = [];
  await flushPromises();
});

describe("player profile Twitch", () => {
  it("puts the live pill next to the Steam button and the watch card under the hero", async () => {
    twitch = () => Promise.resolve(stream(true));
    const wrapper = await mountProfile();

    expect(wrapper.findComponent(PlayerTwitchLink).props("stream")).toEqual(
      stream(true),
    );
    expect(wrapper.findComponent(PlayerTwitchWatchCard).exists()).toBe(true);
  });

  it("re-checks a playing stream even in a hidden tab, and cuts it once the api stops returning it", async () => {
    twitch = () => Promise.resolve(stream(true));
    const wrapper = await mountProfile();
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
      shouldClearNativeTimers: true,
    });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    wrapper
      .findComponent(PlayerTwitchWatchCard)
      .vm.$emit("update:playing", true);
    await flushPromises();

    twitch = () =>
      Promise.reject(Object.assign(new Error("Not Found"), { statusCode: 404 }));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(wrapper.findComponent(PlayerTwitchWatchCard).exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(20_000);
    await flushPromises();

    expect(wrapper.findComponent(PlayerTwitchWatchCard).exists()).toBe(false);
    expect(wrapper.findComponent(PlayerTwitchLink).exists()).toBe(false);
  });

  it("keeps the Twitch button but no watch card while offline", async () => {
    twitch = () => Promise.resolve(stream(false));
    const wrapper = await mountProfile();

    expect(
      wrapper.findComponent(PlayerTwitchLink).props("stream").is_live,
    ).toBe(false);
    expect(wrapper.findComponent(PlayerTwitchWatchCard).exists()).toBe(false);
  });

  it("shows no Twitch at all when the api has nothing to show (404)", async () => {
    twitch = () =>
      Promise.reject(Object.assign(new Error("Not Found"), { statusCode: 404 }));
    const wrapper = await mountProfile();

    expect(wrapper.findComponent(PlayerTwitchLink).exists()).toBe(false);
    expect(wrapper.findComponent(PlayerTwitchWatchCard).exists()).toBe(false);
  });

  it("does not ask about Twitch while it is not set up", async () => {
    useApplicationSettingsStore().settings = [];
    twitch = () => Promise.resolve(stream(true));
    const wrapper = await mountProfile();

    expect(
      fetched.mock.calls.filter(([url]) => String(url).includes("/twitch/")),
    ).toEqual([]);
    expect(wrapper.findComponent(PlayerTwitchLink).exists()).toBe(false);
  });
});
