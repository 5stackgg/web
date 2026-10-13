/**
 * Builds CS2 smoke grids off the main thread.
 *
 * CS2 gives every smoke its own 32^3 grid of 20u voxels centred on the
 * detonation, marks the world geometry inside it solid, and floods smoke from
 * a cluster of source points just above the floor through the free voxels
 * until a budget runs out. That is why a smoke fills a room, stops at walls,
 * and pools wider than it is tall. This worker reproduces that from the map's
 * collision hull and bakes the result into the RGBA texels the stage
 * raymarches:
 *
 *   R  signed distance to the cloud's surface, ±SD_RANGE voxels mapped to
 *      0..1 (0.5 on the surface). Open air makes surface; walls barely do,
 *      so the cloud stays dense against them and nothing reaches through
 *      them. The shader carves billows out of the shell.
 *   G  share of the smoke's reach a voxel lies at, 0..254 (255 = never),
 *      which says when the smoke gets there (smokeArrival.ts); dilated past
 *      the edge so trilinear filtering does not invent late arrivals there
 *   B  light from above: transmittance through the cloud to the sky
 *   A  openness: how much of the neighbourhood is empty, for ambient shading
 */

import { smokeReachedBy } from "./smokeArrival";
import { SMOKE_BIAS } from "./smokeShaders";

export type SmokeGridJob = {
  id: number;
  /** Minimum corner of the grid, source units. */
  ox: number;
  oy: number;
  oz: number;
  vs: number;
  dx: number;
  dy: number;
  dz: number;
  /** Valve's arrival grid when the demo carried it; flooded here otherwise. */
  arrival: Uint8Array | null;
  /**
   * Where the grenade went off, in voxels from the minimum corner. Valve's
   * grid is cropped to its cloud, so that is not the middle of the box; a
   * flooded grid is centred on it.
   */
  at: [number, number, number] | null;
};

export type SmokeGridStats = {
  tris: number;
  voxelMs: number;
  floodMs: number;
  bakeMs: number;
  filled: number;
};

export type SmokeWorkerIn =
  | { kind: "map"; tri: Float32Array | null }
  | { kind: "noise"; size: number }
  | ({ kind: "grid" } & SmokeGridJob);

export type SmokeWorkerOut =
  | { kind: "noise"; size: number; data: Uint8Array }
  | {
      kind: "grid";
      id: number;
      texels: Uint8Array;
      /** Source units the R channel spans from 0 to 1. */
      span: number;
      /** Source units from the detonation to the smoke's farthest reach. */
      reach: number;
      /** Voxel index bounds of the cloud, inclusive: i0 j0 k0 i1 j1 k1. */
      bounds: number[];
      stats: SmokeGridStats;
    }
  /** A grid (`id`) or the noise (`id` null) could not be built. */
  | { kind: "error"; id: number | null; message: string };

/** Voxels a CS2 smoke floods before it stops. */
const FLOOD_BUDGET = 1000;
/** Climbing costs more than spreading, so the cloud pools. */
const VERTICAL_COST = 1.3;
/**
 * Falling costs less than spreading: a smoke that pops on a ledge or a sill
 * pours over the edge and fills down to the floor below, as CS2's do.
 */
const FALL_COST = 0.55;
/** Radius of the region seeded on the detonation tick, in voxels. */
const SEED_REACH = 4.5;
/**
 * Its height. Valve's source points thin out going up, so the region is a
 * dome: a drum would give the cloud a flat lid as wide as the drum.
 */
const SEED_HEIGHT = 5.5;
/** Voxels either side of the surface the distance channel spans. */
const SD_RANGE = 4;
/**
 * How far a wall or ceiling the cloud presses against counts as surface,
 * against one voxel for open air: far enough that the cloud stays dense
 * there, near enough that the noise can round its corners on it.
 */
const WALL_SURFACE = 2.5;
/** Spacing of the slow lobes baked into a flood's surface, in source units. */
const LUMP_CELL = 160;
/** How far the lobes move the surface, in voxels, peak to peak. */
const LUMP_DEPTH = 3;
/**
 * Voxels past the surface the distance is walked out to: the shader's swell,
 * and one more to filter across.
 */
const OUTER_REACH = 3.5;

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SmokeWorkerIn>) => void) | null;
  postMessage(message: SmokeWorkerOut, transfer: Transferable[]): void;
};

/**
 * One message in, at most one reply out. Every grid and the noise get a
 * reply, an error one if need be, so nothing waits on them forever. Also run
 * on the main thread when the worker cannot start.
 */
