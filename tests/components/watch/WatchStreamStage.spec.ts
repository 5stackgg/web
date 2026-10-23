import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import WatchStreamStage from "~/components/watch/WatchStreamStage.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import StreamLiveTag from "~/components/match/StreamLiveTag.vue";
import StreamMatchCard from "~/components/match/StreamMatchCard.vue";
import {
  stageNeedsLogin,
  stageScoreBug,
  streamableMatches,
} from "~/components/watch/watchStage";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useWatchStage } from "~/composables/useWatchStage";

const { pushes, clients, myRoles } = vi.hoisted(() => ({
  pushes: [] as Array<(result: any) => void>,
  clients: [] as Array<string>,
  myRoles: { state: null as any },
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: (id = "default") => ({
    client: {
      subscribe: () => ({
        subscribe: ({ next }: { next: (result: any) => void }) => {
          pushes.push(next);
          clients.push(id);
          return { unsubscribe() {} };
        },
      }),
    },
  }),
}));

// Fresh per test: stages from earlier tests are still mounted.
vi.mock("~/composables/useMyMatchRoles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/composables/useMyMatchRoles")>()),
  useMyMatchRoles: () => myRoles.state,
}));

function resetStage() {
  pushes.length = 0;
  clients.length = 0;
  myRoles.state = {
    ready: ref<boolean | null>(false),
    roles: ref(new Map()),
  };
}

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

async function mountStage(
  matches: any[],
  streamEmbed: Record<string, unknown> = {
    template: '<div class="stream-embed" />',
  },
) {
  const wrapper = await mountSuspended(WatchStreamStage, {
    global: {
      stubs: {
        StreamEmbed: streamEmbed,
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
    resetStage();
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

  it("reads the stage on the viewer's own session when it can't read as a guest", async () => {
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
    await mountStage([liveMatch()]);

    expect(clients).toEqual(["default"]);
  });

  // The stage is the same for every viewer, so a signed-in one reads it as a
  // guest and shares the poll. The guest's rows know nothing of the viewer.
  it("reads the stage as a guest and keeps the viewer's own match off it", async () => {
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
    myRoles.state.ready.value = true;
    myRoles.state.roles.value = new Map([
      ["playing", { is_in_lineup: true, is_coach: false }],
      ["coaching", { is_in_lineup: false, is_coach: true }],
    ]);
    const wrapper = await mountStage([
      liveMatch({ id: "playing" }),
      liveMatch({ id: "coaching" }),
      liveMatch({ id: "watching" }),
    ]);

    expect(clients).toEqual(["public"]);
    expect(wrapper.emitted("update:streamable-ids")?.at(-1)).toEqual([
      ["watching"],
    ]);
  });

  it("shows nothing until it knows which matches are the viewer's own", async () => {
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
    myRoles.state.ready.value = null;
    const wrapper = await mountStage([liveMatch()]);

    expect(clients).toEqual([]);
    expect(wrapper.find("#watch-stage").exists()).toBe(false);

    myRoles.state.ready.value = true;
    await flushPromises();
    for (const next of pushes) next({ data: { matches: [liveMatch()] } });
    await flushPromises();

    expect(clients).toEqual(["public"]);
    expect(wrapper.emitted("update:streamable-ids")?.at(-1)).toEqual([["m1"]]);
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
    resetStage();
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

  it("draws the same controls as every other player", async () => {
    const wrapper = await mountStage([liveMatch({ streams: [gameStreamer] })]);

    expect(
      wrapper.find('.stream-controls button[aria-label="Unmute"]').text(),
    ).toBe("Tap to unmute");
  });

  it("keeps the status card's corner clear until the game stream has a picture", async () => {
    const wrapper = await mountStage([liveMatch({ streams: [gameStreamer] })]);

    wrapper.findComponent(".live-player").vm.$emit("phase", "failed");
    await flushPromises();

    expect(wrapper.find(".stream-controls").classes()).toContain(
      "right-[var(--stream-control-inset)]",
    );
  });

  it("moves its controls to the top right over an embed, clear of the embed's own bar", async () => {
    const wrapper = await mountStage([liveMatch()]);

    expect(wrapper.find(".stream-controls").classes()).toContain(
      "top-[var(--stream-control-inset)]",
    );
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

describe("WatchStreamStage phone caption", () => {
  const ancient = { name: "de_ancient", label: null };

  beforeEach(() => {
    resetStage();
    useApplicationSettingsStore().settings = [];
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
  });

  const caption = (wrapper: Awaited<ReturnType<typeof mountStage>>) =>
    wrapper.find("p.basis-full").text();

  it("names an official map once, the way the status already does", async () => {
    const wrapper = await mountStage([
      liveMatch({
        options: { best_of: 1, mr: 12 },
        match_maps: [
          { id: "b", is_current_map: true, status: "Live", lineup_1_score: 7, lineup_2_score: 4, map: ancient },
        ],
      }),
    ]);

    expect(caption(wrapper)).toBe("R12 · Ancient");
  });

  it("keeps the map beside a finished match's result", async () => {
    const wrapper = await mountStage([
      liveMatch({
        status: "Finished",
        winning_lineup_id: "l1",
        options: { best_of: 1, mr: 12 },
        streams: [gameStreamer],
        match_maps: [
          { id: "b", status: "Finished", winning_lineup_id: "l1", lineup_1_score: 13, lineup_2_score: 4, map: ancient },
        ],
      }),
    ]);

    expect(caption(wrapper)).toBe("Ancient · Final");
  });
});

describe("WatchStreamStage press to play", () => {
  const pressable = {
    props: ["started"],
    emits: ["update:started"],
    template:
      '<button class="stream-embed" :data-started="started ? \'yes\' : \'no\'" @click="$emit(\'update:started\', true)" />',
  };
  const kick = { id: "s2", link: "https://kick.com/eastside", title: "Kick feed" };

  beforeEach(() => {
    resetStage();
    useApplicationSettingsStore().settings = [];
    useAuthStore().me = { steam_id: "1", role: "user" } as any;
  });

  it("counts its Watch button as the press, so the floating player starts at once", async () => {
    const wrapper = await mountStage([
      liveMatch({ streams: [{ ...kick, id: "s-watch-kick" }] }),
    ]);

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Watch")!
      .trigger("click");
    const floating = await mountSuspended(StreamEmbed, {
      props: {
        streams: [useApplicationSettingsStore().globalStream],
        global: true,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await flushPromises();

    expect(
      floating.find("[data-test='stream-press-play']").exists(),
    ).toBe(false);
    expect(floating.get("iframe").attributes("src")).toContain(
      "player.kick.com/eastside",
    );
    floating.unmount();
    useApplicationSettingsStore().setGlobalStream();
  });

  it("plays the next stream on the stage straight away once play was pressed there", async () => {
    useWatchStage().setStage("m1");
    const wrapper = await mountStage(
      [liveMatch(), liveMatch({ id: "m2", streams: [kick] })],
      pressable,
    );

    expect(wrapper.get(".stream-embed").attributes("data-started")).toBe("no");
    await wrapper.get(".stream-embed").trigger("click");

    useWatchStage().setStage("m2");
    await flushPromises();

    expect(wrapper.get(".stream-embed").attributes("data-started")).toBe(
      "yes",
    );
  });
});
