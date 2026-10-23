import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import MatchPage from "~/pages/matches/[id]/index.vue";
import { e_match_status_enum } from "~/generated/zeus";

const MATCH = "11111111-1111-4111-8111-111111111111";

type Observer = { next: (result: any) => void };

let live: Observer | null = null;
let liveQuery: any = null;
let mounted: { unmount: () => void } | null = null;

const field = (selections: any[], name: string) =>
  selections.find((selection: any) => selection.name.value === name);
const names = (selection: any) =>
  selection.selectionSet.selections.map((s: any) => s.name.value);

// A moderator reads the whole match on one subscription, which is what these
// pin; signed-in players and visitors read it split (sharedLive.spec.ts).
async function mountMatch() {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role: "moderator",
  } as any;
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);

  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: Observer) {
      const root = options.query.definitions[0].selectionSet.selections[0];
      if (root.name.value === "matches_by_pk") {
        live = observer;
        liveQuery = options.query;
      }
      return { unsubscribe() {}, closed: false };
    },
  }));
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

afterEach(() => {
  useAuthStore().me = undefined;
  mounted?.unmount();
  mounted = null;
  live = null;
  liveQuery = null;
  vi.restoreAllMocks();
});

const kill = (round: number, victim: string) => ({
  round,
  with: "ak47",
  headshot: false,
  player: { steam_id: "1" },
  attacked_player: { steam_id: victim },
});

const round = (n: number) => ({
  round: n,
  lineup_1_score: n,
  lineup_2_score: 0,
});

// The event tables are hypertables: read through each round, a map's kills
// were looked up once per round in every chunk.
describe("the match page's rounds", () => {
  it("read each map's kills and assists once instead of once per round", async () => {
    await mountMatch();

    const match = liveQuery.definitions[0].selectionSet.selections[0];
    const maps = field(match.selectionSet.selections, "match_maps");
    const rounds = field(maps.selectionSet.selections, "rounds");

    expect(names(maps)).toEqual(
      expect.arrayContaining(["player_kills", "player_assists"]),
    );
    expect(names(field(maps.selectionSet.selections, "player_kills"))).toEqual([
      "round",
      "with",
      "headshot",
      "player",
      "attacked_player",
    ]);
    expect(names(rounds)).not.toContain("kills");
    expect(names(rounds)).not.toContain("assists");
  });

  it("hand each round its own kills in time order, and its assists", async () => {
    const wrapper = await mountMatch();

    live!.next({
      data: {
        matches_by_pk: {
          id: MATCH,
          status: e_match_status_enum.Finished,
          options: { best_of: 1 },
          streams: [],
          lineup_1: { id: "l1", lineup_players: [] },
          lineup_2: { id: "l2", lineup_players: [] },
          match_maps: [
            {
              id: "map-1",
              rounds: [round(3), round(2), round(1)],
              player_kills: [
                kill(1, "a"),
                kill(2, "b"),
                kill(1, "c"),
                kill(9, "z"),
              ],
              player_assists: [
                {
                  round: 2,
                  attacker_steam_id: "1",
                  attacked_steam_id: "b",
                  flash: true,
                },
              ],
            },
          ],
        },
      },
    });
    await flushPromises();

    const [map] = (wrapper.vm as any).matchLive.match_maps;
    const { round: _, ...a } = kill(1, "a");
    const { round: __, ...b } = kill(2, "b");
    const { round: ___, ...c } = kill(1, "c");

    expect(map).not.toHaveProperty("player_kills");
    expect(map).not.toHaveProperty("player_assists");
    expect(map.rounds).toEqual([
      { ...round(3), kills: [], assists: [] },
      {
        ...round(2),
        kills: [b],
        assists: [
          { attacker_steam_id: "1", attacked_steam_id: "b", flash: true },
        ],
      },
      { ...round(1), kills: [a, c], assists: [] },
    ]);
  });
});
