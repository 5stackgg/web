import { BLAST_FILE_VERSIONS } from "./assetVersions";
import type { Vec3 } from "./types";

/**
 * The C4's blast as CS2 has played it since the July 2026 (Season 5)
 * update: a shockwave that spreads from the bomb through open space, stopped
 * by walls and bending round corners, instead of a sphere that reaches
 * through them. Valve bakes its own simulation into the compiled map; this
 * is ours, from the collision hull: the hull is voxelised round the bomb and
 * the distance the wave travels to each open voxel is measured with an
 * any-angle shortest path (Lazy Theta*), so open ground gets straight-line
 * distances and the far side of a corner gets the distance round it.
 *
 * Damage then falls off with that path length the way it always fell off
 * with the straight line (`map_showbombradius`: 500 damage, 1750 radius,
 * a Gaussian with sigma = radius / 3, armour taking half).
 *
 * Pure code: the stage's worker, the generator script and the tests share it.
 */

/** The C4's damage at the bomb and its radius, source units. */
export const C4_DAMAGE = 500;
export const C4_RADIUS = 1750;
/** Armour takes half of a blast; each point of armour soaks two of damage. */
export const ARMOR_RATIO = 0.5;
export const ARMOR_BONUS = 0.5;
/**
 * How fast the front travels along its path, source units a second. Fitted
 * to the C4 kills of a post-update demo (de_inferno): victims die the tick
 * the front reaches them.
 */
export const BLAST_SPEED = 3000;
/** Voxel edge of the blast grid. */
export const BLAST_VOXEL = 32;
/** Source units per step of a packed distance; 255 is "never reached". */
export const BLAST_UNIT = 8;
export const BLAST_NEVER = 255;
/** Plant spots this close share a field. */
export const BLAST_SPOT = 32;
/** How far past the radius the field is measured, so its edge fades cleanly. */
const MARGIN = 64;
/** Voxels of the grid below and above the bomb. */
const BELOW = 16;
const ABOVE = 20;

export type BlastGrid = {
  /** Minimum corner, source units. */
  ox: number;
  oy: number;
  oz: number;
  vs: number;
  dx: number;
  dy: number;
  dz: number;
};

export type BlastField = BlastGrid & {
  /** Where the bomb went off. */
  at: Vec3;
  /**
   * Distance the wave travels to each voxel, in `BLAST_UNIT`s, x-major then
   * y then z; `BLAST_NEVER` where it never gets. Solid voxels carry their
   * nearest open neighbour's value, so a surface sampled from either side
   * reads the air in front of it.
   */
  dist: Uint8Array;
  /** Source units per step of `dist`; `BLAST_UNIT` unless a published file says. */
  unit?: number;
  /**
   * 1: Valve's baked bomb damage (a v2 file): `dist` is its phase, damage
   * comes from `power` (valveDamage). Else the browser's own flood.
   */
  model?: 0 | 1;
  /** Valve's BombPower for the site (model 1). */
  power?: number;
  /** The site's bounds as baked (model 1); see valveSiteAt. */
  bounds?: { min: number[]; max: number[] };
};

// ------------------------------------------------------------- damage

/** Raw damage at `d` units along the wave; nothing past the radius. */
export function blastDamage(d: number, radius = C4_RADIUS, damage = C4_DAMAGE) {
  if (!(d >= 0) || d > radius) {
    return 0;
  }
  const sigma = radius / 3;
  return damage * Math.exp(-(d * d) / (2 * sigma * sigma));
}

/** What a blast of `raw` takes off someone wearing `armor`. */
export function damageTaken(raw: number, armor: number) {
  if (armor <= 0 || raw <= 0) {
    return { health: Math.max(0, raw), armor: 0 };
  }
  let health = raw * ARMOR_RATIO;
  let soaked = (raw - health) * ARMOR_BONUS;
  if (soaked > armor) {
    soaked = armor;
    health = raw - armor / ARMOR_BONUS;
  }
  return { health, armor: soaked };
}

/**
 * How far along the wave the blast still takes `health` off someone wearing
 * `armor`: 0 when it does nowhere.
 */
