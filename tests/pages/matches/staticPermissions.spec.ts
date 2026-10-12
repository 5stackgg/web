import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import MatchPage from "~/pages/matches/[id]/index.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_match_status_enum } from "~/generated/zeus";

const MATCH_A = "11111111-1111-4111-8111-111111111111";
const MATCH_B = "44444444-4444-4444-8444-444444444444";
const ME = "76561198000000001";
const SOMEONE = "76561198000000002";

type Observer = { next: (result: any) => void };

let liveObservers: Record<string, Observer> = {};
let liveFields: Record<string, string[]> = {};
let answers: Record<string, Record<string, unknown>> = {};
let staticQueries: {
  matchId: string;
  observers: Observer[];
  refetch: ReturnType<typeof vi.fn>;
}[] = [];
let mounted: { unmount: () => void } | null = null;

function operation(query: any) {
  const definition = query.definitions[0];
  return {
    kind: definition?.operation,
    field: definition?.selectionSet?.selections[0]?.name?.value,
  };
}

// What the query asks for at the match's top level. Both halves answer from
// one row, the way the api does, so a field asked of the wrong half goes stale.
function fieldsOf(query: any): string[] {
  const match = query.definitions[0].selectionSet.selections[0];
  return match.selectionSet.selections.map(
    (selection: any) => selection.name.value,
  );
}

