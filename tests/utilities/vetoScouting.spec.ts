// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  scoutHabit,
  scoutLikely,
  type ScoutLineup,
} from "~/utilities/vetoScouting";

const lineup = (
  vetoes: number,
  maps: Record<string, { bans?: number; picks?: number }>,
): ScoutLineup => ({
  source: "team",
  owner: "Night Owls",
  vetoes,
  maps: Object.fromEntries(
    Object.entries(maps).map(([id, map]) => [
      id,
      { wins: 0, played: 0, bans: map.bans ?? 0, picks: map.picks ?? 0 },
    ]),
  ),
});

describe("scoutHabit", () => {
  it("calls a map a usual ban once it is banned in half the vetoes", () => {
    expect(scoutHabit(lineup(10, { train: { bans: 5 } }), "train")).toEqual({
      kind: "ban",
      n: 5,
      of: 10,
    });
    expect(scoutHabit(lineup(10, { train: { bans: 4 } }), "train")).toBeNull();
  });

  it("calls a map a usual pick at 40% of vetoes", () => {
    expect(scoutHabit(lineup(10, { nuke: { picks: 4 } }), "nuke")).toEqual({
      kind: "pick",
      n: 4,
      of: 10,
    });
  });

  it("says nothing until there are three vetoes behind it", () => {
    expect(scoutHabit(lineup(2, { train: { bans: 2 } }), "train")).toBeNull();
  });

  it("says nothing without history", () => {
    expect(scoutHabit(null, "train")).toBeNull();
    expect(scoutHabit(lineup(10, {}), "train")).toBeNull();
  });
});

describe("scoutLikely", () => {
  const owls = lineup(10, {
    train: { bans: 8 },
    dust2: { bans: 4 },
    nuke: { picks: 6 },
    mirage: { picks: 2 },
  });

  it("guesses the open map they ban most", () => {
    expect(scoutLikely(owls, "Ban", ["dust2", "train", "nuke"])).toEqual({
      mapId: "train",
      n: 8,
      of: 10,
    });
  });

  it("moves on once that map is gone", () => {
    expect(scoutLikely(owls, "Ban", ["dust2", "nuke"])?.mapId).toBe("dust2");
  });

  it("guesses picks from picks", () => {
    expect(scoutLikely(owls, "Pick", ["mirage", "nuke"])?.mapId).toBe("nuke");
  });

  it("stays quiet below 30%", () => {
    expect(scoutLikely(owls, "Pick", ["mirage"])).toBeNull();
  });

  it("stays quiet without enough vetoes", () => {
    expect(
      scoutLikely(lineup(2, { train: { bans: 2 } }), "Ban", ["train"]),
    ).toBeNull();
  });
});