export function lethalReach(
  health: number,
  armor = 0,
  radius = C4_RADIUS,
  damage = C4_DAMAGE,
) {
  const hurts = (d: number) =>
    damageTaken(blastDamage(d, radius, damage), armor).health >= health;
  if (!hurts(0)) {
    return 0;
  }
  if (hurts(radius)) {
    return radius;
  }
  let lo = 0;
  let hi = radius;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (hurts(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * The rings a viewer reads: `core` kills a full-health player in full
 * armour, `heavy` one without armour, and `edge` is as far as it hurts.
 */
export type BlastZones = { core: number; heavy: number; edge: number };

export function blastZones(radius = C4_RADIUS, damage = C4_DAMAGE): BlastZones {
  return {
    core: lethalReach(100, 100, radius, damage),
    heavy: lethalReach(100, 0, radius, damage),
    edge: lethalReach(1, 0, radius, damage),
  };
}

/** Above this Valve's falloff turns linear. */
export const PHASE_CAP = 1800;

/**
 * Valve's damage at `phase` from a site of `power`, as the game computes it
 * (ValveResourceFormat's BombDamage.CalculateDamage): 100 * power / phase up
 * to 1800, then a straight fall to nothing at 1800 + power.
 */
export function valveDamage(phase: number, power: number) {
  if (phase === 0) {
    return phase >= power ? 0 : 100;
  }
  const damage = 100 - (100 * (phase - power)) / Math.min(phase, PHASE_CAP);
  return Math.min(255, Math.max(0, damage));
}

/** A field's zones: from Valve's damage for a baked site, else the generic ones. */
export function fieldZones(field: BlastField): BlastZones {
  const power = field.power ?? 0;
  if (field.model !== 1 || power <= 0) {
    return blastZones();
  }
  const reach = (health: number, armor: number) => {
    const hurts = (d: number) =>
      damageTaken(valveDamage(Math.max(d, 1), power), armor).health >= health;
    let lo = 0;
    let hi = PHASE_CAP + power;
    if (!hurts(lo)) {
      return 0;
    }
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (hurts(mid)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  };
  return { core: reach(100, 100), heavy: reach(100, 0), edge: reach(1, 0) };
}

/**
 * The baked field of the site a bomb at `at` belongs to: the first whose
 * bounds, grown by 32 as the game grows them, hold it.
 */
export function valveSiteAt(sites: BlastSite[], at: Vec3): BlastField | null {
  for (const { field } of sites) {
    const b = field.bounds;
    if (field.model !== 1 || !b) {
      continue;
    }
    const p = [at.x, at.y, at.z];
    if (p.every((v, k) => v >= b.min[k] - 32 && v <= b.max[k] + 32)) {
      return field;
    }
  }
  return null;
}

/** Plant spots within `BLAST_SPOT` of each other share this key. */
export function blastSpotKey(at: Vec3) {
  return `${Math.round(at.x / BLAST_SPOT)},${Math.round(at.y / BLAST_SPOT)},${Math.round(at.z / BLAST_SPOT)}`;
}

// --------------------------------------------------------------- grid

/** The grid round a bomb at `at`, the bomb just above a voxel boundary. */
export function blastGrid(
  at: Vec3,
  vs = BLAST_VOXEL,
  radius = C4_RADIUS,
): BlastGrid {
  const half = Math.ceil((radius + MARGIN) / vs);
  return {
    ox: at.x - half * vs,
    oy: at.y - half * vs,
    // The plant spot is on the floor: put a boundary just above it, so the
    // bomb's own voxel is open air.
    oz: at.z + 2 - BELOW * vs,
    vs,
    dx: half * 2,
    dy: half * 2,
    dz: BELOW + ABOVE,
  };
}

// ---------------------------------------------------------- hull index

const CELL = 128;

/** The hull's triangles bucketed by the 2D cells their footprints touch. */
export type TriIndex = {
  tri: Float32Array;
  x0: number;
  y0: number;
  w: number;
  h: number;
  start: Uint32Array;
  ids: Uint32Array;
  seen: Uint32Array;
  stamp: number;
};

export function indexTris(tri: Float32Array): TriIndex {
  const count = Math.floor(tri.length / 9);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count * 9; i += 3) {
    if (tri[i] < minX) minX = tri[i];
    if (tri[i] > maxX) maxX = tri[i];
    if (tri[i + 1] < minY) minY = tri[i + 1];
    if (tri[i + 1] > maxY) maxY = tri[i + 1];
  }
  if (!count) {
    minX = minY = maxX = maxY = 0;
  }
  const w = Math.floor((maxX - minX) / CELL) + 1;
  const h = Math.floor((maxY - minY) / CELL) + 1;
  const span = (t: number) => {
    const o = t * 9;
    return [
      Math.floor((Math.min(tri[o], tri[o + 3], tri[o + 6]) - minX) / CELL),
      Math.floor((Math.max(tri[o], tri[o + 3], tri[o + 6]) - minX) / CELL),
      Math.floor((Math.min(tri[o + 1], tri[o + 4], tri[o + 7]) - minY) / CELL),
      Math.floor((Math.max(tri[o + 1], tri[o + 4], tri[o + 7]) - minY) / CELL),
    ];
  };
  const start = new Uint32Array(w * h + 1);
  for (let t = 0; t < count; t++) {
    const [c0, c1, r0, r1] = span(t);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        start[r * w + c + 1]++;
      }
    }
  }
  for (let i = 1; i < start.length; i++) {
    start[i] += start[i - 1];
  }
  const ids = new Uint32Array(start[start.length - 1]);
  const fill = start.slice(0, -1);
  for (let t = 0; t < count; t++) {
    const [c0, c1, r0, r1] = span(t);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        ids[fill[r * w + c]++] = t;
      }
    }
  }
  return {
    tri,
    x0: minX,
    y0: minY,
    w,
    h,
    start,
    ids,
    seen: new Uint32Array(count),
    stamp: 0,
  };
}

