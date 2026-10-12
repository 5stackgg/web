// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BLAST_NEVER,
  C4_DAMAGE,
  blastDamage,
  blastGrid,
  blastSpotKey,
  blastZones,
  damageTaken,
  fieldDistance,
  geodesicField,
  lethalReach,
  lineClear,
  packBlastFile,
  packField,
  unpackBlastFile,
  type BlastField,
  type BlastGrid,
} from "~/utilities/replayStage/blastField";

/** An open box of `n`^3 voxels with a solid wall at x = `wallAt`, open where `gap` says. */
function room(
  n: number,
  wallAt: number | null,
  gap: (j: number, k: number) => boolean,
) {
  const grid: BlastGrid = { ox: 0, oy: 0, oz: 0, vs: 10, dx: n, dy: n, dz: n };
  const solid = new Uint8Array(n * n * n);
  if (wallAt !== null) {
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < n; j++) {
        if (!gap(j, k)) solid[(k * n + j) * n + wallAt] = 1;
      }
    }
  }
  return { grid, solid };
}

const at = (
  grid: BlastGrid,
  dist: Float32Array,
  i: number,
  j: number,
  k: number,
) => dist[(k * grid.dy + j) * grid.dx + i];

describe("blast damage", () => {
  it("falls off like the classic C4 and stops at the radius", () => {
    expect(blastDamage(0)).toBe(C4_DAMAGE);
    expect(blastDamage(1750)).toBeCloseTo(500 * Math.exp(-4.5), 6);
    expect(blastDamage(1751)).toBe(0);
    expect(blastDamage(600)).toBeGreaterThan(blastDamage(900));
  });

  it("halves through armour until the armour runs out", () => {
    expect(damageTaken(100, 0)).toEqual({ health: 100, armor: 0 });
    expect(damageTaken(100, 100)).toEqual({ health: 50, armor: 25 });
    // 600 raw would soak 150 armour; 100 soaks 200 of it.
    expect(damageTaken(600, 100)).toEqual({ health: 400, armor: 100 });
  });

  it("puts the armoured lethal ring inside the unarmoured one", () => {
    const zones = blastZones();
    expect(zones.core).toBeLessThan(zones.heavy);
    expect(zones.heavy).toBeLessThan(zones.edge);
    expect(
      damageTaken(blastDamage(zones.core - 1), 100).health,
    ).toBeGreaterThanOrEqual(100);
    expect(blastDamage(zones.heavy + 1)).toBeLessThan(100);
    expect(lethalReach(1000)).toBe(0);
  });
});

describe("blast field", () => {
  it("measures open ground in straight lines, not grid octagons", () => {
    const { grid, solid } = room(41, null, () => true);
    const dist = geodesicField(solid, grid, { x: 205, y: 205, z: 205 }, 1e4);
    // 15 voxels out on a diagonal: a grid walk would say 15 * (1 + ...) more.
    const d = at(grid, dist, 20 + 15, 20 + 15, 20);
    expect(d).toBeCloseTo(Math.hypot(150, 150), -1);
    expect(at(grid, dist, 20 + 15, 20 + 6, 20 + 3)).toBeCloseTo(
      Math.hypot(150, 60, 30),
      -1,
    );
  });

  it("goes round a wall through its gap, never through it", () => {
    // A wall at x = 20 with a door at the far end (j >= 36).
    const { grid, solid } = room(41, 20, (j) => j >= 36);
    const dist = geodesicField(solid, grid, { x: 105, y: 105, z: 205 }, 1e4);
    const behind = at(grid, dist, 25, 10, 20);
    const straight = Math.hypot(250 - 105, 105 - 105);
    expect(behind).toBeGreaterThan(straight * 2);
    // Down to the door and back: about 260 + 260 plus the step across.
    expect(behind).toBeGreaterThan(500);
    expect(behind).toBeLessThan(640);
    expect(at(grid, dist, 20, 10, 20)).toBe(Infinity);
  });

  it("stops at maxDist and in sealed rooms", () => {
    const { grid, solid } = room(41, 20, () => false);
    const dist = geodesicField(solid, grid, { x: 105, y: 205, z: 205 }, 150);
    // Sealed off behind the wall.
    expect(at(grid, dist, 25, 20, 20)).toBe(Infinity);
    // In the open but past the limit.
    expect(at(grid, dist, 10, 38, 20)).toBe(Infinity);
    expect(at(grid, dist, 18, 20, 20)).toBeCloseTo(80, 0);
  });

  it("does not see through solids that meet diagonally", () => {
    const n = 4;
    const solid = new Uint8Array(n * n * n);
    solid[(0 * n + 0) * n + 1] = 1;
    solid[(0 * n + 1) * n + 0] = 1;
    expect(lineClear(solid, n, n, n, 0.5, 0.5, 0.5, 1.5, 1.5, 0.5)).toBe(false);
    expect(lineClear(solid, n, n, n, 0.5, 2.5, 0.5, 3.5, 3.5, 0.5)).toBe(true);
  });

  it("packs distances and lends solids their open neighbour's", () => {
    const { grid, solid } = room(21, 10, (j) => j >= 18);
    const dist = geodesicField(solid, grid, { x: 55, y: 55, z: 105 }, 1e4);
    const packed = packField(dist, solid, grid);
    const field: BlastField = {
      ...grid,
      at: { x: 55, y: 55, z: 105 },
      dist: packed,
    };
    const wall = (10 * 21 + 5) * 21 + 10;
    expect(packed[wall]).not.toBe(BLAST_NEVER);
    const near = fieldDistance(field, 55 + 30, 55, 105)!;
    expect(near).toBeGreaterThan(20);
    expect(near).toBeLessThan(40);
  });

  it("round-trips the published file", () => {
    const grid = blastGrid({ x: 100, y: -200, z: 30 }, 256);
    const dist = new Uint8Array(grid.dx * grid.dy * grid.dz).map(
      (_, i) => i % 256,
    );
    const field: BlastField = { ...grid, at: { x: 100, y: -200, z: 30 }, dist };
    const file = packBlastFile([{ site: "B", field }], 1234);
    const back = unpackBlastFile(file.buffer as ArrayBuffer);
    expect(back?.triangles).toBe(1234);
    expect(back?.sites[0].site).toBe("B");
    expect(back?.sites[0].field.dx).toBe(grid.dx);
    expect(Array.from(back!.sites[0].field.dist)).toEqual(Array.from(dist));
    expect(unpackBlastFile(new ArrayBuffer(8))).toBeNull();
  });

  it("keys nearby plant spots together", () => {
    expect(blastSpotKey({ x: 100, y: 100, z: 0 })).toBe(
      blastSpotKey({ x: 108, y: 95, z: 4 }),
    );
    expect(blastSpotKey({ x: 100, y: 100, z: 0 })).not.toBe(
      blastSpotKey({ x: 140, y: 100, z: 0 }),
    );
  });
});
