import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import WatchStreamStage from "~/components/watch/WatchStreamStage.vue";
import StreamLiveTag from "~/components/match/StreamLiveTag.vue";
import StreamMatchCard from "~/components/match/StreamMatchCard.vue";
import {
  stageNeedsLogin,
  stageScoreBug,
  streamableMatches,
} from "~/components/watch/watchStage";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const { pushes } = vi.hoisted(() => ({
  pushes: [] as Array<(result: any) => void>,
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: () => ({
        subscribe: ({ next }: { next: (result: any) => void }) => {
          pushes.push(next);
          return { unsubscribe() {} };
        },
      }),
    },
  }),
}));

const twitch = { id: "s1", link: "https://twitch.tv/northside", title: "Main feed" };
const gameStreamer = {
  id: "g1",
  link: "https://stream.example/m1",
  title: "5Stack Game Streamer",
  is_game_streamer: true,
  is_live: true,
};

function liveMatch(overrides: Record<string, any> = {}) {
  return {
    id: "m1",
    status: "Live",
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    lineup_1: { id: "l1", name: "Buttah Boyz", team: { short_name: "BB" }, lineup_players: [] },
    lineup_2: { id: "l2", name: "Saint's Team", team: { short_name: "ST" }, lineup_players: [] },
    options: { best_of: 3, mr: 12 },
    match_maps: [
      { id: "a", winning_lineup_id: "l1", lineup_1_score: 13, lineup_2_score: 9, map: { label: "Mirage" } },
      { id: "b", is_current_map: true, status: "Live", lineup_1_score: 10, lineup_2_score: 8, map: { label: "Inferno" } },
    ],
    tournament_brackets: [],
    event_links: [],
    streams: [twitch],
    is_in_lineup: false,
    is_coach: false,
    ...overrides,
  };
}

describe("stage rules", () => {
  it("never puts a match on the stage for its own players or coaches", () => {
    const rows = [
      liveMatch({ id: "watching" }),
      liveMatch({ id: "playing", is_in_lineup: true }),
      liveMatch({ id: "coaching", is_coach: true }),
      liveMatch({ id: "no-stream", streams: [] }),
    ];
    expect(streamableMatches(rows).map((m) => m.id)).toEqual(["watching"]);
  });

  it("gates on login only when the server requires it", () => {
    expect(stageNeedsLogin(true, false)).toBe(true);
    expect(stageNeedsLogin(true, true)).toBe(false);
    expect(stageNeedsLogin(false, false)).toBe(false);
  });

  it("writes the phone score bug", () => {
    expect(stageScoreBug(liveMatch())).toBe("BB 1 · 10–8 · 0 ST");
    expect(
      stageScoreBug(
        liveMatch({ options: { best_of: 1 }, match_maps: [liveMatch().match_maps[1]] }),
      ),
    ).toBe("BB 10–8 ST");
  });
});

async function mountStage(matches: any[]) {
  const wrapper = await mountSuspended(WatchStreamStage, {
    global: {
      stubs: {
        StreamEmbed: { template: '<div class="stream-embed" />' },
        LiveStreamPlayer: { template: '<div class="live-player" />' },
        StreamMatchCard: true,
        StreamViewerBadge: true,
        StreamThumbnail: true,
      },
    },
  });
  for (const next of pushes) next({ data: { matches } });
  await flushPromises();
  return wrapper;
}

describe("WatchStreamStage", () => {
  beforeEach(() => {
    pushes.length = 0;
    useApplicationSettingsStore().settings = [];
  });

  it("renders nothing and reports no ids while nothing is streamable", async () => {
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
    const wrapper = await mountStage([liveMatch({ is_in_lineup: true })]);

    expect(wrapper.find("#watch-stage").exists()).toBe(false);
    expect(wrapper.emitted("update:streamable-ids")?.at(-1)).toEqual([[]]);
  });

  it("asks a signed-out viewer to log in instead of mounting the stream", async () => {
    useAuthStore().me = null as any;
    const wrapper = await mountStage([liveMatch()]);

    expect(wrapper.text()).toContain("Log in with Steam to watch");
    expect(wrapper.find(".stream-embed").exists()).toBe(false);
    expect(wrapper.emitted("update:streamable-ids")?.at(-1)).toEqual([["m1"]]);
  });

  it("plays the stream for a signed-in viewer", async () => {
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
    const wrapper = await mountStage([liveMatch()]);

    expect(wrapper.text()).not.toContain("Log in with Steam to watch");
    expect(wrapper.find(".stream-embed").exists()).toBe(true);
  });

  it("lets guests watch when the server doesn't require a login", async () => {
    useAuthStore().me = null as any;
    useApplicationSettingsStore().settings = [
      { name: "public.require_login_for_live_streams", value: "false" },
    ] as any;
    const wrapper = await mountStage([liveMatch()]);

    expect(wrapper.find(".stream-embed").exists()).toBe(true);
  });
});

describe("WatchStreamStage over the game stream", () => {
  beforeEach(() => {
    pushes.length = 0;
    useApplicationSettingsStore().settings = [];
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides its chrome while the viewer watches and brings it back on pointer activity", async () => {
    const wrapper = await mountStage([liveMatch({ streams: [gameStreamer] })]);
    const screen = wrapper.find(".watch-stage-screen");
    const liveTag = () => wrapper.findComponent(StreamLiveTag).classes();

    expect(wrapper.find(".live-player").exists()).toBe(true);
    // The HUD burned into the stream already names the teams and the score.
    expect(wrapper.findComponent(StreamMatchCard).exists()).toBe(false);
    // Up for a beat when the picture first comes up.
    expect(liveTag()).toContain("opacity-100");

    await screen.trigger("mouseleave");
    expect(liveTag()).toContain("opacity-0");
    expect(screen.classes()).toContain("cursor-none");

    vi.useFakeTimers();
    await screen.trigger("mousemove");
    expect(liveTag()).toContain("opacity-100");
    expect(screen.classes()).not.toContain("cursor-none");

    vi.advanceTimersByTime(2000);
    await flushPromises();
    expect(liveTag()).toContain("opacity-0");
  });

  it("offers a volume slider once unmuted, and dragging it to zero mutes", async () => {
    const wrapper = await mountStage([liveMatch({ streams: [gameStreamer] })]);

    expect(wrapper.find('input[type="range"]').exists()).toBe(false);
    await wrapper.find('button[aria-label="Unmute"]').trigger("click");

    const slider = wrapper.find('input[type="range"]');
    expect(slider.exists()).toBe(true);
    await slider.setValue("0");

    expect(wrapper.find('button[aria-label="Unmute"]').exists()).toBe(true);
    expect(wrapper.find('input[type="range"]').exists()).toBe(false);
  });

  it("keeps its chrome up over a third-party embed", async () => {
    const wrapper = await mountStage([liveMatch()]);

    await wrapper.find(".watch-stage-screen").trigger("mouseleave");
    expect(wrapper.findComponent(StreamLiveTag).classes()).toContain(
      "opacity-100",
    );
    expect(wrapper.findComponent(StreamMatchCard).exists()).toBe(true);
  });
});