/** Calls `visit` once for every triangle whose footprint may reach the box. */
function trisNear(
  index: TriIndex,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  visit: (t: number) => void,
) {
  const c0 = Math.max(0, Math.floor((x0 - index.x0) / CELL));
  const c1 = Math.min(index.w - 1, Math.floor((x1 - index.x0) / CELL));
  const r0 = Math.max(0, Math.floor((y0 - index.y0) / CELL));
  const r1 = Math.min(index.h - 1, Math.floor((y1 - index.y0) / CELL));
  const stamp = ++index.stamp;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const cell = r * index.w + c;
      for (let s = index.start[cell]; s < index.start[cell + 1]; s++) {
        const t = index.ids[s];
        if (index.seen[t] !== stamp) {
          index.seen[t] = stamp;
          visit(t);
        }
      }
    }
  }
}

/**
 * The highest upward-facing surface under (x, y) between `top` and
 * `bottom`, or null: where a bomb dropped there would come to rest.
 */
export function floorBelow(
  index: TriIndex,
  x: number,
  y: number,
  top: number,
  bottom: number,
): number | null {
  const t = index.tri;
  let best: number | null = null;
  trisNear(index, x, y, x, y, (id) => {
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
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(nz) < 1e-9) {
      return;
    }
    const u = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / nz;
    const v = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / nz;
    const w = 1 - u - v;
    if (u < -1e-6 || v < -1e-6 || w < -1e-6) {
      return;
    }
    const z = u * az + v * bz + w * cz;
    if (z <= top && z >= bottom && (best === null || z > best)) {
      best = z;
    }
  });
  return best;
}

/**
 * Marks every voxel a triangle of the hull passes through (separating axis
 * test against the voxel box), as the smoke grids do.
 */
