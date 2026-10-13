// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SMOKE_BIAS } from "~/utilities/replayStage/smokeShaders";
import type {
  SmokeGridJob,
  SmokeWorkerOut,
} from "~/utilities/replayStage/smokeWorker";

type Bake =
  typeof import("~/utilities/replayStage/smokeWorker").handleSmokeMessage;

let handle: Bake;

beforeAll(async () => {
  // The module is a worker's: it reads the worker global as it loads.
  vi.stubGlobal("self", globalThis);
  ({ handleSmokeMessage: handle } =
    await import("~/utilities/replayStage/smokeWorker"));
  handle({ kind: "map", tri: null });
});

const N = 13;
const VS = 20;

/** Valve's grid for a cube of smoke, voxels `lo`..`hi` on every axis. */
function job(lo: number, hi: number, at: SmokeGridJob["at"]): SmokeGridJob {
  const arrival = new Uint8Array(N * N * N).fill(255);
  for (let k = lo; k <= hi; k++) {
    for (let j = lo; j <= hi; j++) {
      for (let i = lo; i <= hi; i++) {
        arrival[(k * N + j) * N + i] = 0;
      }
    }
  }
  return {
    id: 1,
    ox: 0,
    oy: 0,
    oz: 0,
    vs: VS,
    dx: N,
    dy: N,
    dz: N,
    arrival,
    at,
  };
}

function bake(grid: SmokeGridJob) {
  const out = handle({ kind: "grid", ...grid }) as SmokeWorkerOut;
  if (out.kind !== "grid") {
    throw new Error("the grid did not bake");
  }
  return out;
}

/** Source units from the surface, positive inside, at a voxel's centre. */
function depth(out: ReturnType<typeof bake>, i: number, j: number, k: number) {
  return (out.texels[((k * N + j) * N + i) * 4] / 255 - 0.5) * out.span;
}

describe("a recorded smoke's grid", () => {
  it("puts the surface on the faces of the voxels the game filled", () => {
    const out = bake(job(4, 8, null));
    // Every voxel on the cube's skin is half a voxel inside, every one just
    // outside half a voxel out: nothing moves the game's own shape.
    for (let a = 4; a <= 8; a++) {
      for (let b = 4; b <= 8; b++) {
        for (const [i, j, k] of [
          [4, a, b],
          [8, a, b],
          [a, 4, b],
          [a, 8, b],
          [a, b, 8],
        ]) {
          expect(depth(out, i, j, k)).toBeCloseTo(VS / 2, 0);
        }
        expect(depth(out, 3, a, b)).toBeCloseTo(-VS / 2, 0);
        expect(depth(out, 9, a, b)).toBeCloseTo(-VS / 2, 0);
      }
    }
  });

  it("boxes the cloud with room for its puffs to swell", () => {
    const out = bake(job(4, 8, null));
    const [i0, j0, k0, i1, j1, k1] = out.bounds;
    for (const lo of [i0, j0, k0]) {
      expect(lo * VS).toBeLessThanOrEqual(4 * VS - SMOKE_BIAS);
    }
    for (const hi of [i1, j1, k1]) {
      expect((hi + 1) * VS).toBeGreaterThanOrEqual(9 * VS + SMOKE_BIAS);
    }
  });

  it("rolls out from where the grenade went off, not the middle of its box", () => {
    const share = (out: ReturnType<typeof bake>, v: number) =>
      out.texels[((v * N + v) * N + v) * 4 + 1];
    const corner = bake(job(4, 8, [4.5, 4.5, 4.5]));
    expect(share(corner, 4)).toBeLessThan(share(corner, 6));
    expect(share(corner, 6)).toBeLessThan(share(corner, 8));
    expect(share(corner, 8)).toBe(254);
    // A flooded grid is centred on its grenade, which is what no point means.
    const middle = bake(job(4, 8, null));
    expect(share(middle, 6)).toBeLessThan(share(middle, 4));
    expect(share(middle, 6)).toBeLessThan(share(middle, 8));
  });
});
