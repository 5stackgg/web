// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  angleBetween,
  buildVisionGrid,
  castRay,
  castSmoke,
  eyeHeight,
  floorBelow,
  inView,
  sightClear,
} from "~/utilities/replayStage/visionCast";
import type { VisionSmoke } from "~/utilities/replayStage/visionCast";
import { buildStageFrame } from "~/utilities/replayStage/frame";
import type { StageBlob } from "~/utilities/replayStage/frameIndex";
import {
  VISION_PAST_COUNT,
  VISION_PAST_STEP,
  VISION_POSE,
} from "~/utilities/replayStage/visionFrame";

/** Two triangles spanning an axis-aligned rectangle. */
function quad(
  out: number[],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
) {
  out.push(...a, ...b, ...c, ...a, ...c, ...d);
}

/** A closed box, as a collision hull models a crate or a post. */
function box(
  out: number[],
  [x0, y0, z0]: [number, number, number],
  [x1, y1, z1]: [number, number, number],
) {
  quad(out, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]);
  quad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  quad(out, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  quad(out, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
  quad(out, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]);
  quad(out, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
}

/**
 * A floor 2000 square at z 0, a wall at x 500 (16 thick, 256 tall) with a
 * 64 wide doorway at y 0, a 16 square post at (200, 120), and a low ceiling
 * at z 60 over x -600..-400.
 */
function room() {
  const t: number[] = [];
  quad(
    t,
    [-1000, -1000, 0],
    [1000, -1000, 0],
    [1000, 1000, 0],
    [-1000, 1000, 0],
  );
  box(t, [500, -1000, 0], [516, -32, 256]);
  box(t, [500, 32, 0], [516, 1000, 256]);
  box(t, [192, 112, 0], [208, 128, 256]);
  box(t, [-600, -100, 60], [-400, 100, 76]);
  return new Float32Array(t);
}

describe("vision line of sight", () => {
  const tri = room();
  const grid = buildVisionGrid(tri);

  it("stops at the wall, exactly", () => {
    const hit = castRay(grid, tri, 0, 300, 64, 1, 0, 0, 2000);
    expect(hit).toBeCloseTo(500, 3);
  });

  it("goes through the doorway", () => {
    expect(castRay(grid, tri, 0, 0, 64, 1, 0, 0, 900)).toBe(900);
  });

  it("does not catch on a post it only passes near", () => {
    // 4 units clear of the post's face: a voxel would have swallowed it.
    expect(castRay(grid, tri, 0, 132, 64, 1, 0, 0, 450)).toBe(450);
    expect(castRay(grid, tri, 0, 120, 64, 1, 0, 0, 450)).toBeCloseTo(192, 3);
  });

  it("is clear when the ray leaves the map", () => {
    expect(castRay(grid, tri, 0, 300, 64, -1, 0, 0, 5000)).toBe(5000);
  });

  it("sees between players through the doorway, not through the wall", () => {
    expect(sightClear(grid, tri, [], 0, 300, 0, 64, 800, 0, 46)).toBe(true);
    expect(sightClear(grid, tri, [], 0, 300, 300, 64, 800, 300, 46)).toBe(
      false,
    );
  });

  it("drops the eye under a low ceiling", () => {
    expect(eyeHeight(grid, tri, 0, 0, 0, 64)).toBe(64);
    const low = eyeHeight(grid, tri, -500, 0, 0, 64);
    expect(low).toBeLessThan(60);
    expect(low).toBeGreaterThan(40);
  });

  it("finds the floor under a point", () => {
    const floor = floorBelow(grid, 100, -300, 64, 400);
    expect(floor).toBeGreaterThanOrEqual(0);
    expect(floor).toBeLessThanOrEqual(grid.vs + 1);
    expect(Number.isNaN(floorBelow(grid, 100, -300, 64, 10))).toBe(true);
  });
});

describe("vision smoke", () => {
  /** A 10^3 grid of 20u voxels at (1000, -100, 0), dense in its middle. */
  function smoke(front = 1): VisionSmoke {
    const n = 10;
    const texels = new Uint8Array(n * n * n * 4);
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const o = (i + n * (j + n * k)) * 4;
          const d = Math.max(
            Math.abs(i - 4.5),
            Math.abs(j - 4.5),
            Math.abs(k - 4.5),
          );
          // Surface 3 voxels out from the centre; R spans ±80u.
          texels[o] = Math.round((0.5 + ((3 - d) * 20) / 160) * 255);
          texels[o + 1] = Math.round((d / 6) * 254);
        }
      }
    }
    return {
      ox: 1000,
      oy: -100,
      oz: 0,
      vs: 20,
      dx: n,
      dy: n,
      dz: n,
      texels,
      span: 160,
      reach: 1000,
      front,
      x0: 1000,
      y0: -100,
      z0: 0,
      x1: 1200,
      y1: 100,
      z1: 200,
      holes: new Float32Array(4),
      holeCount: 0,
    };
  }

  it("stops a ray at the cloud", () => {
    // Its dense core starts two voxels in: 440 on from x 600.
    const hit = castSmoke([smoke()], 1, 600, 0, 100, 1, 0, 0, 2000);
    expect(hit).toBeGreaterThan(420);
    expect(hit).toBeLessThan(500);
  });

  it("lets a ray past a smoke that has not grown there yet", () => {
    expect(castSmoke([smoke(0)], 1, 600, 0, 100, 1, 0, 0, 2000)).toBe(2000);
  });

  it("lets a ray through an HE hole", () => {
    const s = smoke();
    s.holes.set([1100, 0, 100, 150]);
    s.holeCount = 1;
    expect(castSmoke([s], 1, 600, 0, 100, 1, 0, 0, 2000)).toBe(2000);
  });

  it("passes beside the cloud", () => {
    expect(castSmoke([smoke()], 1, 600, 300, 100, 1, 0, 0, 2000)).toBe(2000);
  });
});