export function voxelizeHull(index: TriIndex, grid: BlastGrid): Uint8Array {
  const t = index.tri;
  const { ox, oy, oz, vs, dx, dy, dz } = grid;
  const solid = new Uint8Array(dx * dy * dz);
  const x1 = ox + dx * vs;
  const y1 = oy + dy * vs;
  const z1 = oz + dz * vs;
  const e = 1e-3;
  const h = vs / 2 + e;
  const axes = new Float64Array(10 * 6);
  trisNear(index, ox, oy, x1, y1, (id) => {
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
    const minX = Math.min(ax, bx, cx);
    const maxX = Math.max(ax, bx, cx);
    const minY = Math.min(ay, by, cy);
    const maxY = Math.max(ay, by, cy);
    const minZ = Math.min(az, bz, cz);
    const maxZ = Math.max(az, bz, cz);
    if (
      maxX < ox ||
      minX > x1 ||
      maxY < oy ||
      minY > y1 ||
      maxZ < oz ||
      minZ > z1
    ) {
      return;
    }
    const i0 = Math.max(0, Math.floor((minX - ox - e) / vs));
    const i1 = Math.min(dx - 1, Math.floor((maxX - ox + e) / vs));
    const j0 = Math.max(0, Math.floor((minY - oy - e) / vs));
    const j1 = Math.min(dy - 1, Math.floor((maxY - oy + e) / vs));
    const k0 = Math.max(0, Math.floor((minZ - oz - e) / vs));
    const k1 = Math.min(dz - 1, Math.floor((maxZ - oz + e) / vs));
    if (i0 === i1 && j0 === j1 && k0 === k1) {
      solid[(k0 * dy + j0) * dx + i0] = 1;
      return;
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
            const centre = axes[q] * px + axes[q + 1] * py + axes[q + 2] * pz;
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
  });
  return solid;
}

// ------------------------------------------------------------ geodesic

/**
 * Whether the segment between two points (voxel units) crosses only open
 * voxels. Walks every voxel it passes through; where it crosses an edge or
 * a corner exactly it steps one axis at a time, so it cannot slip between
 * two solids that meet diagonally.
 */
export function lineClear(
  solid: Uint8Array,
  dx: number,
  dy: number,
  dz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): boolean {
  let i = Math.floor(ax);
  let j = Math.floor(ay);
  let k = Math.floor(az);
  const ie = Math.floor(bx);
  const je = Math.floor(by);
  const ke = Math.floor(bz);
  const vx = bx - ax;
  const vy = by - ay;
  const vz = bz - az;
  const sx = vx > 0 ? 1 : -1;
  const sy = vy > 0 ? 1 : -1;
  const sz = vz > 0 ? 1 : -1;
  const tdx = vx !== 0 ? Math.abs(1 / vx) : Infinity;
  const tdy = vy !== 0 ? Math.abs(1 / vy) : Infinity;
  const tdz = vz !== 0 ? Math.abs(1 / vz) : Infinity;
  let tx = vx > 0 ? (i + 1 - ax) * tdx : vx < 0 ? (ax - i) * tdx : Infinity;
  let ty = vy > 0 ? (j + 1 - ay) * tdy : vy < 0 ? (ay - j) * tdy : Infinity;
  let tz = vz > 0 ? (k + 1 - az) * tdz : vz < 0 ? (az - k) * tdz : Infinity;
  const steps = Math.abs(ie - i) + Math.abs(je - j) + Math.abs(ke - k);
  for (let n = 0; n < steps; n++) {
    if (tx <= ty && tx <= tz) {
      i += sx;
      tx += tdx;
    } else if (ty <= tz) {
      j += sy;
      ty += tdy;
    } else {
      k += sz;
      tz += tdz;
    }
    if (i < 0 || j < 0 || k < 0 || i >= dx || j >= dy || k >= dz) {
      return false;
    }
    if (solid[(k * dy + j) * dx + i]) {
      return false;
    }
  }
  return true;
}

/** 26 neighbours: offsets, step length, and the axis steps a diagonal must not cut. */
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
        const parts: Array<[number, number, number]> = [];
        if (i) parts.push([i, 0, 0]);
        if (j) parts.push([0, j, 0]);
        if (k) parts.push([0, 0, k]);
        const via = parts.length > 1 ? [...parts] : [];
        if (parts.length === 3) {
          via.push([i, j, 0], [i, 0, k], [0, j, k]);
        }
        list.push({ d: [i, j, k], cost: Math.hypot(i, j, k), via });
      }
    }
  }
  return list;
})();

