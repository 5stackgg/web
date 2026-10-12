// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildStageFrame } from "~/utilities/replayStage/frame";
import type { StageBlob } from "~/utilities/replayStage/frameIndex";
import { buildOverlayFrame } from "~/utilities/replayStage/overlayFrame";

const A = "76561190000000001";
const B = "76561190000000002";

function position(
  round: number,
  id: string,
  team: string,
  tick: number,
  x: number,
  extra = {},
) {
  return {
    round,
    tick,
    attacker_steam_id: id,
    attacker_team: team,
    alive: true,
    x,
    y: 0,
    z: 0,
    yaw: 90,
    health: 100,
    ...extra,
  };
}

/** Two rounds whose freeze times end at different ticks; sides swap. */
function blob(extra: Partial<StageBlob> = {}): StageBlob {
  return {
    schema_version: 11,
    match_map_id: "m",
    tick_rate: 64,
    total_ticks: 20000,
    map_name: "de_mirage",
    round_ticks: [
      { round: 1, start_tick: 0, freeze_end_tick: 640, end_tick: 5000 },
      { round: 2, start_tick: 5000, freeze_end_tick: 6280, end_tick: 10000 },
    ],
    players: [],
    kills: [{ tick: 1600, killer: B, victim: A }],
    bombs: [],
    positions: [
      position(1, A, "t", 640, 0),
      position(1, A, "t", 1920, 1000),
      position(1, B, "ct", 640, 5000),
      position(1, B, "ct", 4000, 5000),
      position(2, A, "ct", 6280, 100),
      position(2, A, "ct", 7560, 300),
      position(2, B, "t", 6280, 7000),
      position(2, B, "t", 9000, 7000),
    ],
    shots_fired: [],
    grenade_throws: [
      {
        round: 2,
        tick: 6400,
        grenade_id: 5,
        thrower_steam_id: B,
        thrower_team: "t",
        type: "Smoke",
        phase: "thrown",
        x: 7000,
        y: 0,
        z: 0,
      },
      {
        round: 2,
        tick: 6600,
        grenade_id: 5,
        thrower_steam_id: B,
        thrower_team: "t",
        type: "Smoke",
        phase: "detonated",
        x: 6000,
        y: 0,
        z: 0,
      },
    ],
    damages: [],
    ...extra,
  };
}

describe("buildOverlayFrame", () => {
  it("stands every round's living players at the same time after freeze", () => {
    const frame = buildOverlayFrame(blob(), [2, 1], 10);
    expect(frame.time).toBe(10);
    expect(frame.players).toHaveLength(0);
    expect(frame.overlay!.rounds).toEqual([1, 2]);
    // Round 1, 10s in: A has walked halfway to 1000 (20s), B holds; round 2
    // 10s in: A halfway to 300.
    const at = Object.fromEntries(
      frame.overlay!.actors.map((a) => [a.key, [a.team, Math.round(a.x)]]),
    );
    expect(at).toEqual({
      [`1:${A}`]: ["t", 500],
      [`1:${B}`]: ["ct", 5000],
      [`2:${A}`]: ["ct", 200],
      [`2:${B}`]: ["t", 7000],
    });
    expect(frame.overlay!.actors[0].yaw).toBe(90);
  });

  it("drops the dead and the filtered-out team", () => {
    // A died in round 1 at 15s.
    const late = buildOverlayFrame(blob(), [1, 2], 16);
    expect(late.overlay!.actors.map((a) => a.key)).not.toContain(`1:${A}`);
    const onlyA = buildOverlayFrame(blob(), [1, 2], 10, {
      include: new Set([A]),
    });
    expect(onlyA.overlay!.actors.map((a) => a.key)).toEqual([
      `1:${A}`,
      `2:${A}`,
    ]);
  });

  it("lays the utility gone off so far as heatmap discs", () => {
    const b = blob();
    expect(buildOverlayFrame(b, [1, 2], 4).heat).toBeUndefined();
    const heat = buildOverlayFrame(b, [1, 2], 6).heat!;
    expect(heat.map((h) => [h.gid, h.type, h.at.x])).toEqual([
      [5, "smoke", 6000],
    ]);
    expect(buildOverlayFrame(b, [1, 2], 7).heat).toBe(heat);
    expect(
      buildOverlayFrame(b, [1, 2], 6, { include: new Set([A]) }).heat,
    ).toBeUndefined();
    expect(
      buildOverlayFrame(b, [1, 2], 6, { utility: { smoke: false } }).heat,
    ).toBeUndefined();
  });

  it("joins the rounds' walks into one set of tails, named by round", () => {
    const b = blob();
    const trails = buildOverlayFrame(b, [1, 2], 10, { tail: 5 }).trails!;
    expect(trails.tail).toBe(5);
    // Round 1's A walked to where they died; the other samples are too far
    // apart in time to join.
    expect(trails.strips.map((s) => s.id)).toEqual([`1:${A}`]);
    expect(Array.from(trails.points.slice(-4))).toEqual([750, 0, 3, 15]);
    expect(buildOverlayFrame(b, [1, 2], 12, { tail: 5 }).trails).toBe(trails);
  });
});

describe("planted bomb countdown", () => {
  it("counts the fuse down on the planted bomb, and ends with a defuse", () => {
    const b = blob({
      bombs: [
        { tick: 1000, type: "planted", player: A, x: 10, y: 20, z: 0 },
        { tick: 1000 + 64 * 30, type: "defused", player: B },
      ],
    });
    const planted = buildStageFrame(b, 1, 1000 + 64 * 5).ground!;
    expect(planted).toMatchObject([{ kind: "planted", age: 5, timer: 36 }]);
    expect(buildStageFrame(b, 1, 1000 + 64 * 31).ground).toBeUndefined();
  });
});
