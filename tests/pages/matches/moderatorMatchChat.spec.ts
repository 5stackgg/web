import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import MatchPage from "~/pages/matches/[id]/index.vue";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_match_status_enum } from "~/generated/zeus";

const MATCH = "11111111-1111-4111-8111-111111111111";
const ME = "76561198000000001";
const SOMEONE = "76561198000000002";

type Observer = { next: (result: any) => void };

let liveObserver: Observer | null = null;
let staticObservers: Observer[] = [];
let staticAnswer: Record<string, unknown> | null = null;
let mounted: { unmount: () => void } | null = null;

function field(query: any) {
  return query.definitions[0]?.selectionSet?.selections[0]?.name?.value;
}

function lineup(id: string, players: Record<string, unknown>[] = []) {
  return {
    id,
    name: id,
    is_on_lineup: false,
    coach: null,
    captain: null,
    lineup_players: players,
  };
}

function live(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH,
    status: e_match_status_enum.Live,
    source: "5stack",
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

function signIn(role: string) {
  useAuthStore().me = { steam_id: ME, role } as any;
}

async function mountMatch(answer: Record<string, unknown> | null) {
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
      data: isStatic && staticAnswer ? { matches_by_pk: staticAnswer } : {},
    });
    return {
      options,
      getCurrentResult: () => ({ loading: true, data: undefined }),
      subscribe(observer: Observer) {
        if (isStatic) {
          staticObservers.push(observer);
          if (staticAnswer) {
            Promise.resolve().then(() => observer.next(result()));
          }
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
      stubs: { PageTransition: false },
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

function chatOf(wrapper: Awaited<ReturnType<typeof mountMatch>>) {
  return wrapper.findComponent(ChatLobby);
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  liveObserver = null;
  staticObservers = [];
  staticAnswer = null;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("a moderator on a match they have no part in", () => {
  it.each([
    e_match_status_enum.WaitingForCheckIn,
    e_match_status_enum.Veto,
    e_match_status_enum.WaitingForServer,
    e_match_status_enum.Live,
  ])("reads its Match Chat, read only, while it is %s", async (status) => {
    signIn("moderator");
    const wrapper = await mountMatch(permissions());

    await emitLive(live({ status }));

    const chat = chatOf(wrapper);
    expect(chat.exists()).toBe(true);
    expect(chat.attributes("type")).toBe("match");
    expect(chat.attributes("lobby-id")).toBe(MATCH);
    expect(chat.attributes("can-send")).toBe("false");
    expect(chat.attributes("readonly-hint")).toBe(
      (wrapper.vm as any).$t("chat.match_moderator_readonly"),
    );
  });

  it("is never handed a team's own chat", async () => {
    signIn("moderator");
    const wrapper = await mountMatch(permissions());

    await emitLive(
      live({
        lineup_1: {
          ...lineup("lineup-1", [{ steam_id: ME, captain: false }]),
          is_on_lineup: true,
        },
      }),
    );

    expect(chatOf(wrapper).exists()).toBe(true);
    expect(chatOf(wrapper).attributes("team-lobby-id")).toBeUndefined();
  });

  it("is not rung for every line of a room they are only reading", async () => {
    signIn("moderator");
    const wrapper = await mountMatch(permissions());

    await emitLive(live({ status: e_match_status_enum.Veto }));

    expect(chatOf(wrapper).attributes("play-notification-sound")).toBe(
      "false",
    );
  });

  it.each([
    e_match_status_enum.PickingPlayers,
    e_match_status_enum.Scheduled,
    e_match_status_enum.Finished,
    e_match_status_enum.Canceled,
  ])("has no chat on the page while it is %s", async (status) => {
    signIn("moderator");
    const wrapper = await mountMatch(permissions());

    await emitLive(live({ status }));

    expect(chatOf(wrapper).exists()).toBe(false);
  });

  it("has no chat on a practice session", async () => {
    signIn("moderator");
    const wrapper = await mountMatch(permissions());

    await emitLive(live({ source: "practice" }));

    expect(chatOf(wrapper).exists()).toBe(false);
  });

  it("is given no read-only chat before the page knows whether they play in it", async () => {
    signIn("moderator");
    const wrapper = await mountMatch(null);

    await emitLive(live());

    expect(chatOf(wrapper).exists()).toBe(false);

    staticAnswer = permissions({ is_in_lineup: true });
    staticObservers.forEach((observer) =>
      observer.next({ loading: false, data: { matches_by_pk: staticAnswer } }),
    );
    await flushPromises();

    expect(chatOf(wrapper).exists()).toBe(true);
    expect(chatOf(wrapper).attributes("can-send")).toBe("true");
  });
});

describe("the match page's chat for everyone else", () => {
  it.each(["user", "verified_user", "streamer"])(
    "stays off the page for a %s with no part in the match",
    async (role) => {
      signIn(role);
      const wrapper = await mountMatch(permissions());

      await emitLive(live());

      expect(chatOf(wrapper).exists()).toBe(false);
    },
  );

  it.each([
    ["a player", { is_in_lineup: true }],
    ["a coach", { is_coach: true }],
    ["an organizer", { is_organizer: true }],
  ])("lets %s who is also a moderator write", async (_who, seat) => {
    signIn("moderator");
    const wrapper = await mountMatch(permissions(seat));

    await emitLive(live());

    expect(chatOf(wrapper).exists()).toBe(true);
    expect(chatOf(wrapper).attributes("can-send")).toBe("true");
    expect(chatOf(wrapper).attributes("readonly-hint")).toBeUndefined();
  });
});
