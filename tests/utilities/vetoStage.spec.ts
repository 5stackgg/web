import { describe, expect, it } from "vitest";
import {
  vetoBoardUp,
  vetoStarting,
  vetoStartMaps,
} from "~/utilities/vetoStage";

const MIRAGE = { id: "mirage" };
const NUKE = { id: "nuke" };
const ANCIENT = { id: "ancient" };

// A best of three straight out of its veto, its server still booting.
function match(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    status: "Live",
    is_server_online: false,
    server_type: "OnDemand",
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    options: { map_veto: true, best_of: 3, knife_round: true },
    match_maps: [
      {
        order: 2,
        map: NUKE,
        status: "Scheduled",
        lineup_1_side: "CT",
        lineup_2_side: "TERRORIST",
      },
      {
        order: 1,
        map: MIRAGE,
        status: "Scheduled",
        lineup_1_side: "TERRORIST",
        lineup_2_side: "CT",
      },
      {
        order: 3,
        map: ANCIENT,
        status: "Scheduled",
        lineup_1_side: "CT",
        lineup_2_side: "TERRORIST",
      },
    ],
    ...overrides,
  };
}

describe("vetoStarting", () => {
  it("holds the stage while the server boots", () => {
    expect(vetoStarting(match())).toBe(true);
    expect(vetoStarting(match({ status: "WaitingForServer" }))).toBe(true);
    expect(vetoBoardUp(match())).toBe(true);
  });

  it("lets go once the server is up or the first map has started", () => {
    expect(vetoStarting(match({ is_server_online: true }))).toBe(false);
    const maps = match().match_maps.map((map) =>
      map.order === 1 ? { ...map, status: "Live" } : map,
    );
    expect(vetoStarting(match({ match_maps: maps }))).toBe(false);
    expect(vetoBoardUp(match({ is_server_online: true }))).toBe(false);
  });

  it("is not for dedicated servers, unfinished vetoes or no veto", () => {
    expect(vetoStarting(match({ server_type: "Dedicated" }))).toBe(false);
    expect(
      vetoStarting(match({ match_maps: match().match_maps.slice(0, 2) })),
    ).toBe(false);
    const noVeto = match({ options: { map_veto: false, best_of: 3 } });
    expect(vetoStarting(noVeto)).toBe(false);
    expect(vetoBoardUp({ ...noVeto, status: "Veto" })).toBe(false);
  });
});

describe("vetoStartMaps", () => {
  it("lays the series out in order with who picked it and the sides", () => {
    const picks = [
      { type: "Ban", map: { id: "train" }, match_lineup_id: "l1" },
      { type: "Pick", map: MIRAGE, match_lineup_id: "l1" },
      { type: "Side", map: MIRAGE, match_lineup_id: "l2", side: "CT" },
      { type: "Pick", map: NUKE, match_lineup_id: "l2" },
      { type: "Side", map: NUKE, match_lineup_id: "l1", side: "CT" },
      { type: "Decider", map: ANCIENT, match_lineup_id: "l1" },
    ];

    expect(vetoStartMaps(match(), picks)).toEqual([
      {
        itemId: "mirage",
        decider: false,
        pickedBy: 1,
        sides: { 1: "T", 2: "CT" },
      },
      {
        itemId: "nuke",
        decider: false,
        pickedBy: 2,
        sides: { 1: "CT", 2: "T" },
      },
      // A knife round settles the decider's sides.
      { itemId: "ancient", decider: true, pickedBy: null, sides: null },
    ]);

    const noKnife = match({
      options: { map_veto: true, best_of: 3, knife_round: false },
    });
    expect(vetoStartMaps(noKnife, picks)[2].sides).toEqual({
      1: "CT",
      2: "T",
    });
  });
});