function createHeap() {
  let keys = new Float32Array(1 << 14);
  let items = new Int32Array(1 << 14);
  let length = 0;
  return {
    size: () => length,
    peek: () => keys[0],
    push(key: number, item: number) {
      if (length === keys.length) {
        const nk = new Float32Array(length * 2);
        nk.set(keys);
        keys = nk;
        const ni = new Int32Array(length * 2);
        ni.set(items);
        items = ni;
      }
      let p = length++;
      while (p > 0) {
        const parent = (p - 1) >> 1;
        if (keys[parent] <= key) {
          break;
        }
        keys[p] = keys[parent];
        items[p] = items[parent];
        p = parent;
      }
      keys[p] = key;
      items[p] = item;
    },
    pop() {
      const top = items[0];
      const lastK = keys[--length];
      const lastI = items[length];
      let p = 0;
      for (;;) {
        let child = p * 2 + 1;
        if (child >= length) {
          break;
        }
        if (child + 1 < length && keys[child + 1] < keys[child]) {
          child++;
        }
        if (keys[child] >= lastK) {
          break;
        }
        keys[p] = keys[child];
        items[p] = items[child];
        p = child;
      }
      keys[p] = lastK;
      items[p] = lastI;
      return top;
    },
  };
}

/**
 * The open voxel the wave starts from: the one holding `o` (voxel units),
 * else the nearest open one, preferring up. -1 when it is buried.
 */
function startVoxel(
  solid: Uint8Array,
  grid: BlastGrid,
  o: [number, number, number],
) {
  const { dx, dy, dz } = grid;
  const i = Math.floor(o[0]);
  const j = Math.floor(o[1]);
  const k = Math.floor(o[2]);
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r <= 3 && best < 0; r++) {
    for (let dk = -r; dk <= r; dk++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj), Math.abs(dk)) !== r) {
            continue;
          }
          const a = i + di;
          const b = j + dj;
          const c = k + dk;
          if (a < 0 || b < 0 || c < 0 || a >= dx || b >= dy || c >= dz) {
            continue;
          }
          const v = (c * dy + b) * dx + a;
          if (solid[v]) {
            continue;
          }
          // Up is cheaper: a bomb in a floor crease belongs above it.
          const d = Math.hypot(di, dj, dk) - (dk > 0 ? 0.25 : 0);
          if (d < bestD) {
            bestD = d;
            best = v;
          }
        }
      }
    }
  }
  return best;
}

/**
 * Distance the wave travels from `origin` to every open voxel, source
 * units; Infinity for solid voxels and for anywhere it does not get within
 * `maxDist`. Any-angle (Lazy Theta*): each voxel keeps the last corner its
 * path bends round, and its distance is that corner's plus the straight
 * line from it, so open ground reads true circles rather than the octagons
 * a grid walk gives.
 */