export function handleSmokeMessage(msg: SmokeWorkerIn): SmokeWorkerOut | null {
  if (msg.kind === "map") {
    try {
      indexMap(msg.tri);
    } catch {
      // Without the hull every smoke is a dome, which beats none.
      tri = null;
    }
    return null;
  }
  try {
    if (msg.kind === "noise") {
      return { kind: "noise", size: msg.size, data: buildNoise(msg.size) };
    }
    return buildGridOrDome(msg);
  } catch (error) {
    return {
      kind: "error",
      id: msg.kind === "grid" ? msg.id : null,
      message: String(error),
    };
  }
}

function transferOf(out: SmokeWorkerOut): Transferable[] {
  if (out.kind === "noise") {
    return [out.data.buffer];
  }
  return out.kind === "grid" ? [out.texels.buffer] : [];
}

// Only in the worker: smoke.ts imports this file too when it has to.
if (typeof window === "undefined") {
  scope.onmessage = (event) => {
    const out = handleSmokeMessage(event.data);
    if (out) {
      scope.postMessage(out, transferOf(out));
    }
  };
}

// ---------------------------------------------------------------- map index

const CELL = 128;
let tri: Float32Array | null = null;
let cellX0 = 0;
let cellY0 = 0;
let cellW = 0;
let cellH = 0;
let cellStart = new Uint32Array(1);
let cellTris = new Uint32Array(0);
let seen = new Uint32Array(0);
let seenStamp = 0;

/** Buckets every triangle by the 2D cells its footprint touches. */
function indexMap(source: Float32Array | null) {
  tri = source;
  if (!source || source.length < 9) {
    tri = null;
    return;
  }
  const count = source.length / 9;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < source.length; i += 3) {
    minX = Math.min(minX, source[i]);
    maxX = Math.max(maxX, source[i]);
    minY = Math.min(minY, source[i + 1]);
    maxY = Math.max(maxY, source[i + 1]);
  }
  cellX0 = minX;
  cellY0 = minY;
  cellW = Math.floor((maxX - minX) / CELL) + 1;
  cellH = Math.floor((maxY - minY) / CELL) + 1;
  const counts = new Uint32Array(cellW * cellH + 1);
  const forEachCell = (t: number, visit: (cell: number) => void) => {
    const o = t * 9;
    const c0 = Math.floor(
      (Math.min(source[o], source[o + 3], source[o + 6]) - cellX0) / CELL,
    );
    const c1 = Math.floor(
      (Math.max(source[o], source[o + 3], source[o + 6]) - cellX0) / CELL,
    );
    const r0 = Math.floor(
      (Math.min(source[o + 1], source[o + 4], source[o + 7]) - cellY0) / CELL,
    );
    const r1 = Math.floor(
      (Math.max(source[o + 1], source[o + 4], source[o + 7]) - cellY0) / CELL,
    );
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        visit(r * cellW + c);
      }
    }
  };
  for (let t = 0; t < count; t++) {
    forEachCell(t, (cell) => counts[cell + 1]++);
  }
  for (let i = 1; i < counts.length; i++) {
    counts[i] += counts[i - 1];
  }
  cellStart = counts;
  cellTris = new Uint32Array(counts[counts.length - 1]);
  const fill = counts.slice(0, -1);
  for (let t = 0; t < count; t++) {
    forEachCell(t, (cell) => {
      cellTris[fill[cell]++] = t;
    });
  }
  seen = new Uint32Array(count);
  seenStamp = 0;
}

// ------------------------------------------------------------ voxelisation

/**
 * Marks every voxel a triangle of the hull passes through (separating axis
 * test against the voxel box), which is how the solid masks Valve networks
 * line up with our hull.
 */