function project(row: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(
    Object.entries(row).filter(([field]) => fields.includes(field)),
  );
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
    id: MATCH_A,
    status: e_match_status_enum.PickingPlayers,
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
    id: MATCH_A,
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

function signIn(steamId = ME, role = "user") {
  useAuthStore().me = { steam_id: steamId, role } as any;
}

function emitLive(match: Record<string, unknown>) {
  const id = String(match.id);
  liveObservers[id].next({
    data: { matches_by_pk: project(match, liveFields[id]) },
  });
}

function staticFor(matchId: string) {
  return staticQueries.filter((query) => query.matchId === matchId);
}

function refetches() {
  return staticQueries.reduce(
    (count, query) => count + query.refetch.mock.calls.length,
    0,
  );
}

async function mountMatch(answer: Record<string, unknown>) {
  answers[MATCH_A] = answer;
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);

  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: Observer) {
      if (operation(options.query).field === "matches_by_pk") {
        liveObservers[options.variables.matchId] = observer;
        liveFields[options.variables.matchId] = fieldsOf(options.query);
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  vi.spyOn(client, "watchQuery").mockImplementation((options: any) => {
    const isStatic = operation(options.query).field === "matches_by_pk";
    const record = {
      matchId: options.variables?.matchId,
      observers: [] as Observer[],
      refetch: vi.fn(),
    };
    const answer = () =>
      isStatic && answers[record.matchId]
        ? project(answers[record.matchId], fieldsOf(options.query))
        : undefined;
    const result = () => ({
      loading: false,
      data: answer() ? { matches_by_pk: answer() } : undefined,
    });
    record.refetch.mockImplementation(() => {
      const next = result();
      record.observers.forEach((observer) => observer.next(next));
      return Promise.resolve(next);
    });

    if (isStatic) {
      staticQueries.push(record);
    }

    return {
      options,
      getCurrentResult: () => ({ loading: true, data: undefined }),
      subscribe(observer: Observer) {
        record.observers.push(observer);
        if (answer()) {
          Promise.resolve().then(() => observer.next(result()));
        }
        return {
          closed: false,
          unsubscribe() {
            this.closed = true;
          },
        };
      },
      refetch: record.refetch,
      setVariables: () => Promise.resolve(),
      setOptions: () => Promise.resolve(),
      stopPolling() {},
      getLastError() {},
      getLastResult() {},
      resetLastResults() {},
    } as any;
  });

  const wrapper = await mountSuspended(MatchPage, {
    route: `/matches/${MATCH_A}`,
    shallow: true,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
    },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  liveObservers = {};
  liveFields = {};
  answers = {};
  staticQueries = [];
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("the match page's one-time permissions", () => {
  it("are fetched again when an organizer adds the viewer to a lineup", async () => {
    signIn();
    const wrapper = await mountMatch(permissions());

    emitLive(live());
    await flushPromises();

    expect((wrapper.vm as any).match.is_in_lineup).toBe(false);
    expect(refetches()).toBe(0);

    answers[MATCH_A] = permissions({ is_in_lineup: true });
    emitLive(
      live({
        lineup_1: lineup("lineup-1", [
          { steam_id: ME, captain: false, player: { steam_id: ME } },
        ]),
      }),
    );
    await flushPromises();

    expect(refetches()).toBe(1);
    expect((wrapper.vm as any).match.is_in_lineup).toBe(true);
  });

  it("are fetched again when the viewer is made captain or coach", async () => {
    signIn();
    await mountMatch(permissions({ is_in_lineup: true }));

    emitLive(
      live({
        lineup_1: lineup("lineup-1", [{ steam_id: ME, captain: false }]),
      }),
    );
    await flushPromises();

    emitLive(
      live({
        lineup_1: lineup("lineup-1", [{ steam_id: ME, captain: true }]),
      }),
    );
    await flushPromises();

    expect(refetches()).toBe(1);

    emitLive(
      live({
        lineup_1: {
          ...lineup("lineup-1", [{ steam_id: ME, captain: true }]),
          coach: { steam_id: SOMEONE },
        },
      }),
    );
    await flushPromises();

    expect(refetches()).toBe(2);
  });

  it("are fetched again when another player joins, since the minimum lineup gates scheduling", async () => {
    signIn();
    await mountMatch(permissions());

    emitLive(live());
    await flushPromises();

    emitLive(
      live({
        lineup_2: lineup("lineup-2", [{ steam_id: SOMEONE, captain: false }]),
      }),
    );
    await flushPromises();

    expect(refetches()).toBe(1);
  });

  it("are fetched again when the organizer changes", async () => {
    signIn();
    await mountMatch(permissions());

    emitLive(live());
    await flushPromises();

    emitLive(live({ organizer_steam_id: ME }));
    await flushPromises();

    expect(refetches()).toBe(1);
  });

  it("are fetched again when a different viewer signs in", async () => {
    signIn();
    await mountMatch(permissions());

    emitLive(live());
    await flushPromises();

    signIn(SOMEONE);
    await flushPromises();

    expect(refetches()).toBe(1);
  });

  it("are still fetched again on a status change or a server assignment", async () => {
    signIn();
    await mountMatch(permissions());

    emitLive(live());
    await flushPromises();

    emitLive(live({ status: e_match_status_enum.Scheduled }));
    await flushPromises();

    expect(refetches()).toBe(1);

    emitLive(
      live({ status: e_match_status_enum.Scheduled, server_id: "server-1" }),
    );
    await flushPromises();

    expect(refetches()).toBe(2);
  });

  it("are not fetched again for a tick that changes none of that", async () => {
    signIn();
    await mountMatch(permissions());

    emitLive(live());
    await flushPromises();

    emitLive(live({ cancels_at: "2026-10-12T20:00:00Z" }));
    emitLive(
      live({
        lineup_1: lineup("lineup-1", []),
        is_server_online: true,
      }),
    );
    await flushPromises();

    expect(refetches()).toBe(0);
  });

  it("are not carried over to the next match while its own are loading", async () => {
    signIn();
    const wrapper = await mountMatch(permissions({ is_organizer: true }));

    emitLive(live());
    await flushPromises();

    expect((wrapper.vm as any).match.is_organizer).toBe(true);

    await useRouter().push(`/matches/${MATCH_B}`);
    await flushPromises();

    expect(staticFor(MATCH_B)).toHaveLength(1);

    emitLive(live({ id: MATCH_B }));
    await flushPromises();

    expect((wrapper.vm as any).match.id).toBe(MATCH_B);
    expect((wrapper.vm as any).match.is_organizer).toBeUndefined();
    expect(refetches()).toBe(0);

    answers[MATCH_B] = permissions({ id: MATCH_B });
    staticFor(MATCH_B)[0].observers.forEach((observer) =>
      observer.next({
        loading: false,
        data: { matches_by_pk: answers[MATCH_B] },
      }),
    );
    await flushPromises();

    expect((wrapper.vm as any).match.is_organizer).toBe(false);
  });

  it("are fetched once when several of those change in the same tick", async () => {
    signIn();
    await mountMatch(permissions());

    emitLive(live());
    await flushPromises();

    emitLive(
      live({
        status: e_match_status_enum.Scheduled,
        organizer_steam_id: ME,
        lineup_1: lineup("lineup-1", [{ steam_id: ME, captain: true }]),
      }),
    );
    await flushPromises();

    expect(refetches()).toBe(1);
  });

  it("count a placeholder player joining, but not the lineup re-sorting after a rename", async () => {
    signIn();
    await mountMatch(permissions());

    const players = [
      { steam_id: ME, captain: false },
      { steam_id: SOMEONE, captain: false },
    ];

    emitLive(live({ lineup_1: lineup("lineup-1", players) }));
    await flushPromises();

    emitLive(
      live({ lineup_1: lineup("lineup-1", [...players].reverse()) }),
    );
    await flushPromises();

    expect(refetches()).toBe(0);

    emitLive(
      live({
        lineup_1: lineup("lineup-1", [
          ...players,
          { steam_id: null, placeholder_name: "Ringer", captain: false },
        ]),
      }),
    );
    await flushPromises();

    expect(refetches()).toBe(1);
  });
});

describe("the match page's per-match fields", () => {
  function row(overrides: Record<string, unknown> = {}) {
    return { ...live(), ...permissions(), ...overrides };
  }

  it("follow every veto pick for a spectator", async () => {
    signIn();
    const match = row({
      status: e_match_status_enum.Veto,
      map_veto_type: "Ban",
    });
    const wrapper = await mountMatch(match);
    emitLive(match);
    await flushPromises();

    expect((wrapper.vm as any).match.map_veto_type).toBe("Ban");

    match.map_veto_type = "Pick";
    emitLive(match);
    await flushPromises();
    expect((wrapper.vm as any).match.map_veto_type).toBe("Pick");

    match.map_veto_type = "Side";
    emitLive(match);
    await flushPromises();
    expect((wrapper.vm as any).match.map_veto_type).toBe("Side");
  });

  it("re-read the lineup size when the organizer changes the match type", async () => {
    signIn();
    const match = row({
      options: { type: "Competitive", number_of_substitutes: 2, best_of: 1 },
      min_players_per_lineup: 5,
      max_players_per_lineup: 7,
    });
    const wrapper = await mountMatch(match);
    emitLive(match);
    await flushPromises();

    Object.assign(match, {
      options: { type: "Wingman", number_of_substitutes: 2, best_of: 1 },
      min_players_per_lineup: 2,
      max_players_per_lineup: 4,
    });
    emitLive(match);
    await flushPromises();

    expect((wrapper.vm as any).match.min_players_per_lineup).toBe(2);
    expect((wrapper.vm as any).match.max_players_per_lineup).toBe(4);
  });

  it("re-read the lineup size when the substitutes change", async () => {
    signIn();
    const match = row({
      options: { type: "Competitive", number_of_substitutes: 2, best_of: 1 },
      max_players_per_lineup: 7,
    });
    const wrapper = await mountMatch(match);
    emitLive(match);
    await flushPromises();

    Object.assign(match, {
      options: { type: "Competitive", number_of_substitutes: 0, best_of: 1 },
      max_players_per_lineup: 5,
    });
    emitLive(match);
    await flushPromises();

    expect((wrapper.vm as any).match.max_players_per_lineup).toBe(5);
  });

  it("give a newly added tournament organizer their controls", async () => {
    signIn();
    const bracket = (organizers: string[]) => [
      {
        stage: {
          tournament: {
            id: "t-1",
            name: "Autumn Cup",
            organizers: organizers.map((steam_id) => ({ steam_id })),
          },
        },
      },
    ];
    const match = row({ tournament_brackets: bracket([]) });
    const wrapper = await mountMatch(match);
    emitLive(match);
    await flushPromises();

    expect((wrapper.vm as any).matchContext.tournament).toEqual({
      id: "t-1",
      name: "Autumn Cup",
    });

    Object.assign(match, { tournament_brackets: bracket([SOMEONE]) });
    emitLive(match);
    await flushPromises();
    expect(refetches()).toBe(0);

    Object.assign(match, {
      tournament_brackets: bracket([SOMEONE, ME]),
      is_organizer: true,
    });
    emitLive(match);
    await flushPromises();

    expect(refetches()).toBe(1);
    expect((wrapper.vm as any).match.is_organizer).toBe(true);
  });

  it("are fetched once more after a role change, once the api has caught up", async () => {
    signIn(ME, "user");
    const match = row();
    await mountMatch(match);
    emitLive(match);
    await flushPromises();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      signIn(ME, "match_organizer");
      await flushPromises();
      expect(refetches()).toBe(1);

      vi.advanceTimersByTime(5000);
      await flushPromises();
      expect(refetches()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