describe("vision field of view", () => {
  it("wraps angles", () => {
    expect(angleBetween(170, -170)).toBeCloseTo(20);
    expect(angleBetween(-170, 170)).toBeCloseTo(-20);
    expect(angleBetween(0, 180)).toBeCloseTo(180);
  });

  it("knows what is in front", () => {
    expect(inView(0, 90, 0, 0, 100, 40)).toBe(true);
    expect(inView(0, 90, 0, 0, 100, 120)).toBe(false);
    expect(inView(180, 90, 0, 0, -100, -10)).toBe(true);
    expect(inView(-90, 90, 0, 0, 0, 100)).toBe(false);
  });
});

describe("vision's look back", () => {
  const T = "76561190000000001";
  const CT = "76561190000000002";
  const row = (id: string, team: string, tick: number, x: number) => ({
    round: 1,
    tick,
    attacker_steam_id: id,
    attacker_team: team,
    alive: true,
    x,
    y: 0,
    z: 0,
    yaw: 90,
    pitch: 0,
    health: 100,
    armor: 100,
  });
  const blob = {
    schema_version: 11,
    match_map_id: "m",
    tick_rate: 64,
    total_ticks: 10000,
    map_name: "de_mirage",
    round_ticks: [
      { round: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 5000 },
    ],
    players: [
      { steam_id: T, name: "tee" },
      { steam_id: CT, name: "cee" },
    ],
    kills: [],
    bombs: [],
    positions: [
      row(T, "t", 64, 0),
      row(T, "t", 704, 640),
      row(CT, "ct", 64, 500),
      row(CT, "ct", 704, 500),
    ],
    shots_fired: [],
    grenade_throws: [],
    damages: [],
  } as unknown as StageBlob;

  it("is left out while vision is off", () => {
    expect(buildStageFrame(blob, 1, 400).vision).toBeUndefined();
  });

  it("shows the followed player's side, both with nobody followed, or the side picked", () => {
    const side = (options: Parameters<typeof buildStageFrame>[3]) =>
      buildStageFrame(blob, 1, 400, { vision: true, ...options }).visionSide;
    expect(side({})).toBe("both");
    expect(side({ selectedId: T })).toBe("t");
    expect(side({ selectedId: T, visionSide: "ct" })).toBe("ct");
    expect(side({ visionSide: null, selectedId: CT })).toBe("ct");
  });

  it("samples everyone on a grid of the round clock, newest first", () => {
    const frame = buildStageFrame(blob, 1, 400, { vision: true });
    const past = frame.vision!;
    expect(past.times.length).toBe(VISION_PAST_COUNT);
    // The grid does not move with the frame.
    expect(past.times[0] % VISION_PAST_STEP).toBeCloseTo(0, 5);
    expect(frame.time - past.times[0]).toBeGreaterThanOrEqual(0);
    expect(frame.time - past.times[0]).toBeLessThan(VISION_PAST_STEP);
    expect(past.times[1]).toBeCloseTo(past.times[0] - VISION_PAST_STEP, 5);
    const t = past.ids.indexOf(T);
    // The T walks 1u a tick from x 0 at the round's start.
    const x = past.poses[t * VISION_POSE];
    expect(x).toBeCloseTo(past.times[0] * 64, 1);
    expect(past.poses[t * VISION_POSE + 3]).toBeCloseTo(90);
    expect(past.poses[t * VISION_POSE + 4] & 1).toBe(1);
    // Later samples are further back along the walk.
    const older = past.poses[(past.ids.length + t) * VISION_POSE];
    expect(older).toBeCloseTo(x - 4, 1);
  });
});
