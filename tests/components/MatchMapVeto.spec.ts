import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import VetoBoard from "~/components/match/VetoBoard.vue";
import { useVetoHandoff } from "~/composables/useVetoHandoff";

const POOL = [
  "ancient",
  "anubis",
  "dust2",
  "inferno",
  "mirage",
  "nuke",
  "train",
];

const lineup = (id: string, steamId: string) => ({
  id,
  name: id,
  can_pick_map_veto: false,
  is_picking_map_veto: false,
  lineup_players: [{ steam_id: steamId, captain: true, player: {} }],
});

const matchMap = (order: number, id: string, l1: string, l2: string) => ({
  id: `mm-${order}`,
  order,
  status: "Scheduled",
  map: { id, name: id, label: id },
  lineup_1_side: l1,
  lineup_2_side: l2,
});

// A best of three straight out of its veto, its server booting.
function match(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-1",
    status: "Live",
    is_server_online: false,
    server_type: "OnDemand",
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    lineup_1: lineup("l1", "1"),
    lineup_2: lineup("l2", "2"),
    map_veto_type: null,
    options: {
      type: "Custom",
      map_veto: true,
      region_veto: false,
      best_of: 3,
      knife_round: false,
      veto_pick_timeout: 0,
      map_pool: { maps: POOL.map((id) => ({ id, name: id, label: id })) },
    },
    match_maps: [
      matchMap(1, "mirage", "TERRORIST", "CT"),
      matchMap(2, "nuke", "CT", "TERRORIST"),
      matchMap(3, "ancient", "CT", "TERRORIST"),
    ],
    ...overrides,
  };
}

const board = (wrapper: any) => wrapper.findComponent(VetoBoard);

afterEach(() => {
  useVetoHandoff().value = null;
});

describe("MatchMapVeto start stage", () => {
  it("stays up as the start stage while the server boots", async () => {
    const wrapper = await mountSuspended(MatchMapVeto, {
      props: { match: match(), matchId: "match-1" },
    });

    expect(board(wrapper).exists()).toBe(true);
    expect(board(wrapper).props("start").phase).toBe("booting");
    expect(
      board(wrapper)
        .props("start")
        .maps.map((map: any) => map.itemId),
    ).toEqual(["mirage", "nuke", "ancient"]);
    expect(useVetoHandoff().value).toEqual({
      matchId: "match-1",
      phase: "stage",
    });
  });

  it("says ready, then hands the maps over and folds", async () => {
    const wrapper = await mountSuspended(MatchMapVeto, {
      props: { match: match(), matchId: "match-1" },
    });

    await wrapper.setProps({
      match: match({ is_server_online: true }),
    } as Record<string, unknown>);
    expect(board(wrapper).props("start").phase).toBe("ready");

    board(wrapper).vm.$emit("handoff");
    await wrapper.vm.$nextTick();
    expect(useVetoHandoff().value?.phase).toBe("arriving");
    expect(board(wrapper).exists()).toBe(false);

    await new Promise((done) => setTimeout(done, 600));
    expect(useVetoHandoff().value).toBeNull();
  });

  it("keeps the finished veto up in the draft room, which leaves before the server boots", async () => {
    const wrapper = await mountSuspended(MatchMapVeto, {
      props: {
        match: match(),
        matchId: "match-1",
        stage: false,
      },
    });

    expect(board(wrapper).exists()).toBe(true);
    expect(board(wrapper).props("start")).toBeNull();
    expect(useVetoHandoff().value).toBeNull();
  });

  it("is not shown once the server is up on the match page", async () => {
    const wrapper = await mountSuspended(MatchMapVeto, {
      props: { match: match({ is_server_online: true }), matchId: "match-1" },
    });

    expect(board(wrapper).exists()).toBe(false);
  });
});
