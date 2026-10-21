// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  defaultRestoreRound,
  roundsFromMatchMap,
  sidesIn,
  toRewindRounds,
  vetoTimelineSteps,
  type RewindRounds,
} from "~/utilities/rewind";

describe("the Rounds tab's data", () => {
  it("draws getMatchRestoreRounds, finished once no round is in progress", () => {
    const rounds = toRewindRounds(
      {
        map_name: "de_mirage",
        restorable: true,
        blocked_reason: null,
        live_round: null,
        economy_hidden: false,
        connected_players: 10,
        expected_players: 10,
        disconnected: [],
        rounds: [
          {
            round: 1,
            lineup_1_score: 1,
            lineup_2_score: 0,
            lineup_1_side: "CT",
            lineup_2_side: "TERRORIST",
            winning_side: "CT",
            winning_reason: "CTsWin",
            has_backup: true,
            undone: false,
            players: [
              {
                steam_id: "1",
                name: "vexa",
                lineup: 2,
                cash: 800,
                armor: 0,
                helmet: false,
                alive: true,
                weapons: [],
                kills: 0,
                deaths: 0,
              },
            ],
          },
        ],
      },
      15,
    );

    expect(rounds).toMatchObject({
      live_round: 2,
      finished: true,
      halftime: 15,
      regulation: 30,
    });
    expect(rounds.rounds[0].players[0].lineup).toBe(2);
    expect(rounds.rounds[0].kills).toBe(0);
  });

  it("draws a map's own rounds for everyone else, in order", () => {
    const rounds = roundsFromMatchMap(
      {
        map: { name: "de_ancient" },
        rounds: [
          {
            round: 2,
            winning_side: "TERRORIST",
            lineup_1_score: 1,
            lineup_2_score: 1,
          },
          { round: 0, winning_side: null },
          {
            round: 1,
            winning_side: "CT",
            lineup_1_score: 1,
            lineup_2_score: 0,
          },
        ],
      },
      12,
      true,
    );

    expect(rounds.rounds.map((row) => row.round)).toEqual([1, 2]);
    expect(rounds.live_round).toBe(3);
    expect(rounds.finished).toBe(false);
    expect(rounds.rounds.every((row) => !row.has_backup)).toBe(true);
  });
});

describe("the veto timeline", () => {
  it("names each taken step's map and keeps who actually took it", () => {
    const steps = vetoTimelineSteps(
      [
        { type: "Ban", lineup: 1, record: { itemId: "a", lineup: 2 } },
        {
          type: "Side",
          lineup: 2,
          record: { itemId: "b", lineup: 2, side: "CT" },
        },
        { type: "Ban", lineup: 1, record: null },
      ],
      (id) => (id === "a" ? "de_nuke" : "de_mirage"),
    );

    expect(steps).toEqual([
      { step: 1, type: "Ban", lineup: 2, map: "de_nuke", side: undefined },
      { step: 2, type: "Side", lineup: 2, map: "de_mirage", side: "CT" },
      { step: 3, type: "Ban", lineup: 1, map: "", side: undefined },
    ]);
  });
});

describe("the sides a round is played on", () => {
  const map = (
    played: number,
    over: Partial<RewindRounds> = {},
    side = (round: number) => (round <= 12 ? "CT" : "TERRORIST"),
  ) =>
    ({
      ...roundsFromMatchMap(
        {
          map: { name: "de_mirage" },
          lineup_1_side: "CT",
          rounds: Array.from({ length: played }, (_, index) => ({
            round: index + 1,
            lineup_1_side: side(index + 1),
            lineup_2_side: side(index + 1) === "CT" ? "TERRORIST" : "CT",
            winning_side: "CT",
          })),
        },
        12,
        true,
      ),
      ...over,
    }) as RewindRounds;

  it("reads a played round's sides from what was recorded", () => {
    const data = map(13, {}, () => "TERRORIST");

    expect(sidesIn(data, 5)).toEqual({ lineup1: "TERRORIST", lineup2: "CT" });
  });

  it("swaps an unplayed round at halftime from the side lineup 1 started on", () => {
    const data = map(3);

    expect(sidesIn(data, 4)).toEqual({ lineup1: "CT", lineup2: "TERRORIST" });
    expect(sidesIn(data, 13)).toEqual({ lineup1: "TERRORIST", lineup2: "CT" });
  });

  it("swaps halfway through each overtime like the api does", () => {
    const data = map(0);

    expect(sidesIn(data, 25).lineup1).toBe("TERRORIST");
    expect(sidesIn(data, 28).lineup1).toBe("CT");
    expect(sidesIn(data, 31).lineup1).toBe("CT");
    expect(sidesIn(data, 34).lineup1).toBe("TERRORIST");
  });

  it("never swaps in modes without halves", () => {
    const data = map(0, { swaps: false });

    expect(sidesIn(data, 20).lineup1).toBe("CT");
  });
});

describe("the round a preview opens on", () => {
  const data = (backups: boolean[]) =>
    ({
      live_round: backups.length + 1,
      rounds: backups.map((has_backup, index) => ({
        round: index + 1,
        has_backup,
      })),
    }) as unknown as RewindRounds;

  it("is the round being played when it can be replayed", () => {
    expect(defaultRestoreRound(data([true, true, true]))).toBe(4);
  });

  it("is the latest earlier round with a backup otherwise", () => {
    expect(defaultRestoreRound(data([true, true, false]))).toBe(3);
    expect(defaultRestoreRound(data([false, false, false]))).toBeNull();
  });
});
