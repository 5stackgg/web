import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import MatchPage from "~/pages/matches/[id]/index.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { e_match_status_enum } from "~/generated/zeus";

const MATCH = "11111111-1111-4111-8111-111111111111";
const ME = "76561198000000001";
const SOMEONE = "76561198000000002";

type Observer = { next: (result: any) => void };

let liveObserver: Observer | null = null;
let staticAnswer: Record<string, unknown> = {};
let mounted: { unmount: () => void } | null = null;

const kappa = {
  steam_id: "76561198000000003",
  name: "kappa",
  avatar_url: null,
  match_lineup_id: "lineup-1",
  login: "kappa_cs",
  display_name: "kappa_cs",
  title: "grinding",
  viewer_count: 12,
  started_at: "2026-10-14T10:00:00Z",
  thumbnail_url: null,
};

function field(query: any) {
  return query.definitions[0]?.selectionSet?.selections[0]?.name?.value;
}

function lineup(id: string) {
  return {
    id,
    name: id,
    is_on_lineup: false,
    coach: null,
    captain: null,
    lineup_players: [],
  };
}

function live(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH,
    status: e_match_status_enum.Live,
    server_id: null,
    organizer_steam_id: SOMEONE,
    options: { best_of: 1 },
    match_maps: [],
    streams: [],
    lineup_1: lineup("lineup-1"),
    lineup_2: lineup("lineup-2"),
    ...overrides,
  };
}

function permissions(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH,
    is_coach: false,
    is_captain: false,
    is_in_lineup: false,
    is_organizer: false,
    can_schedule: false,
    can_cancel: false,
    can_assign_server: false,
    can_stream_live: false,
    ...overrides,
  };
}

async function mountMatch(answer: Record<string, unknown>) {
  staticAnswer = answer;
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);

  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: Observer) {
      if (field(options.query) === "matches_by_pk") {
        liveObserver = observer;
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  vi.spyOn(client, "watchQuery").mockImplementation((options: any) => {
    const isStatic = field(options.query) === "matches_by_pk";
    const result = () => ({
      loading: false,
      data: isStatic ? { matches_by_pk: staticAnswer } : undefined,
    });
    return {
      options,
      getCurrentResult: () => ({ loading: true, data: undefined }),
      subscribe(observer: Observer) {
        if (isStatic) {
          Promise.resolve().then(() => observer.next(result()));
        }
        return { closed: false, unsubscribe() {} };
      },
      refetch: () => Promise.resolve(result()),
      setVariables: () => Promise.resolve(),
      setOptions: () => Promise.resolve(),
      stopPolling() {},
      getLastError() {},
      getLastResult() {},
      resetLastResults() {},
    } as any;
  });

  const wrapper = await mountSuspended(MatchPage, {
    route: `/matches/${MATCH}`,
    shallow: true,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: { MatchTwitchPovs: false, PageTransition: false },
    },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

async function emitLive(match: Record<string, unknown>) {
  liveObserver!.next({ data: { matches_by_pk: match } });
  await flushPromises();
}

let povs: unknown[];

beforeEach(() => {
  povs = [kappa];
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  useApplicationSettingsStore().settings = [
    { name: "public.supports_twitch", value: "true" },
  ];
  vi.stubGlobal(
    "$fetch",
    vi.fn((url: string) =>
      String(url).endsWith(`/twitch/matches/${MATCH}/streams`)
        ? Promise.resolve({ streams: povs })
        : Promise.reject(new Error(`unexpected ${url}`)),
    ),
  );
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  liveObserver = null;
  staticAnswer = {};
  useAuthStore().me = undefined;
  useApplicationSettingsStore().settings = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the match page's player POVs", () => {
  it("gives a viewer the stream block for a Live match that only has POVs", async () => {
    const wrapper = await mountMatch(permissions());
    await emitLive(live());
    await vi.waitFor(() =>
      expect(wrapper.findComponent(StreamEmbed).exists()).toBe(true),
    );

    expect(
      wrapper
        .findComponent(StreamEmbed)
        .props("streams")
        .map((stream: any) => stream.title),
    ).toEqual(["kappa POV"]);
  });

  it("puts the organizer's streams first", async () => {
    const wrapper = await mountMatch(permissions());
    await emitLive(
      live({
        streams: [
          {
            id: "stream-1",
            link: "https://www.twitch.tv/caster",
            title: "Main broadcast",
            priority: 1,
            is_game_streamer: false,
          },
        ],
      }),
    );
    await vi.waitFor(() =>
      expect(
        wrapper.findComponent(StreamEmbed).props("streams"),
      ).toHaveLength(2),
    );

    expect(
      wrapper
        .findComponent(StreamEmbed)
        .props("streams")
        .map((stream: any) => stream.title),
    ).toEqual(["Main broadcast", "kappa POV"]);
  });

  it("leaves the block out when nobody is streaming", async () => {
    povs = [];
    const wrapper = await mountMatch(permissions());
    await emitLive(live());
    await flushPromises();

    expect(wrapper.findComponent(StreamEmbed).exists()).toBe(false);
  });

  it("shows a player in the match no stream block, as today", async () => {
    const wrapper = await mountMatch(permissions({ is_in_lineup: true }));
    await emitLive(live());
    await flushPromises();

    expect(wrapper.findComponent(StreamEmbed).exists()).toBe(false);
  });
});