function voxelize(job: SmokeGridJob, solid: Uint8Array): number {
  const t = tri;
  if (!t) {
    return 0;
  }
  const { ox, oy, oz, vs, dx, dy, dz } = job;
  const x1 = ox + dx * vs;
  const y1 = oy + dy * vs;
  const z1 = oz + dz * vs;
  // A hair over half a voxel: a surface lying exactly on a voxel boundary
  // marks both sides rather than slipping between them and leaving a hole.
  const e = 1e-3;
  const h = vs / 2 + e;
  const c0 = Math.max(0, Math.floor((ox - cellX0) / CELL));
  const c1 = Math.min(cellW - 1, Math.floor((x1 - cellX0) / CELL));
  const r0 = Math.max(0, Math.floor((oy - cellY0) / CELL));
  const r1 = Math.min(cellH - 1, Math.floor((y1 - cellY0) / CELL));
  const stamp = ++seenStamp;
  // Per triangle: the 9 edge-cross axes plus the face normal. The box axes
  // are implied by the voxel range we walk.
  const axes = new Float64Array(10 * 6);
  let touched = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const cell = r * cellW + c;
      for (let s = cellStart[cell]; s < cellStart[cell + 1]; s++) {
        const id = cellTris[s];
        if (seen[id] === stamp) {
          continue;
        }
        seen[id] = stamp;
        const o = id * 9;
        const ax = t[o],
          ay = t[o + 1],
          az = t[o + 2];
        const bx = t[o + 3],
          by = t[o + 4],
          bz = t[o + 5];
        const cx = t[o + 6],
          cy = t[o + 7],
          cz = t[o + 8];
        const minX = Math.min(ax, bx, cx),
          maxX = Math.max(ax, bx, cx);
        const minY = Math.min(ay, by, cy),
          maxY = Math.max(ay, by, cy);
        const minZ = Math.min(az, bz, cz),
          maxZ = Math.max(az, bz, cz);
        if (
          maxX < ox ||
          minX > x1 ||
          maxY < oy ||
          minY > y1 ||
          maxZ < oz ||
          minZ > z1
        ) {
          continue;
        }
        touched++;
        const i0 = Math.max(0, Math.floor((minX - ox - e) / vs));
        const i1 = Math.min(dx - 1, Math.floor((maxX - ox + e) / vs));
        const j0 = Math.max(0, Math.floor((minY - oy - e) / vs));
        const j1 = Math.min(dy - 1, Math.floor((maxY - oy + e) / vs));
        const k0 = Math.max(0, Math.floor((minZ - oz - e) / vs));
        const k1 = Math.min(dz - 1, Math.floor((maxZ - oz + e) / vs));
        if (i0 === i1 && j0 === j1 && k0 === k1) {
          solid[(k0 * dy + j0) * dx + i0] = 1;
          continue;
        }
        const e0x = bx - ax,
          e0y = by - ay,
          e0z = bz - az;
        const e1x = cx - bx,
          e1y = cy - by,
          e1z = cz - bz;
        const e2x = ax - cx,
          e2y = ay - cy,
          e2z = az - cz;
        let n = 0;
        const addAxis = (x: number, y: number, z: number) => {
          if (x * x + y * y + z * z < 1e-12) {
            return;
          }
          const pa = x * ax + y * ay + z * az;
          const pb = x * bx + y * by + z * bz;
          const pc = x * cx + y * cy + z * cz;
          const q = n * 6;
          axes[q] = x;
          axes[q + 1] = y;
          axes[q + 2] = z;
          axes[q + 3] = Math.min(pa, pb, pc);
          axes[q + 4] = Math.max(pa, pb, pc);
          axes[q + 5] = h * (Math.abs(x) + Math.abs(y) + Math.abs(z));
          n++;
        };
        addAxis(
          e0y * e1z - e0z * e1y,
          e0z * e1x - e0x * e1z,
          e0x * e1y - e0y * e1x,
        );
        addAxis(0, -e0z, e0y);
        addAxis(0, -e1z, e1y);
        addAxis(0, -e2z, e2y);
        addAxis(e0z, 0, -e0x);
        addAxis(e1z, 0, -e1x);
        addAxis(e2z, 0, -e2x);
        addAxis(-e0y, e0x, 0);
        addAxis(-e1y, e1x, 0);
        addAxis(-e2y, e2x, 0);
        for (let k = k0; k <= k1; k++) {
          const pz = oz + (k + 0.5) * vs;
          for (let j = j0; j <= j1; j++) {
            const py = oy + (j + 0.5) * vs;
            let v = (k * dy + j) * dx + i0;
            for (let i = i0; i <= i1; i++, v++) {
              if (solid[v]) {
                continue;
              }
              const px = ox + (i + 0.5) * vs;
              let hit = true;
              for (let q = 0; q < n * 6; q += 6) {
                const centre =
                  axes[q] * px + axes[q + 1] * py + axes[q + 2] * pz;
                const rad = axes[q + 5];
                if (axes[q + 3] - centre > rad || axes[q + 4] - centre < -rad) {
                  hit = false;
                  break;
                }
              }
              if (hit) {
                solid[v] = 1;
              }
            }
          }
        }
      }
    }
  }
  return touched;
}

// ------------------------------------------------------------------- flood

/** 26 neighbours, each with its step cost and the voxels it must not cut. */
const NEIGHBOURS = (() => {
  const list: Array<{
    d: [number, number, number];
    cost: number;
    via: Array<[number, number, number]>;
  }> = [];
  for (let k = -1; k <= 1; k++) {
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        if (!i && !j && !k) {
          continue;
        }
        // Diagonals may not squeeze between two solids: every axis-aligned
        // step that makes up the move has to be free too.
        const via: Array<[number, number, number]> = [];
        const parts: Array<[number, number, number]> = [];
        if (i) parts.push([i, 0, 0]);
        if (j) parts.push([0, j, 0]);
        if (k) parts.push([0, 0, k]);
        if (parts.length > 1) {
          via.push(...parts);
        }
        if (parts.length === 3) {
          via.push([i, j, 0], [i, 0, k], [0, j, k]);
        }
        list.push({
          d: [i, j, k],
          cost: Math.sqrt(
            i * i + j * j + (k * (k < 0 ? FALL_COST : VERTICAL_COST)) ** 2,
          ),
          via,
        });
      }
    }
  }
  return list;
})();

