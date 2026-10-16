import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import MatchPage from "~/pages/matches/[id]/index.vue";
import { e_match_status_enum } from "~/generated/zeus";
import { useMatchContext } from "~/composables/useMatchContext";

const MATCH = "11111111-1111-4111-8111-111111111111";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
mockNuxtImport("navigateTo", () => navigate);

type Observer = { next: (result: any) => void };

let liveObserver: Observer | null = null;
let seedObserver: Observer | null = null;
let mounted: { unmount: () => void } | null = null;

function selection(query: any) {
  const match = query.definitions[0]?.selectionSet?.selections[0];
  return {
    field: match?.name?.value,
    fields: (match?.selectionSet?.selections ?? []).map(
      (field: any) => field.name.value,
    ),
  };
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

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH,
    status: e_match_status_enum.Finished,
    server_id: null,
    organizer_steam_id: "76561198000000002",
    options: { best_of: 1 },
    match_maps: [],
    streams: [],
    lineup_1: lineup("lineup-1"),
    lineup_2: lineup("lineup-2"),
    ...overrides,
  };
}

async function mountMatch() {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);

  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: Observer) {
      if (selection(options.query).field === "matches_by_pk") {
        liveObserver = observer;
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  vi.spyOn(client, "query").mockImplementation(() => new Promise(() => {}));

  vi.spyOn(client, "watchQuery").mockImplementation((options: any) => {
    const { field, fields } = selection(options.query);
    const isSeed = field === "matches_by_pk" && fields.includes("status");
    return {
      options,
      getCurrentResult: () => ({ loading: true, data: undefined }),
      subscribe(observer: Observer) {
        if (isSeed) {
          seedObserver = observer;
        }
        return { closed: false, unsubscribe() {} };
      },
      refetch: () => Promise.resolve({ loading: false, data: undefined }),
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
    },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

async function answerSeed(row: Record<string, unknown> | null) {
  seedObserver!.next({ loading: false, data: { matches_by_pk: row } });
  await flushPromises();
}

async function answerLive(row: Record<string, unknown> | null) {
  liveObserver!.next({ data: { matches_by_pk: row } });
  await flushPromises();
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  liveObserver = null;
  seedObserver = null;
  useMatchContext().value = null;
  navigate.mockReset();
  vi.restoreAllMocks();
});

describe("the match page's HTTP seed", () => {
  it("renders the match before the socket's first payload", async () => {
    const wrapper = await mountMatch();

    await answerSeed(match());

    expect((wrapper.vm as any).match?.id).toBe(MATCH);
  });

  it("is ignored once the socket has answered", async () => {
    const wrapper = await mountMatch();

    await answerLive(match({ status: e_match_status_enum.Live }));
    await answerSeed(match({ status: e_match_status_enum.Veto }));

    expect((wrapper.vm as any).match.status).toBe(e_match_status_enum.Live);
  });

  it("is not rendered again by a first payload that repeats it", async () => {
    const wrapper = await mountMatch();

    await answerSeed(match());
    const seeded = (wrapper.vm as any).matchLive;
    await answerLive(match());

    expect((wrapper.vm as any).matchLive).toBe(seeded);
  });

  it("gives way to a first payload that differs from it", async () => {
    const wrapper = await mountMatch();

    await answerSeed(match({ status: e_match_status_enum.Live }));
    await answerLive(match({ status: e_match_status_enum.Finished }));

    expect((wrapper.vm as any).match.status).toBe(
      e_match_status_enum.Finished,
    );
  });

  it("leaves a draft match's redirect to the socket", async () => {
    const wrapper = await mountMatch();

    await answerSeed(
      match({
        status: e_match_status_enum.Veto,
        draft_games: [{ id: "draft-1" }],
      }),
    );

    expect((wrapper.vm as any).matchLive).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();

    await answerLive(
      match({
        status: e_match_status_enum.Veto,
        draft_games: [{ id: "draft-1" }],
      }),
    );

    expect(navigate).toHaveBeenCalledWith("/draft-room/draft-1");
  });

  it("clears its own match context when it leaves", async () => {
    const wrapper = await mountMatch();
    await answerSeed(match());
    expect(useMatchContext().value?.id).toBe(MATCH);

    wrapper.unmount();
    mounted = null;

    expect(useMatchContext().value).toBeNull();
  });

  it("leaves the context of the match page that replaced it", async () => {
    const wrapper = await mountMatch();
    await answerSeed(match());
    useMatchContext().value = { id: "next-match", displayText: "Next" };

    wrapper.unmount();
    mounted = null;

    expect(useMatchContext().value?.id).toBe("next-match");
  });

  it("leaves a missing match for the socket to decide", async () => {
    const wrapper = await mountMatch();

    await answerSeed(null);

    expect((wrapper.vm as any).matchLive).toBeUndefined();
  });
});