export function geodesicField(
  solid: Uint8Array,
  grid: BlastGrid,
  origin: Vec3,
  maxDist: number,
): Float32Array {
  const { dx, dy, dz, vs } = grid;
  const size = dx * dy * dz;
  const g = new Float32Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-2);
  const closed = new Uint8Array(size);
  const o: [number, number, number] = [
    (origin.x - grid.ox) / vs,
    (origin.y - grid.oy) / vs,
    (origin.z - grid.oz) / vs,
  ];
  const start = startVoxel(solid, grid, o);
  if (start < 0) {
    return g;
  }
  const centre = (v: number, out: number[]) => {
    out[0] = (v % dx) + 0.5;
    out[1] = (Math.floor(v / dx) % dy) + 0.5;
    out[2] = Math.floor(v / (dx * dy)) + 0.5;
  };
  const sc = [0, 0, 0];
  centre(start, sc);
  // The origin itself is the root pivot (-1), unless the bomb's voxel was
  // solid and the walk had to start beside it.
  const rootOpen =
    !solid[(Math.floor(o[2]) * dy + Math.floor(o[1])) * dx + Math.floor(o[0])];
  const root: number[] = rootOpen ? o : [sc[0], sc[1], sc[2]];
  const maxVox = maxDist / vs;
  const offsets = NEIGHBOURS.map(({ d, via, cost }) => ({
    di: d[0],
    dj: d[1],
    dk: d[2],
    off: d[0] + d[1] * dx + d[2] * dx * dy,
    via: via.map((p) => p[0] + p[1] * dx + p[2] * dx * dy),
    cost,
  }));
  const heap = createHeap();
  g[start] = Math.hypot(sc[0] - root[0], sc[1] - root[1], sc[2] - root[2]);
  parent[start] = -1;
  heap.push(g[start], start);
  const pc = [0, 0, 0];
  const mc = [0, 0, 0];
  const pivot = (p: number, out: number[]) => {
    if (p === -1) {
      out[0] = root[0];
      out[1] = root[1];
      out[2] = root[2];
      return 0;
    }
    centre(p, out);
    return g[p];
  };
  const moveOpen = (v: number, n: number) => {
    const via = offsets[n].via;
    for (let q = 0; q < via.length; q++) {
      if (solid[v + via[q]]) {
        return false;
      }
    }
    return true;
  };

  while (heap.size() > 0) {
    const key = heap.peek();
    const s = heap.pop();
    if (closed[s] || key > g[s] + 1e-4) {
      continue;
    }
    centre(s, sc);
    const si = sc[0] - 0.5;
    const sj = sc[1] - 0.5;
    const sk = sc[2] - 0.5;
    // Lazy Theta*: the path was assumed to run straight from the parent's
    // pivot; if it does not, take the best settled neighbour instead.
    const p = parent[s];
    if (p !== -1 || s !== start) {
      pivot(p, pc);
      if (
        !lineClear(solid, dx, dy, dz, pc[0], pc[1], pc[2], sc[0], sc[1], sc[2])
      ) {
        let best = Infinity;
        let bestN = -1;
        for (let n = 0; n < offsets.length; n++) {
          const ni = si + offsets[n].di;
          const nj = sj + offsets[n].dj;
          const nk = sk + offsets[n].dk;
          if (ni < 0 || nj < 0 || nk < 0 || ni >= dx || nj >= dy || nk >= dz) {
            continue;
          }
          const m = s + offsets[n].off;
          if (!closed[m] || !moveOpen(s, n)) {
            continue;
          }
          const c = g[m] + offsets[n].cost;
          if (c < best) {
            best = c;
            bestN = m;
          }
        }
        if (bestN >= 0) {
          g[s] = best;
          parent[s] = bestN;
        }
      }
    }
    closed[s] = 1;
    if (g[s] > maxVox) {
      continue;
    }
    const pp = parent[s];
    const pg = pivot(pp, pc);
    for (let n = 0; n < offsets.length; n++) {
      const ni = si + offsets[n].di;
      const nj = sj + offsets[n].dj;
      const nk = sk + offsets[n].dk;
      if (ni < 0 || nj < 0 || nk < 0 || ni >= dx || nj >= dy || nk >= dz) {
        continue;
      }
      const m = s + offsets[n].off;
      if (closed[m] || solid[m] || !moveOpen(s, n)) {
        continue;
      }
      mc[0] = ni + 0.5;
      mc[1] = nj + 0.5;
      mc[2] = nk + 0.5;
      const c = pg + Math.hypot(mc[0] - pc[0], mc[1] - pc[1], mc[2] - pc[2]);
      if (c < g[m]) {
        g[m] = c;
        parent[m] = pp;
        heap.push(c, m);
      }
    }
  }
  for (let v = 0; v < size; v++) {
    g[v] = closed[v] && g[v] <= maxVox ? g[v] * vs : Infinity;
  }
  return g;
}

/**
 * Packs distances into `BLAST_UNIT` steps, then gives every solid voxel its
 * nearest open neighbour's value (one layer), so a texture sampled at a
 * surface reads the air beside it instead of "never".
 */
export function packField(
  dist: Float32Array,
  solid: Uint8Array,
  grid: BlastGrid,
): Uint8Array {
  const { dx, dy, dz } = grid;
  const out = new Uint8Array(dist.length);
  for (let v = 0; v < dist.length; v++) {
    const d = dist[v];
    out[v] = Number.isFinite(d)
      ? Math.min(BLAST_NEVER - 1, Math.round(d / BLAST_UNIT))
      : BLAST_NEVER;
  }
  const plane = dx * dy;
  for (let k = 0; k < dz; k++) {
    for (let j = 0; j < dy; j++) {
      for (let i = 0; i < dx; i++) {
        const v = (k * dy + j) * dx + i;
        if (!solid[v]) {
          continue;
        }
        let best = BLAST_NEVER;
        const look = (m: number) => {
          if (!solid[m] && out[m] < best) {
            best = out[m];
          }
        };
        if (i > 0) look(v - 1);
        if (i < dx - 1) look(v + 1);
        if (j > 0) look(v - dx);
        if (j < dy - 1) look(v + dx);
        if (k > 0) look(v - plane);
        if (k < dz - 1) look(v + plane);
        out[v] = best;
      }
    }
  }
  return out;
}