/**
 * Valve seeds a few dozen source points over the detonation, about 200u
 * across and 100u up, most of them low, and its first tick fills the space
 * between them. So the whole region is seeded at once: every free voxel in it
 * the grenade reaches without passing through geometry.
 */
function seeds(
  solid: Uint8Array,
  dx: number,
  dy: number,
  dz: number,
): number[] {
  // The detonation sits on the corner between voxels 15 and 16.
  const ci = dx >> 1;
  const cj = dy >> 1;
  const ck = dz >> 1;
  const at = (i: number, j: number, k: number) => (k * dy + j) * dx + i;
  const inRegion = (i: number, j: number, k: number) =>
    i >= 0 &&
    j >= 0 &&
    k >= ck - 1 &&
    i < dx &&
    j < dy &&
    k < dz &&
    ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2) / SEED_REACH ** 2 +
      ((k - ck + 1) / SEED_HEIGHT) ** 2 <=
      1;
  let start = -1;
  for (let lift = 0; lift < 5 && start < 0; lift++) {
    for (let ring = 0; ring <= 2 && start < 0; ring++) {
      for (let j = -ring; j <= ring && start < 0; j++) {
        for (let i = -ring; i <= ring && start < 0; i++) {
          if (
            inRegion(ci + i, cj + j, ck + lift) &&
            !solid[at(ci + i, cj + j, ck + lift)]
          ) {
            start = at(ci + i, cj + j, ck + lift);
          }
        }
      }
    }
  }
  if (start < 0) {
    return [];
  }
  const reached = new Uint8Array(solid.length);
  const out = [start];
  reached[start] = 1;
  for (let q = 0; q < out.length; q++) {
    const v = out[q];
    const i = v % dx;
    const j = Math.floor(v / dx) % dy;
    const k = Math.floor(v / (dx * dy));
    for (const [di, dj, dk] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]) {
      if (!inRegion(i + di, j + dj, k + dk)) {
        continue;
      }
      const n = at(i + di, j + dj, k + dk);
      if (!reached[n] && !solid[n]) {
        reached[n] = 1;
        out.push(n);
      }
    }
  }
  return out;
}

/** A binary min-heap of voxel indices keyed by cost. */
function createHeap() {
  let costs = new Float32Array(4096);
  let items = new Int32Array(4096);
  let length = 0;
  return {
    size: () => length,
    /** The lowest cost; only while the heap is not empty. */
    peek: () => costs[0],
    push(c: number, v: number) {
      if (length === costs.length) {
        const nc = new Float32Array(length * 2);
        nc.set(costs);
        costs = nc;
        const ni = new Int32Array(length * 2);
        ni.set(items);
        items = ni;
      }
      let p = length++;
      while (p > 0) {
        const parent = (p - 1) >> 1;
        if (costs[parent] <= c) {
          break;
        }
        costs[p] = costs[parent];
        items[p] = items[parent];
        p = parent;
      }
      costs[p] = c;
      items[p] = v;
    },
    pop() {
      const top = items[0];
      const lastC = costs[--length];
      const lastI = items[length];
      let p = 0;
      for (;;) {
        let child = p * 2 + 1;
        if (child >= length) {
          break;
        }
        if (child + 1 < length && costs[child + 1] < costs[child]) {
          child++;
        }
        if (costs[child] >= lastC) {
          break;
        }
        costs[p] = costs[child];
        items[p] = items[child];
        p = child;
      }
      costs[p] = lastC;
      items[p] = lastI;
      return top;
    },
  };
}

