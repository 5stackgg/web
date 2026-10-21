// @vitest-environment node
import { describe, expect, it } from "vitest";
import { demoRewindRounds } from "~/utilities/demoMatch";
import {
  canRewindTo,
  playersAtStartOf,
  rewindSummary,
  scoreBefore,
} from "~/utilities/rewind";

describe("the demo match's rounds", () => {
  const live = demoRewindRounds();

  it("is 9-7 going into round 17", () => {
    expect(live.live_round).toBe(17);
    expect(scoreBefore(live, 17)).toEqual([9, 7]);
  });

  it("has no backup to start round 1 from", () => {
    expect(canRewindTo(live, 1)).toBe(false);
    expect(canRewindTo(live, 2)).toBe(true);
    expect(canRewindTo(live, 17)).toBe(true);
  });

  it("starts round N from the backup taken after round N - 1", () => {
    const round16 = live.rounds.find((row) => row.round === 15)!.players;
    expect(playersAtStartOf(live, 16)).toBe(round16);
    expect(playersAtStartOf(live, 1)).toEqual([]);
  });

  it("counts what going back throws away, the round in progress included", () => {
    expect(rewindSummary(live, 16, 3, 380)).toEqual({
      direction: "back",
      from: 16,
      to: 16,
      kills: 12,
      damage: 1512,
    });
    expect(rewindSummary(live, 17, 3, 380)).toMatchObject({
      direction: "replay",
      kills: 3,
      damage: 380,
    });
  });

  it("counts what going forward brings back", () => {
    const restored = demoRewindRounds({ live: 14, undoneFrom: 14 });
    expect(
      restored.rounds.filter((row) => row.undone).map((row) => row.round),
    ).toEqual([14, 15, 16]);
    expect(scoreBefore(restored, 14)).toEqual([7, 6]);
    expect(rewindSummary(restored, 17)).toMatchObject({
      direction: "forward",
      from: 14,
      to: 16,
      kills: 25,
    });
  });

  it("holds the restore until the dropped player is back", () => {
    const waiting = demoRewindRounds({ connected: false });
    expect(waiting.connected_players).toBeLessThan(waiting.expected_players);
    expect(waiting.disconnected).toEqual(["tomek"]);
  });
});