export type BlastStats = {
  voxelMs: number;
  floodMs: number;
  voxels: number;
  reached: number;
};

/** The whole job: voxelise round the bomb, flood, pack. */
export function computeBlastField(
  index: TriIndex,
  at: Vec3,
  options: { vs?: number; radius?: number } = {},
): { field: BlastField; stats: BlastStats } {
  const radius = options.radius ?? C4_RADIUS;
  const grid = blastGrid(at, options.vs ?? BLAST_VOXEL, radius);
  const t0 = now();
  const solid = voxelizeHull(index, grid);
  const t1 = now();
  // The C4 sits on the floor; the blast starts from its body.
  const origin = { x: at.x, y: at.y, z: at.z + 12 };
  const dist = geodesicField(solid, grid, origin, radius + MARGIN);
  const packed = packField(dist, solid, grid);
  const t2 = now();
  let reached = 0;
  for (let v = 0; v < dist.length; v++) {
    if (dist[v] < Infinity) reached++;
  }
  return {
    field: { ...grid, at: { x: at.x, y: at.y, z: at.z }, dist: packed },
    stats: { voxelMs: t1 - t0, floodMs: t2 - t1, voxels: dist.length, reached },
  };
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * The wave's path length to a point, source units, interpolated between
 * the voxels round it that it reaches; null where it never gets.
 */
export function fieldDistance(
  field: BlastField,
  x: number,
  y: number,
  z: number,
): number | null {
  const { ox, oy, oz, vs, dx, dy, dz, dist } = field;
  const fx = (x - ox) / vs - 0.5;
  const fy = (y - oy) / vs - 0.5;
  const fz = (z - oz) / vs - 0.5;
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const k0 = Math.floor(fz);
  let sum = 0;
  let weight = 0;
  for (let c = 0; c < 8; c++) {
    const i = i0 + (c & 1);
    const j = j0 + ((c >> 1) & 1);
    const k = k0 + ((c >> 2) & 1);
    if (i < 0 || j < 0 || k < 0 || i >= dx || j >= dy || k >= dz) {
      continue;
    }
    const q = dist[(k * dy + j) * dx + i];
    if (q === BLAST_NEVER) {
      continue;
    }
    const w =
      (c & 1 ? fx - i0 : 1 - (fx - i0)) *
      ((c >> 1) & 1 ? fy - j0 : 1 - (fy - j0)) *
      ((c >> 2) & 1 ? fz - k0 : 1 - (fz - k0));
    sum += q * w;
    weight += w;
  }
  return weight > 1e-6 ? (sum / weight) * (field.unit ?? BLAST_UNIT) : null;
}

// ------------------------------------------------------- published file

/**
 * `<map>.blast.bin(.gz)`: the field from each bomb site's centre, made by
 * scripts/replay-stage/build-blast.mjs.
 *
 *   "5SBL" u16 version u16 count u32 hull triangles
 *   per site: u8 letter, 3 pad, f32 at.xyz, f32 ox oy oz vs,
 *             u16 dx dy dz, u16 pad, u32 bytes, the packed distances, pad to 4
 *
 * The triangle count is a cheap check that it was made from the hull in
 * use; the browser computes for itself when it differs.
 *
 * Version 2 is Valve's baked bomb damage, written by the map-asset job
 * (scripts/extract-map-blast.mjs; docs/3d-replay-map-meshes.md): 72-byte
 * site headers whose bytes 1-3 are the model (1 = Valve) and the unit, 44
 * the site's power, 48-71 its baked bounds; the values are the phase in
 * `unit` steps (0 = exactly 0, 255 = not reached).
 */
export const BLAST_FILE_MAGIC = "5SBL";
export const BLAST_FILE_VERSION = 1;

export type BlastSite = { site: "A" | "B"; field: BlastField };

export function packBlastFile(
  sites: BlastSite[],
  triangles: number,
): Uint8Array {
  let bytes = 12;
  for (const s of sites) {
    bytes += 48 + ((s.field.dist.length + 3) & ~3);
  }
  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) {
    out[i] = BLAST_FILE_MAGIC.charCodeAt(i);
  }
  view.setUint16(4, BLAST_FILE_VERSION, true);
  view.setUint16(6, sites.length, true);
  view.setUint32(8, triangles, true);
  let o = 12;
  for (const { site, field } of sites) {
    out[o] = site.charCodeAt(0);
    view.setFloat32(o + 4, field.at.x, true);
    view.setFloat32(o + 8, field.at.y, true);
    view.setFloat32(o + 12, field.at.z, true);
    view.setFloat32(o + 16, field.ox, true);
    view.setFloat32(o + 20, field.oy, true);
    view.setFloat32(o + 24, field.oz, true);
    view.setFloat32(o + 28, field.vs, true);
    view.setUint16(o + 32, field.dx, true);
    view.setUint16(o + 34, field.dy, true);
    view.setUint16(o + 36, field.dz, true);
    view.setUint32(o + 40, field.dist.length, true);
    o += 48;
    out.set(field.dist, o);
    o += (field.dist.length + 3) & ~3;
  }
  return out;
}