/** Floods the free voxels: their reach shares, and the reach in voxels. */
function flood(solid: Uint8Array, dx: number, dy: number, dz: number) {
  const size = dx * dy * dz;
  const share = new Uint8Array(size).fill(255);
  const cost = new Float32Array(size).fill(Infinity);
  const done = new Uint8Array(size);
  const heap = createHeap();

  // Each seed starts at its own distance from the detonation, weighed like
  // the flood's steps, so the cloud is a ball around the grenade. Starting
  // them all at zero made the top of the seeded region a lid: an alley the
  // cloud fills wall to wall came out as a flat-topped slab.
  for (const s of seeds(solid, dx, dy, dz)) {
    const c = Math.hypot(
      (s % dx) + 0.5 - (dx >> 1),
      (Math.floor(s / dx) % dy) + 0.5 - (dy >> 1),
      (Math.floor(s / (dx * dy)) + 0.5 - (dz >> 1)) * VERTICAL_COST,
    );
    cost[s] = c;
    heap.push(c, s);
  }
  const offsets = NEIGHBOURS.map(({ d, via }) => ({
    off: d[0] + d[1] * dx + d[2] * dx * dy,
    via: via.map((p) => p[0] + p[1] * dx + p[2] * dx * dy),
  }));
  const order = new Int32Array(FLOOD_BUDGET);
  let filled = 0;
  while (heap.size() > 0 && filled < FLOOD_BUDGET) {
    const c = heap.peek();
    const v = heap.pop();
    if (done[v] || c > cost[v]) {
      continue;
    }
    done[v] = 1;
    order[filled++] = v;
    const i = v % dx;
    const j = Math.floor(v / dx) % dy;
    const k = Math.floor(v / (dx * dy));
    for (let n = 0; n < NEIGHBOURS.length; n++) {
      const [di, dj, dk] = NEIGHBOURS[n].d;
      const ni = i + di,
        nj = j + dj,
        nk = k + dk;
      if (ni < 0 || nj < 0 || nk < 0 || ni >= dx || nj >= dy || nk >= dz) {
        continue;
      }
      const m = v + offsets[n].off;
      if (done[m] || solid[m]) {
        continue;
      }
      const via = offsets[n].via;
      let blocked = false;
      for (let q = 0; q < via.length; q++) {
        if (solid[v + via[q]]) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        continue;
      }
      const nc = c + NEIGHBOURS[n].cost;
      if (nc < cost[m]) {
        cost[m] = nc;
        heap.push(nc, m);
      }
    }
  }
  // Costs run from the detonation point itself, so they are the reach.
  const reach = filled ? Math.max(1, cost[order[filled - 1]]) : 1;
  for (let q = 0; q < filled; q++) {
    const v = order[q];
    share[v] = Math.min(254, Math.round((cost[v] / reach) * 254));
  }
  return { share, reach };
}

/**
 * Valve's arrival grid (1/40 s, 255 never) as reach shares, and its reach:
 * the farthest voxel it filled, measured the way the flood measures. Valve
 * fills about half the cloud on the detonation tick; that part rolls out
 * from the grenade by distance instead, so a voxel arrives at the later of
 * its own time and the burst's front getting to it.
 */
function valveShares(arrival: Uint8Array, job: SmokeGridJob) {
  const { dx, dy, dz } = job;
  const [ax, ay, az] = job.at ?? [dx >> 1, dy >> 1, dz >> 1];
  const share = new Uint8Array(arrival.length).fill(255);
  const away = new Float32Array(arrival.length);
  let reach = 1;
  for (let v = 0; v < arrival.length; v++) {
    if (arrival[v] === 255) {
      continue;
    }
    away[v] = Math.hypot(
      (v % dx) + 0.5 - ax,
      (Math.floor(v / dx) % dy) + 0.5 - ay,
      (Math.floor(v / (dx * dy)) + 0.5 - az) * VERTICAL_COST,
    );
    reach = Math.max(reach, away[v]);
  }
  for (let v = 0; v < arrival.length; v++) {
    if (arrival[v] === 255) {
      continue;
    }
    const at = Math.max(smokeReachedBy(arrival[v] / 40), away[v] / reach);
    share[v] = Math.min(254, Math.round(at * 254));
  }
  return { share, reach };
}

// -------------------------------------------------------------------- bake

