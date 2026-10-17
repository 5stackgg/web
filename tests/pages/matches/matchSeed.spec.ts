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
let liveContext: Record<string, any> | null = null;
let mounted: { unmount: () => void } | null = null;

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

const draftMatch = () =>
  match({
    status: e_match_status_enum.Veto,
    draft_games: [{ id: "draft-1" }],
  });

async function mountMatch() {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);

  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: Observer) {
      if (field(options.query) === "matches_by_pk") {
        liveObserver = observer;
        liveContext = options.context ?? null;
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  vi.spyOn(client, "watchQuery").mockImplementation(
    (options: any) =>
      ({
        options,
        getCurrentResult: () => ({ loading: true, data: undefined }),
        subscribe: () => ({ closed: false, unsubscribe() {} }),
        refetch: () => Promise.resolve({ loading: false, data: undefined }),
        setVariables: () => Promise.resolve(),
        setOptions: () => Promise.resolve(),
        stopPolling() {},
        getLastError() {},
        getLastResult() {},
        resetLastResults() {},
      }) as any,
  );

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

async function answerLive(row: Record<string, unknown> | null) {
  liveObserver!.next({ data: { matches_by_pk: row } });
  await flushPromises();
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  liveObserver = null;
  liveContext = null;
  useMatchContext().value = null;
  navigate.mockReset();
  vi.restoreAllMocks();
});

describe("the match page's seeded subscription", () => {
  it("renders from the HTTP answer for a match it can show", async () => {
    await mountMatch();

    expect(liveContext?.seed({ matches_by_pk: match() })).toBe(true);
  });

  it("leaves a missing match to the socket", async () => {
    await mountMatch();

    expect(liveContext?.seed({ matches_by_pk: null })).toBe(false);
  });

  it("leaves the draft-room redirect to the socket", async () => {
    await mountMatch();

    expect(liveContext?.seed({ matches_by_pk: draftMatch() })).toBe(false);

    await answerLive(draftMatch());

    expect(navigate).toHaveBeenCalledWith("/draft-room/draft-1");
  });

  it("clears its own match context when it leaves", async () => {
    const wrapper = await mountMatch();
    await answerLive(match());
    expect(useMatchContext().value?.id).toBe(MATCH);

    wrapper.unmount();
    mounted = null;

    expect(useMatchContext().value).toBeNull();
  });

  it("leaves the context of the match page that replaced it", async () => {
    const wrapper = await mountMatch();
    await answerLive(match());
    useMatchContext().value = { id: "next-match", displayText: "Next" };

    wrapper.unmount();
    mounted = null;

    expect(useMatchContext().value?.id).toBe("next-match");
  });
});
