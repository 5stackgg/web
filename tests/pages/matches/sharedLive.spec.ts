import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import MatchPage from "~/pages/matches/[id]/index.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_match_status_enum } from "~/generated/zeus";

const MATCH = "11111111-1111-4111-8111-111111111111";
const ME = "76561198000000001";

type Observer = { next: (result: any) => void };
type Live = { client: string; query: any; observer: Observer; context: any };

let lives: Live[] = [];
let mounted: { unmount: () => void } | null = null;

const root = (query: any) => query.definitions[0].selectionSet.selections[0];
const names = (selection: any) =>
  selection.selectionSet.selections.map((s: any) => s.name.value);
const child = (selection: any, name: string) =>
  selection.selectionSet.selections.find((s: any) => s.name.value === name);
const on = (client: string) => lives.filter((live) => live.client === client);

function spySubscriptions(name: "default" | "public") {
  const client = (useApollo().clients as Record<string, any>)[name];
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: Observer) {
      if (root(options.query).name.value === "matches_by_pk") {
        lives.push({
          client: name,
          query: options.query,
          observer,
          context: options.context ?? null,
        });
      }
      return { unsubscribe() {}, closed: false };
    },
  }));
}

async function mountMatch(role?: string) {
  useAuthStore().me = role ? ({ steam_id: ME, role } as any) : undefined;
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);
  spySubscriptions("default");
  spySubscriptions("public");
  vi.spyOn(client, "watchQuery").mockImplementation(
    () =>
      ({
        getCurrentResult: () => ({ loading: true, data: undefined }),
        subscribe: () => ({ closed: false, unsubscribe() {} }),
        refetch: () => Promise.resolve({}),
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

async function emit(live: Live, match: Record<string, unknown> | null) {
  live.observer.next({ data: { matches_by_pk: match } });
  await flushPromises();
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  lives = [];
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

const PERSONAL = [
  "id",
  "invite_code",
  "draft_games",
  "can_start",
  "can_check_in",
  "tournament_brackets",
  "connection_link",
  "connection_string",
  "tv_connection_string",
  "lineup_1",
  "lineup_2",
];
const PERSONAL_LINEUP = [
  "id",
  "is_on_lineup",
  "can_pick_map_veto",
  "can_pick_region_veto",
  "can_update_lineup",
];

function shared(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH,
    status: e_match_status_enum.Live,
    options: { best_of: 1 },
    match_maps: [],
    streams: [],
    lineup_1: { id: "l1", name: "Buttah Boyz", lineup_players: [] },
    lineup_2: { id: "l2", name: "Saint's Team", lineup_players: [] },
    ...overrides,
  };
}

function personal(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH,
    invite_code: "abc",
    draft_games: [],
    can_start: false,
    can_check_in: true,
    tournament_brackets: [],
    connection_link: "steam://connect/1",
    connection_string: "connect 1",
    tv_connection_string: null,
    lineup_1: {
      id: "l1",
      is_on_lineup: true,
      can_pick_map_veto: false,
      can_pick_region_veto: false,
      can_update_lineup: true,
    },
    lineup_2: {
      id: "l2",
      is_on_lineup: false,
      can_pick_map_veto: false,
      can_pick_region_veto: false,
      can_update_lineup: false,
    },
    ...overrides,
  };
}

// Everyone watching a match reads the same rounds, kills and lineups, so a
// signed-in player reads them as a guest and shares one Hasura poll with every
// other viewer. What differs per viewer comes from a small subscription of
// their own.
describe("the match page for a signed-in player", () => {
  it("reads the match as a guest and only the viewer's own fields on their session", async () => {
    await mountMatch("user");

    expect(on("public")).toHaveLength(1);
    expect(on("default")).toHaveLength(1);
    const guest = root(on("public")[0].query);
    const mine = root(on("default")[0].query);

    expect(names(guest)).toEqual(
      expect.arrayContaining(["status", "match_maps", "lineup_1", "streams"]),
    );
    for (const field of PERSONAL.filter((f) => !/^(id|lineup_)/.test(f))) {
      expect(names(guest)).not.toContain(field);
    }
    for (const field of PERSONAL_LINEUP.slice(1)) {
      expect(names(child(guest, "lineup_1"))).not.toContain(field);
    }
    expect(names(mine)).toEqual(PERSONAL);
    expect(names(child(mine, "lineup_1"))).toEqual(PERSONAL_LINEUP);
    expect(names(child(mine, "lineup_2"))).toEqual(PERSONAL_LINEUP);
  });

  it("shows the match once both halves are in, with the viewer's own fields on it", async () => {
    const wrapper = await mountMatch("user");

    await emit(on("public")[0], shared());
    expect((wrapper.vm as any).matchLive).toBeUndefined();

    await emit(on("default")[0], personal());
    expect((wrapper.vm as any).matchLive).toMatchObject({
      status: e_match_status_enum.Live,
      can_check_in: true,
      connection_string: "connect 1",
      lineup_1: { id: "l1", name: "Buttah Boyz", is_on_lineup: true },
      lineup_2: { id: "l2", name: "Saint's Team", is_on_lineup: false },
    });

    await emit(on("public")[0], shared({ status: e_match_status_enum.Veto }));
    expect((wrapper.vm as any).matchLive).toMatchObject({
      status: e_match_status_enum.Veto,
      can_check_in: true,
    });
  });

  it("hands each round its kills on the split path too", async () => {
    const wrapper = await mountMatch("user");
    const kill = { round: 1, with: "ak47", headshot: true, player: null };

    await emit(
      on("public")[0],
      shared({
        match_maps: [
          {
            id: "map-1",
            rounds: [{ round: 1 }],
            player_kills: [kill],
            player_assists: [],
          },
        ],
      }),
    );
    await emit(on("default")[0], personal());

    const [map] = (wrapper.vm as any).matchLive.match_maps;
    const { round: _, ...withoutRound } = kill;
    expect(map).not.toHaveProperty("player_kills");
    expect(map.rounds).toEqual([
      { round: 1, kills: [withoutRound], assists: [] },
    ]);
  });

  // Leaving the page (a deleted match, a draft room) is the socket's call.
  it("seeds only answers that can't send the viewer away", async () => {
    await mountMatch("user");
    const guest = on("public")[0].context.seed;
    const mine = on("default")[0].context.seed;

    expect(guest({ matches_by_pk: shared() })).toBe(true);
    expect(guest({ matches_by_pk: null })).toBe(false);
    expect(mine({ matches_by_pk: personal() })).toBe(true);
    expect(mine({ matches_by_pk: null })).toBe(false);
    expect(
      mine({ matches_by_pk: personal({ draft_games: [{ id: "draft-1" }] }) }),
    ).toBe(false);
  });

  // A match still picking players is hidden from guests but not from its
  // players: the page reads it the old way, on the viewer's session.
  it("reads a match a guest can't see on the viewer's own session", async () => {
    const wrapper = await mountMatch("user");

    await emit(on("public")[0], null);
    await emit(on("default")[0], personal());

    expect((wrapper.vm as any).matchLive).toBeUndefined();
    const full = on("default").filter((live) =>
      names(root(live.query)).includes("match_maps"),
    );
    expect(full).toHaveLength(1);

    await emit(full[0], {
      ...shared(),
      ...personal(),
      status: e_match_status_enum.PickingPlayers,
    });
    expect((wrapper.vm as any).matchLive).toMatchObject({
      status: e_match_status_enum.PickingPlayers,
      can_check_in: true,
    });
  });

  it("lets the match go when it is gone", async () => {
    const wrapper = await mountMatch("user");
    await emit(on("public")[0], shared());
    await emit(on("default")[0], personal());
    expect((wrapper.vm as any).matchLive).toBeTruthy();

    await emit(on("default")[0], null);

    expect((wrapper.vm as any).matchLive).toBeNull();
  });
});

// A signed-out visitor is a guest on both halves, so they share the poll with
// everyone else and their guest fields are read once for all of them.
describe("the match page for a signed-out visitor", () => {
  it("reads the shared match as a guest, with the guest fields beside it", async () => {
    await mountMatch(undefined);

    expect(on("public")).toHaveLength(1);
    expect(on("default")).toHaveLength(1);
    expect(names(root(on("default")[0].query))).toEqual(PERSONAL);
  });
});

describe("the match page for everyone else", () => {
  it.each([
    ["a moderator", "moderator"],
    ["an administrator", "administrator"],
  ])("reads the whole match on one subscription for %s", async (_, role) => {
    await mountMatch(role);

    expect(on("public")).toHaveLength(0);
    expect(on("default")).toHaveLength(1);
    expect(names(root(on("default")[0].query))).toEqual(
      expect.arrayContaining(["status", "match_maps", "can_start"]),
    );
  });
});
