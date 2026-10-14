import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchTwitchPovs from "~/components/match/MatchTwitchPovs.vue";
import MatchLiveStreams from "~/components/match/MatchLiveStreams.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
    },
  }),
}));

const MATCH = "2b7a3c4d-1111-4222-8333-944455556666";

const organizerStream = {
  id: "stream-1",
  link: "https://www.youtube.com/watch?v=abc123",
  title: "Main broadcast",
  priority: 1,
  is_game_streamer: false,
};

const pov = (steamId: string, name: string, login: string) => ({
  steam_id: steamId,
  name,
  avatar_url: `/avatars/${steamId}.png`,
  match_lineup_id: "lineup-1",
  login,
  display_name: login,
  title: "grinding",
  viewer_count: 12,
  started_at: "2026-10-14T10:00:00Z",
  thumbnail_url: null,
});

let povs: unknown[];
let fetched: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

beforeEach(() => {
  povs = [
    pov("76561198000000001", "kappa", "kappa_cs"),
    pov("76561198000000002", "rook", "rook_tv"),
  ];
  useApplicationSettingsStore().settings = [
    { name: "public.supports_twitch", value: "true" },
  ];
  useApplicationSettingsStore().setGlobalStream();
  fetched = vi.fn((url: string) =>
    String(url).endsWith(`/twitch/matches/${MATCH}/streams`)
      ? Promise.resolve({ streams: povs })
      : Promise.reject(new Error(`unexpected ${url}`)),
  );
  vi.stubGlobal("$fetch", fetched);
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  useApplicationSettingsStore().settings = [];
  await flushPromises();
});

async function mountPovs(match: Record<string, unknown>) {
  let slot: { streams: any[] } = { streams: [] };
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          MatchTwitchPovs,
          { match, streams: [organizerStream] },
          {
            default: (props: { streams: any[] }) => {
              slot = props;
              return h("div");
            },
          },
        );
    },
  });
  const wrapper = await mountSuspended(Host);
  unmount = () => wrapper.unmount();
  await flushPromises();
  return () => slot.streams;
}

describe("match POV streams", () => {
  it("puts the players' POVs after the organizer's streams, named after the player", async () => {
    const config = useRuntimeConfig().public;
    const apiDomain = config.apiDomain;
    config.apiDomain = "api.5stack.test";
    onTestFinished(() => {
      config.apiDomain = apiDomain;
    });
    const streams = await mountPovs({ id: MATCH, status: "Live" });

    expect(streams().map((stream) => stream.title)).toEqual([
      "Main broadcast",
      "kappa POV",
      "rook POV",
    ]);
    expect(streams()[1]).toEqual(
      expect.objectContaining({
        link: "https://www.twitch.tv/kappa_cs",
        is_pov: true,
        name: "kappa",
        steam_id: "76561198000000001",
        match_id: MATCH,
      }),
    );
    expect(streams()[1].avatar_url).toBe(
      "https://api.5stack.test/avatars/76561198000000001.png",
    );
  });

  it("asks for nothing and adds nothing outside a Live match", async () => {
    const streams = await mountPovs({ id: MATCH, status: "Finished" });

    expect(fetched).not.toHaveBeenCalled();
    expect(streams()).toEqual([organizerStream]);
  });

  it("adds nothing while Twitch is not set up", async () => {
    useApplicationSettingsStore().settings = [];
    const streams = await mountPovs({ id: MATCH, status: "Live" });

    expect(fetched).not.toHaveBeenCalled();
    expect(streams()).toEqual([organizerStream]);
  });
});

describe("the Streams card", () => {
  async function mountCard(streams: unknown[]) {
    const wrapper = await mountSuspended(MatchLiveStreams, {
      props: {
        match: { id: MATCH, status: "Live", streams, is_organizer: false },
      },
      global: { stubs: { StreamEmbed: true, LiveStreamPlayer: true } },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  it("shows the organizer's streams, then the POVs, by name", async () => {
    const wrapper = await mountCard([organizerStream]);
    const embed = wrapper.findComponent(StreamEmbed);

    expect(
      embed.props("streams").map((stream: any) => stream.title),
    ).toEqual(["Main broadcast", "kappa POV", "rook POV"]);
    expect(embed.props("showTitle")).toBe(true);
  });

  it("shows the POVs without saying there are no streams when the organizer added none", async () => {
    const wrapper = await mountCard([]);

    expect(
      wrapper
        .findComponent(StreamEmbed)
        .props("streams")
        .map((stream: any) => stream.title),
    ).toEqual(["kappa POV", "rook POV"]);
    expect(wrapper.text()).not.toContain("No Live Streams");
  });

  it("says there are no streams when nobody is live either", async () => {
    povs = [];
    const wrapper = await mountCard([]);

    expect(wrapper.findComponent(StreamEmbed).exists()).toBe(false);
    expect(wrapper.text()).toContain("No Live Streams");
  });
});