export function unpackBlastFile(
  buffer: ArrayBuffer,
): { triangles: number; sites: BlastSite[] } | null {
  if (buffer.byteLength < 12) {
    return null;
  }
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const version = view.getUint16(4, true);
  if (magic !== BLAST_FILE_MAGIC || !BLAST_FILE_VERSIONS.includes(version)) {
    return null;
  }
  const head = version === 2 ? 72 : 48;
  const count = view.getUint16(6, true);
  const triangles = view.getUint32(8, true);
  const sites: BlastSite[] = [];
  let o = 12;
  for (let n = 0; n < count; n++) {
    if (o + head > buffer.byteLength) {
      return null;
    }
    const letter = String.fromCharCode(bytes[o]);
    const dx = view.getUint16(o + 32, true);
    const dy = view.getUint16(o + 34, true);
    const dz = view.getUint16(o + 36, true);
    const length = view.getUint32(o + 40, true);
    if (length !== dx * dy * dz || o + head + length > buffer.byteLength) {
      return null;
    }
    const f = (at: number) => view.getFloat32(o + at, true);
    if (letter === "A" || letter === "B") {
      sites.push({
        site: letter,
        field: {
          at: {
            x: view.getFloat32(o + 4, true),
            y: view.getFloat32(o + 8, true),
            z: view.getFloat32(o + 12, true),
          },
          ox: view.getFloat32(o + 16, true),
          oy: view.getFloat32(o + 20, true),
          oz: view.getFloat32(o + 24, true),
          vs: view.getFloat32(o + 28, true),
          dx,
          dy,
          dz,
          dist: bytes.slice(o + head, o + head + length),
          ...(version === 2
            ? {
                model: bytes[o + 1] === 1 ? (1 as const) : (0 as const),
                unit: view.getUint16(o + 2, true) || BLAST_UNIT,
                power: f(44),
                bounds: {
                  min: [f(48), f(52), f(56)],
                  max: [f(60), f(64), f(68)],
                },
              }
            : {}),
        },
      });
    }
    o += head + ((length + 3) & ~3);
  }
  return { triangles, sites };
}

// ----------------------------------------------------------- bomb sites

export type SiteBox = { min: number[]; max: number[] };

/**
 * Where a site's generic blast is measured from: the middle of its plant
 * zone (the palette's decal rect when the map has one, else its callout
 * box), on the floor there (`floorAt`: the highest floor under x, y between
 * `top` and `bottom`). Null when the map names no such site.
 */
export function siteCentre(
  letter: "A" | "B",
  callouts: Array<{ name: string; boxes: SiteBox[] }>,
  rect: [number, number, number, number] | null | undefined,
  floorAt: (x: number, y: number, top: number, bottom: number) => number | null,
): Vec3 | null {
  const box = callouts.find((c) => c.name === `Bombsite${letter}`)?.boxes[0];
  if (!box && !rect) {
    return null;
  }
  const x = rect ? (rect[0] + rect[2]) / 2 : (box!.min[0] + box!.max[0]) / 2;
  const y = rect ? (rect[1] + rect[3]) / 2 : (box!.min[1] + box!.max[1]) / 2;
  const top = box ? box.max[2] : 1e5;
  const bottom = box ? box.min[2] - 96 : -1e5;
  const floor = floorAt(x, y, top, bottom);
  return { x, y, z: floor ?? (box ? box.min[2] : 0) };
}