/** 0..1 at lattice points, hashed from their position: smokes agree. */
function hash3(x: number, y: number, z: number) {
  let h =
    Math.imul(x, 0x8da6b343) ^
    Math.imul(y, 0xd8163841) ^
    Math.imul(z, 0xcb1ab31f);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Smooth value noise, 0..1, with a lattice point every unit. */
function valueNoise(x: number, y: number, z: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  let fx = x - x0;
  let fy = y - y0;
  let fz = z - z0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const plane = (z: number) =>
    lerp(
      lerp(hash3(x0, y0, z), hash3(x0 + 1, y0, z), fx),
      lerp(hash3(x0, y0 + 1, z), hash3(x0 + 1, y0 + 1, z), fx),
      fy,
    );
  return lerp(plane(z0), plane(z0 + 1), fz);
}

/**
 * Signed distance to the cloud's surface in voxels, positive inside, out to
 * ±SD_RANGE. The flood's own edge is flat wherever it stopped across a
 * corridor or under its budget, so the shader needs room to carve billows:
 * a distance gives the shell a depth, where an occupancy would be a step.
 * Valve's grid is the game's own cloud, so its surface is left where it is.
 *
 * Distances walk only through the cloud (inside) or open air (outside), so
 * smoke never reaches round a wall into the next room. Floors make no
 * surface, so the cloud sits on them; walls and ceilings make a faint one. The grid's faces count as open air: a cloud that fills its box fades
 * out before the box instead of being sliced by it.
 */
function signedDistance(
  inside: Uint8Array,
  solid: Uint8Array | null,
  job: SmokeGridJob,
): Float32Array {
  const { dx, dy, dz } = job;
  const size = dx * dy * dz;
  const sz = dx * dy;
  const n26 = NEIGHBOURS.length;
  const stepI = new Int8Array(n26);
  const stepJ = new Int8Array(n26);
  const stepK = new Int8Array(n26);
  const stepOff = new Int32Array(n26);
  const stepLen = new Float32Array(n26);
  NEIGHBOURS.forEach(({ d }, n) => {
    stepI[n] = d[0];
    stepJ[n] = d[1];
    stepK[n] = d[2];
    stepOff[n] = d[0] + d[1] * dx + d[2] * sz;
    stepLen[n] = Math.hypot(d[0], d[1], d[2]);
  });
  // 0 open air, 1 cloud, 2 solid.
  const kind = new Uint8Array(size);
  for (let v = 0; v < size; v++) {
    kind[v] = inside[v] ? 1 : solid && solid[v] ? 2 : 0;
  }
  // Inside, open air and walls each get a distance: the lobes shape only
  // the open-air side, so a doorway the cloud fills wall to wall stays full.
  const din = new Float32Array(size).fill(Infinity);
  const dwall = new Float32Array(size).fill(Infinity);
  const dout = new Float32Array(size).fill(Infinity);
  const inner = createHeap();
  const walled = createHeap();
  const outer = createHeap();
  for (let v = 0; v < size; v++) {
    if (kind[v] !== 1) {
      continue;
    }
    const i = v % dx;
    const j = Math.floor(v / dx) % dy;
    const k = Math.floor(v / sz);
    let best = Infinity;
    for (let n = 0; n < n26; n++) {
      const ni = i + stepI[n],
        nj = j + stepJ[n],
        nk = k + stepK[n];
      const len = stepLen[n];
      if (ni < 0 || nj < 0 || nk < 0 || ni >= dx || nj >= dy || nk >= dz) {
        best = Math.min(best, len);
        continue;
      }
      const m = v + stepOff[n];
      if (kind[m] === 0) {
        best = Math.min(best, len);
        if (len < dout[m]) {
          dout[m] = len;
          outer.push(len, m);
        }
      } else if (
        kind[m] === 2 &&
        len === 1 &&
        stepK[n] >= 0 &&
        dwall[v] === Infinity
      ) {
        dwall[v] = WALL_SURFACE;
        walled.push(WALL_SURFACE, v);
      }
    }
    if (best < Infinity) {
      din[v] = best;
      inner.push(best, v);
    }
  }
  // Outside, only the first voxels matter: past the swell nothing shows.
  const walk = (
    heap: ReturnType<typeof createHeap>,
    dist: Float32Array,
    within: number,
    limit: number,
  ) => {
    while (heap.size() > 0) {
      const c = heap.peek();
      const v = heap.pop();
      if (c > dist[v] || c >= limit) {
        continue;
      }
      const i = v % dx;
      const j = Math.floor(v / dx) % dy;
      const k = Math.floor(v / sz);
      for (let n = 0; n < n26; n++) {
        const ni = i + stepI[n],
          nj = j + stepJ[n],
          nk = k + stepK[n];
        if (ni < 0 || nj < 0 || nk < 0 || ni >= dx || nj >= dy || nk >= dz) {
          continue;
        }
        const m = v + stepOff[n];
        const nc = c + stepLen[n];
        if (nc < dist[m] && kind[m] === within) {
          dist[m] = nc;
          heap.push(nc, m);
        }
      }
    }
  };
  walk(inner, din, 1, SD_RANGE + 0.5);
  walk(walled, dwall, 1, SD_RANGE + 0.5);
  walk(outer, dout, 0, OUTER_REACH);

  // A voxel centre one step from the other side is half a voxel from the
  // face between them, which is where the surface goes.
  const { ox, oy, oz, vs } = job;
  const lumpy = !job.arrival;
  const sd = new Float32Array(size);
  for (let v = 0; v < size; v++) {
    let d = inside[v]
      ? Math.min(SD_RANGE, din[v] - 0.5)
      : Math.max(-SD_RANGE, 0.5 - dout[v]);
    if (lumpy && Math.abs(d) < SD_RANGE) {
      // Slow lobes a few voxels across, so a lid or a corridor's end is not
      // one plane. They run tall: seen from above, the outline is every
      // height at once, and lumps that differ height to height fill in each
      // other's dents there. Centred on the surface: the flood still says
      // where smoke is.
      const x = (ox + ((v % dx) + 0.5) * vs) / LUMP_CELL;
      const y = (oy + ((Math.floor(v / dx) % dy) + 0.5) * vs) / LUMP_CELL;
      const z = (oz + (Math.floor(v / sz) + 0.5) * vs) / (LUMP_CELL * 2.5);
      const n =
        valueNoise(x, y, z) * 0.7 +
        valueNoise(x * 2.3 + 17, y * 2.3, z * 2.3) * 0.3;
      d += (Math.min(1, Math.max(0, (n - 0.5) * 2.2 + 0.5)) - 0.5) * LUMP_DEPTH;
    }
    sd[v] = inside[v] ? Math.min(d, dwall[v] - 0.5) : d;
  }
  if (solid) {
    for (let v = 0; v < size; v++) {
      if (!solid[v]) {
        continue;
      }
      const i = v % dx;
      const j = Math.floor(v / dx) % dy;
      const k = Math.floor(v / sz);
      // A floor takes the smoke resting on it, so the cloud meets the ground
      // at full density and the depth test makes the contact crisp.
      if (k < dz - 1 && inside[v + sz]) {
        sd[v] = sd[v + sz];
        continue;
      }
      // A wall or ceiling the cloud touches sits just outside it: the surface
      // lands near the wall's own, but not through it.
      if (
        (i > 0 && inside[v - 1]) ||
        (i < dx - 1 && inside[v + 1]) ||
        (j > 0 && inside[v - dx]) ||
        (j < dy - 1 && inside[v + dx]) ||
        (k > 0 && inside[v - sz])
      ) {
        sd[v] = -1;
      }
    }
  }
  return sd;
}

function bake(share: Uint8Array, solid: Uint8Array | null, job: SmokeGridJob) {
  const { dx, dy, dz } = job;
  const size = dx * dy * dz;
  const sx = 1;
  const sy = dx;
  const sz = dx * dy;
  const inside = new Uint8Array(size);
  for (let v = 0; v < size; v++) {
    inside[v] = share[v] < 255 ? 1 : 0;
  }
  const sd = signedDistance(inside, solid, job);
  // Occupancy for the shading channels, soft over a voxel either side of
  // the surface; walls hold none, so one room's cloud never shades the next.
  const occ = new Float32Array(size);
  for (let v = 0; v < size; v++) {
    occ[v] = Math.min(1, Math.max(0, 0.5 + sd[v] * 0.5));
  }

  // Shares past the edge: the nearest neighbour's, a little farther.
  const arr = new Uint8Array(share);
  for (let pass = 0; pass < 4; pass++) {
    const prev = arr.slice();
    for (let v = 0; v < size; v++) {
      if (prev[v] < 255) {
        continue;
      }
      const i = v % dx;
      const j = Math.floor(v / dx) % dy;
      const k = Math.floor(v / sz);
      let best = 255;
      if (i > 0) best = Math.min(best, prev[v - sx]);
      if (i < dx - 1) best = Math.min(best, prev[v + sx]);
      if (j > 0) best = Math.min(best, prev[v - sy]);
      if (j < dy - 1) best = Math.min(best, prev[v + sy]);
      if (k > 0) best = Math.min(best, prev[v - sz]);
      if (k < dz - 1) best = Math.min(best, prev[v + sz]);
      if (best < 255) {
        arr[v] = Math.min(254, best + 4);
      }
    }
  }

  // Light from above: how much cloud sits over each voxel.
  const sky = new Float32Array(size);
  for (let j = 0; j < dy; j++) {
    for (let i = 0; i < dx; i++) {
      let depth = 0;
      for (let k = dz - 1; k >= 0; k--) {
        const v = k * sz + j * dx + i;
        sky[v] = Math.exp(-depth * 0.55);
        depth += occ[v];
      }
    }
  }

  // Openness: the empty share of a 5^3 neighbourhood (box blur, separable).
  let open = new Float32Array(size);
  for (let v = 0; v < size; v++) {
    open[v] = occ[v];
  }
  let scratch = new Float32Array(size);
  const box = (
    stride: number,
    extent: number,
    coord: (v: number) => number,
  ) => {
    for (let v = 0; v < size; v++) {
      const c = coord(v);
      let sum = 0;
      let n = 0;
      for (let o = -2; o <= 2; o++) {
        if (c + o < 0 || c + o >= extent) {
          continue;
        }
        sum += open[v + o * stride];
        n++;
      }
      scratch[v] = sum / n;
    }
    const swap = open;
    open = scratch;
    scratch = swap;
  };
  box(sx, dx, (v) => v % dx);
  box(sy, dy, (v) => Math.floor(v / dx) % dy);
  box(sz, dz, (v) => Math.floor(v / sz));

  const texels = new Uint8Array(size * 4);
  let i0 = dx,
    j0 = dy,
    k0 = dz,
    i1 = -1,
    j1 = -1,
    k1 = -1;
  for (let v = 0; v < size; v++) {
    const d = sd[v];
    texels[v * 4] = Math.round(
      Math.min(1, Math.max(0, 0.5 + d / (2 * SD_RANGE))) * 255,
    );
    texels[v * 4 + 1] = arr[v];
    texels[v * 4 + 2] = Math.round(sky[v] * 255);
    texels[v * 4 + 3] = Math.round((1 - Math.min(1, open[v])) * 255);
    // The shader lets puffs swell past the surface.
    if (d > -(SMOKE_BIAS / job.vs + 0.6)) {
      const i = v % dx;
      const j = Math.floor(v / dx) % dy;
      const k = Math.floor(v / sz);
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (j < j0) j0 = j;
      if (j > j1) j1 = j;
      if (k < k0) k0 = k;
      if (k > k1) k1 = k;
    }
  }
  return {
    texels,
    bounds: i1 < 0 ? [0, 0, 0, -1, -1, -1] : [i0, j0, k0, i1, j1, k1],
  };
}

function buildGridOrDome(job: SmokeGridJob) {
  try {
    return buildGrid(job, true);
  } catch {
    // Something in the hull broke the flood: a dome still shows the smoke.
    return buildGrid(job, false);
  }
}

/** `hull` false floods a dome on a flat floor, as when there is no hull. */
function buildGrid(
  job: SmokeGridJob,
  hull: boolean,
): SmokeWorkerOut & { kind: "grid" } {
  const { dx, dy, dz } = job;
  const t0 = performance.now();
  const solid = new Uint8Array(dx * dy * dz);
  const walls = hull ? tri : null;
  let touched = 0;
  if (walls) {
    touched = voxelize(job, solid);
  } else if (!job.arrival) {
    // No hull: a flat floor under the grenade, so the flood makes a dome.
    solid.fill(1, 0, (dz >> 1) * dx * dy);
  }
  const t1 = performance.now();
  const { share, reach } = job.arrival
    ? valveShares(job.arrival, job)
    : flood(solid, dx, dy, dz);
  const t2 = performance.now();
  // Valve's grid already went around the walls; without a hull there is no
  // telling where they are, so its blur runs free.
  const known = walls !== null || !job.arrival;
  const { texels, bounds } = bake(share, known ? solid : null, job);
  const t3 = performance.now();
  let filled = 0;
  for (let v = 0; v < share.length; v++) {
    if (share[v] < 255) {
      filled++;
    }
  }
  return {
    kind: "grid",
    id: job.id,
    texels,
    span: 2 * SD_RANGE * job.vs,
    reach: reach * job.vs,
    bounds,
    stats: {
      tris: touched,
      voxelMs: t1 - t0,
      floodMs: job.arrival ? 0 : t2 - t1,
      bakeMs: t3 - t2,
      filled,
    },
  };
}

// ------------------------------------------------------------------- noise

/**
 * Tileable billow noise for eroding the cloud's edges: R is inverted Worley
 * (puffy cells), mostly the largest octave, G a finer Worley for wisps. Periodic, so
 * the texture repeats without seams.
 */
function buildNoise(size: number): Uint8Array {
  const data = new Uint8Array(size * size * size * 2);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const worleyOctave = (cells: number) => {
    const pts = new Float32Array(cells * cells * cells * 3);
    for (let i = 0; i < pts.length; i++) {
      pts[i] = rand();
    }
    const out = new Float32Array(size * size * size);
    const scale = cells / size;
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const px = (x + 0.5) * scale;
          const py = (y + 0.5) * scale;
          const pz = (z + 0.5) * scale;
          const cx = Math.floor(px);
          const cy = Math.floor(py);
          const cz = Math.floor(pz);
          let best = 9;
          for (let k = -1; k <= 1; k++) {
            for (let j = -1; j <= 1; j++) {
              for (let i = -1; i <= 1; i++) {
                const gx = cx + i;
                const gy = cy + j;
                const gz = cz + k;
                const wx = ((gx % cells) + cells) % cells;
                const wy = ((gy % cells) + cells) % cells;
                const wz = ((gz % cells) + cells) % cells;
                const o = ((wz * cells + wy) * cells + wx) * 3;
                const ddx = gx + pts[o] - px;
                const ddy = gy + pts[o + 1] - py;
                const ddz = gz + pts[o + 2] - pz;
                const d = ddx * ddx + ddy * ddy + ddz * ddz;
                if (d < best) {
                  best = d;
                }
              }
            }
          }
          out[(z * size + y) * size + x] = Math.min(1, Math.sqrt(best));
        }
      }
    }
    return out;
  };
  const w1 = worleyOctave(4);
  const w2 = worleyOctave(8);
  const w3 = worleyOctave(16);
  const w4 = worleyOctave(32);
  for (let v = 0; v < size * size * size; v++) {
    const billow = 1 - (w1[v] * 0.65 + w2[v] * 0.27 + w3[v] * 0.08);
    const wisp = 1 - (w3[v] * 0.6 + w4[v] * 0.4);
    data[v * 2] = Math.round(Math.max(0, Math.min(1, billow)) * 255);
    data[v * 2 + 1] = Math.round(Math.max(0, Math.min(1, wisp)) * 255);
  }
  return data;
}
