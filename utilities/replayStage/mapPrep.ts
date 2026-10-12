/**
 * Turns the view mesh into what the map shader draws: one vertex per
 * triangle corner, so each triangle carries its own class, outline mask and
 * roof-cut plane (decided per patch from the floors a player can reach),
 * plus the sand that fills the map's holes and a grid for ray picks. Pure
 * CPU work, run in a worker (`mapPrep.worker.ts`) so loading a map does not
 * stall.
 */

export type PrepChunk = {
  positions: Float32Array;
  floorZ: Float32Array;
  flags: Uint8Array;
  indices: Uint32Array;
};

export type PrepMesh = {
  /** Source units, 9 floats per triangle. */
  positions: Float32Array;
  /** Height above the vertex's own floor, clamped; NO_FLOOR when it has none. */
  height: Int16Array;
  /** Per corner, same for all three: see INFO_*. */
  info: Uint16Array;
  /**
   * Three per corner, same for all three: the floor height the roof cut is
   * measured from (NO_CUT when this surface is never cut), the top of the
   * surface's group, and the bottom of its patch (see `cutAway` in
   * mapShaders.ts for how they decide).
   */
  cut: Int16Array;
  /** Per corner, 0..255: how far from anywhere a player goes (scenery fades). */
  remote: Uint8Array;
  /**
   * Four signed bytes per corner, foliage only (zero elsewhere): the normal
   * its tree is lit with (out from the middle of the foliage round it, so a
   * canopy shades as one soft ball rather than card by card), and a per-tree
   * tone in w.
   */
  canopy: Int8Array;
  /**
   * Triangles from here on carry a cut plane; the ghost passes draw only
   * these (the solid mesh is ordered so they come last).
   */
  cuttableStart: number;
  /**
   * From here on, triangles a cut of GHOST_HEIGHT takes too (the 3D ghost);
   * those between `cuttableStart` and here are only cut lower, in 2D.
   */
  ghostStart: number;
};

/** Walkable floor heights per xy cell: what the roof cut measures from. */
type FloorLevels = {
  minX: number;
  minY: number;
  cell: number;
  width: number;
  height: number;
  /** Up to four walkable heights per cell, EMPTY_LEVEL when unused. */
  levels: Float32Array;
  /** 255 where the cell has floor of its own (before `growLevels`). */
  coverage: Uint8Array;
};

/** The solid mesh's triangles bucketed by xy cell, for ray picks (mapPick.ts). */
export type PickGrid = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  cell: number;
  nx: number;
  ny: number;
  /** Where each cell's triangles start in `items`; one entry more than cells. */
  start: Uint32Array;
  items: Uint32Array;
};

/**
 * A height for every cell near the map, under it or in its holes: the
 * extractor drops ground nobody can reach, and through those holes the
 * dunes far below would show as floor at the wrong height.
 */
export type GroundFill = {
  minX: number;
  minY: number;
  cell: number;
  width: number;
  height: number;
  /** Per grid point, source units. */
  z: Float32Array;
  /**
   * 0..255, how far the map closes in round each open point (a courtyard
   * nobody can enter is 255): painted as ground there, not as the table
   * outside the map.
   */
  enclosed: Uint8Array;
  /** 0..255, distance from the map's walls, saturating a couple of cells out. */
  open: Uint8Array;
  /** How far past the mesh's bounds the grid reaches, source units. */
  reach: number;
  /** The ground height round the map, where the dunes' plateau sits. */
  level: number;
};

export type PrepResult = {
  solid: PrepMesh;
  seeThrough: PrepMesh;
  pick: PickGrid;
  ground: GroundFill;
  ms: number;
};

/**
 * What the slow part of prep decides, small enough to cache and to publish
 * next to the map's meshes (mapPrepPack.ts): per source triangle its class
 * and cut, per source vertex its fade and canopy normal, the draw order, and
 * the ground. `expandPrep` turns it back into a `PrepResult` with the view
 * mesh in a few dozen milliseconds.
 */
export type PrepCore = {
  /** Source triangles (numbered across chunks) in drawing order. */
  solidOrder: Uint32Array;
  seeOrder: Uint32Array;
  /** Where the cuttable and the 3D-ghosted triangles start in each order. */
  solidCuttable: number;
  solidGhost: number;
  seeCuttable: number;
  seeGhost: number;
  /** Per source triangle. */
  info: Uint16Array;
  /** Per source triangle, three: see `PrepMesh.cut`. */
  cut: Int16Array;
  /** Per source vertex. */
  remote: Uint8Array;
  /** Per source vertex, four: see `PrepMesh.canopy`. */
  canopy: Int8Array;
  ground: GroundFill;
  ms: number;
};

export const INFO_SURFACE = 0b11;
export const INFO_OUTSIDE = 0b100;
export const INFO_WALKABLE = 0b1000;
/** Bits 4-6: outline on the edge opposite corner 0, 1, 2. */
export const INFO_EDGE_SHIFT = 4;
export const INFO_NO_FLOOR = 0b10000000;
/**
 * Out-of-bounds ground: flat, with no floor under it, low, at about the
 * ground round the map. Painted as the table the map stands on; anything else
 * floorless (out-of-bounds buildings) keeps the map's own colours.
 */
export const INFO_GROUND = 1 << 13;
/** Part of something wire-like: cables, poles, thin trim. */
export const INFO_THIN = 0b100000000;
/** Bits 9-10: which prop tone (1-3), 0 for none. */
export const INFO_PROP_SHIFT = 9;
/**
 * The roof cut reaches this surface through a wall (its own patch is a wall,
 * or it took its plane from one): only the 2D view cuts it, so 3D keeps
 * whole walls and opens buildings from the top.
 */
export const INFO_CUT_WALL = 1 << 11;
/** A wall-type surface that still goes whole: part of a small loose piece. */
export const INFO_CUT_WHOLE = 1 << 12;

export const NO_FLOOR = 32767;
export const NO_CUT = 32767;
/** The 3D cut height (map.ts): above it a building turns to a ghost. */
export const GHOST_HEIGHT = 176;
export const EMPTY_LEVEL = 1e9;

const SURFACE_FOLIAGE = 1;
const SURFACE_SEE_THROUGH = 2;
const FLAG_OUTSIDE = 0b100;
const ON_FLOOR = 16;
const LEVEL_CELL = 16;
const LEVEL_MERGE = 40;
// Creases sharper than this get an outline.
const CREASE_COS = Math.cos((32 * Math.PI) / 180);
const CORRUGATION_EDGE = 64;

function nextPow2(n: number) {
  let p = 1;
  while (p < n) {
    p <<= 1;
  }
  return p;
}

/**
 * The highest reachable floor within `reach` of a point, from a coarse grid
 * (a few cells to the block) max-filtered once; -Infinity where none is.
 */
function nearestTopLevel(floors: FloorLevels, reach: number) {
  const { minX, minY, cell, width, height, levels, coverage } = floors;
  const step = Math.max(1, Math.round(64 / cell));
  const w = Math.ceil(width / step);
  const h = Math.ceil(height / step);
  const coarse = new Float32Array(w * h).fill(-Infinity);
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const at = gy * width + gx;
      if (!coverage[at]) {
        continue;
      }
      const c = Math.floor(gy / step) * w + Math.floor(gx / step);
      for (let k = 0; k < 4; k++) {
        const level = levels[at * 4 + k];
        if (level !== EMPTY_LEVEL && level > coarse[c]) {
          coarse[c] = level;
        }
      }
    }
  }
  const radius = Math.ceil(reach / (cell * step));
  const negated = Float32Array.from(coarse, (v) => -v);
  const top = minFilter(negated, w, h, radius);
  return (x: number, y: number) => {
    const cx = Math.floor((x - minX) / (cell * step));
    const cy = Math.floor((y - minY) / (cell * step));
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) {
      return -Infinity;
    }
    return -top[cy * w + cx];
  };
}

/**
 * Every structural surface that is not a wall, per floor-grid cell, as the
 * height it crosses the cell centre at: what a vertical ray meets. Props,
 * wires, leaves and glass are left out, as clutter a roof test looks past.
 */
function surfaceColumns(
  vx: Float32Array,
  tris: Uint32Array,
  info: Uint16Array,
  normals: Float32Array,
  triTotal: number,
  floors: FloorLevels,
) {
  const { minX, minY, cell, width, height } = floors;
  const cells = width * height;
  const start = new Uint32Array(cells + 1);
  const skip = (t: number) =>
    Math.abs(normals[t * 3 + 2]) < 0.2 ||
    (info[t] & INFO_SURFACE) !== 0 ||
    (info[t] & INFO_THIN) !== 0 ||
    ((info[t] >> INFO_PROP_SHIFT) & 3) !== 0;
  const visit = (t: number, fn: (at: number, z: number) => void) => {
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const ax = vx[a];
    const ay = vx[a + 1];
    const bx = vx[b];
    const by = vx[b + 1];
    const cx = vx[c];
    const cy = vx[c + 1];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-3) {
      return;
    }
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / cell));
    const x1 = Math.min(
      width - 1,
      Math.floor((Math.max(ax, bx, cx) - minX) / cell),
    );
    const y0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - minY) / cell));
    const y1 = Math.min(
      height - 1,
      Math.floor((Math.max(ay, by, cy) - minY) / cell),
    );
    for (let gy = y0; gy <= y1; gy++) {
      const py = minY + (gy + 0.5) * cell;
      for (let gx = x0; gx <= x1; gx++) {
        const px = minX + (gx + 0.5) * cell;
        const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        if (u < -1e-4 || v < -1e-4 || u + v > 1 + 1e-4) {
          continue;
        }
        fn(
          gy * width + gx,
          u * vx[a + 2] + v * vx[b + 2] + (1 - u - v) * vx[c + 2],
        );
      }
    }
  };
  for (let t = 0; t < triTotal; t++) {
    if (!skip(t)) {
      visit(t, (at) => start[at + 1]++);
    }
  }
  for (let i = 0; i < cells; i++) {
    start[i + 1] += start[i];
  }
  const z = new Float32Array(start[cells]);
  const fill = start.slice(0, cells);
  for (let t = 0; t < triTotal; t++) {
    if (!skip(t)) {
      visit(t, (at, height) => {
        z[fill[at]++] = height;
      });
    }
  }
  return {
    /** Whether any structural surface lies under (x, y) below `below`. */
    anyBelow(x: number, y: number, below: number) {
      const gx = Math.floor((x - minX) / cell);
      const gy = Math.floor((y - minY) / cell);
      if (gx < 0 || gy < 0 || gx >= width || gy >= height) {
        return false;
      }
      const at = gy * width + gx;
      for (let i = start[at]; i < start[at + 1]; i++) {
        if (z[i] < below) {
          return true;
        }
      }
      return false;
    },
    /** Whether any structural surface crosses (x, y) between `lo` and `hi`. */
    anyBetween(x: number, y: number, lo: number, hi: number) {
      const gx = Math.floor((x - minX) / cell);
      const gy = Math.floor((y - minY) / cell);
      if (lo >= hi || gx < 0 || gy < 0 || gx >= width || gy >= height) {
        return false;
      }
      const at = gy * width + gx;
      for (let i = start[at]; i < start[at + 1]; i++) {
        if (z[i] > lo && z[i] < hi) {
          return true;
        }
      }
      return false;
    },
  };
}

/**
 * Distance (source units) from any point to the nearest floor a player can
 * reach, from a two-pass chamfer transform over the floor grid.
 */
function floorDistance(floors: FloorLevels) {
  const { minX, minY, cell, width, height, coverage } = floors;
  const far = new Float32Array(width * height).fill(Infinity);
  for (let i = 0; i < far.length; i++) {
    if (coverage[i]) {
      far[i] = 0;
    }
  }
  const diag = cell * Math.SQRT2;
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const at = gy * width + gx;
      let d = far[at];
      if (gx > 0) d = Math.min(d, far[at - 1] + cell);
      if (gy > 0) {
        d = Math.min(d, far[at - width] + cell);
        if (gx > 0) d = Math.min(d, far[at - width - 1] + diag);
        if (gx + 1 < width) d = Math.min(d, far[at - width + 1] + diag);
      }
      far[at] = d;
    }
  }
  for (let gy = height - 1; gy >= 0; gy--) {
    for (let gx = width - 1; gx >= 0; gx--) {
      const at = gy * width + gx;
      let d = far[at];
      if (gx + 1 < width) d = Math.min(d, far[at + 1] + cell);
      if (gy + 1 < height) {
        d = Math.min(d, far[at + width] + cell);
        if (gx + 1 < width) d = Math.min(d, far[at + width + 1] + diag);
        if (gx > 0) d = Math.min(d, far[at + width - 1] + diag);
      }
      far[at] = d;
    }
  }
  return (x: number, y: number) => {
    const gx = Math.floor((x - minX) / cell);
    const gy = Math.floor((y - minY) / cell);
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) {
      return Infinity;
    }
    return far[gy * width + gx];
  };
}

/**
 * Out-of-bounds leftovers to drop: flat or paper-thin pieces flagged outside
 * the playable area and far from any floor a player can reach, such as a
 * lone backdrop slab standing in the sand. Buildings (solid, not planar)
 * stay, wherever they are.
 */
function strayParts(
  vx: Float32Array,
  tris: Uint32Array,
  canon: Int32Array,
  info: Uint16Array,
  normals: Float32Array,
  triTotal: number,
  floors: FloorLevels,
): Uint8Array {
  const distanceAt = floorDistance(floors);

  const parent = new Int32Array(canon.length);
  for (let i = 0; i < parent.length; i++) {
    parent[i] = i;
  }
  const find = (i: number) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let t = 0; t < triTotal; t++) {
    const a = find(canon[tris[t * 3]]);
    parent[find(canon[tris[t * 3 + 1]])] = a;
    parent[find(canon[tris[t * 3 + 2]])] = a;
  }
  const n = canon.length;
  const near = new Float32Array(n).fill(Infinity);
  const inside = new Uint8Array(n);

  const box = new Float32Array(n * 6);
  const sum = new Float64Array(n * 3);
  const area = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    box[i * 6] = box[i * 6 + 1] = box[i * 6 + 2] = Infinity;
    box[i * 6 + 3] = box[i * 6 + 4] = box[i * 6 + 5] = -Infinity;
  }
  const root = new Int32Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    const r = find(canon[tris[t * 3]]);
    root[t] = r;
    if (!(info[t] & INFO_OUTSIDE)) {
      inside[r] = 1;
    }

    for (let k = 0; k < 3; k++) {
      const v = tris[t * 3 + k] * 3;
      near[r] = Math.min(near[r], distanceAt(vx[v], vx[v + 1]));
      for (let c = 0; c < 3; c++) {
        box[r * 6 + c] = Math.min(box[r * 6 + c], vx[v + c]);
        box[r * 6 + 3 + c] = Math.max(box[r * 6 + 3 + c], vx[v + c]);
      }
    }
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const ux = vx[b] - vx[a];
    const uy = vx[b + 1] - vx[a + 1];
    const uz = vx[b + 2] - vx[a + 2];
    const wx = vx[c] - vx[a];
    const wy = vx[c + 1] - vx[a + 1];
    const wz = vx[c + 2] - vx[a + 2];
    const ta =
      Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
    // Folded to one side, so a thin slab's two faces add up, not cancel.
    const flip =
      normals[t * 3] + normals[t * 3 + 1] * 0.7 + normals[t * 3 + 2] * 0.4 < 0
        ? -1
        : 1;
    sum[r * 3] += normals[t * 3] * ta * flip;
    sum[r * 3 + 1] += normals[t * 3 + 1] * ta * flip;
    sum[r * 3 + 2] += normals[t * 3 + 2] * ta * flip;
    area[r] += ta;
  }
  const stray = new Uint8Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    const r = root[t];
    if (inside[r] || near[r] < STRAY_DISTANCE) {
      continue;
    }
    const thin = Math.min(
      box[r * 6 + 3] - box[r * 6],
      box[r * 6 + 4] - box[r * 6 + 1],
      box[r * 6 + 5] - box[r * 6 + 2],
    );
    const flat =
      Math.hypot(sum[r * 3], sum[r * 3 + 1], sum[r * 3 + 2]) > area[r] * 0.9;
    if (thin < STRAY_THIN || flat) {
      stray[t] = 1;
    }
  }
  return stray;
}

/** Scenery fades into the table between these distances from any floor. */
const REMOTE_NEAR = 320;
const REMOTE_FAR = 1100;
/** Strays are this far (source units) from the nearest reachable floor. */
const STRAY_DISTANCE = 320;
const STRAY_THIN = 24;

/** A callout's boxes, source units: where players stand, per the map's author. */
export type PrepArea = Array<{ min: number[]; max: number[] }>;

/** The chunks as one mesh: vertices and triangles numbered across chunks. */
function mergeChunks(chunks: PrepChunk[]) {
  let vertexTotal = 0;
  let triTotal = 0;
  for (const chunk of chunks) {
    vertexTotal += chunk.floorZ.length;
    triTotal += chunk.indices.length / 3;
  }
  const vx = new Float32Array(vertexTotal * 3);
  const vz = new Float32Array(vertexTotal);
  const vflag = new Uint8Array(vertexTotal);
  const tris = new Uint32Array(triTotal * 3);
  let vo = 0;
  let to = 0;
  for (const chunk of chunks) {
    vx.set(chunk.positions, vo * 3);
    vz.set(chunk.floorZ, vo);
    vflag.set(chunk.flags, vo);
    for (let i = 0; i < chunk.indices.length; i++) {
      tris[to + i] = chunk.indices[i] + vo;
    }
    vo += chunk.floorZ.length;
    to += chunk.indices.length;
  }
  return { vx, vz, vflag, tris, vertexTotal, triTotal };
}

export function prepareMap(
  chunks: PrepChunk[],
  areas: PrepArea = [],
): PrepResult {
  return expandPrep(chunks, analyseMap(chunks, areas));
}

/** The slow part of prep: everything decided about the mesh. */
export function analyseMap(
  chunks: PrepChunk[],
  areas: PrepArea = [],
): PrepCore {
  const started = performance.now();
  // Positions shared by triangles from different chunks or split vertices
  // must count as one corner for the edge search.
  const { vx, vz, vflag, tris, vertexTotal, triTotal } = mergeChunks(chunks);

  const bits = new Uint32Array(vx.buffer);
  const canon = new Int32Array(vertexTotal);
  {
    const size = nextPow2(vertexTotal * 2);
    const mask = size - 1;
    const table = new Int32Array(size).fill(-1);
    for (let v = 0; v < vertexTotal; v++) {
      const a = bits[v * 3];
      const b = bits[v * 3 + 1];
      const c = bits[v * 3 + 2];
      let h =
        (Math.imul(a, 73856093) ^
          Math.imul(b, 19349663) ^
          Math.imul(c, 83492791)) &
        mask;
      for (;;) {
        const at = table[h];
        if (at < 0) {
          table[h] = v;
          canon[v] = v;
          break;
        }
        if (
          bits[at * 3] === a &&
          bits[at * 3 + 1] === b &&
          bits[at * 3 + 2] === c
        ) {
          canon[v] = at;
          break;
        }
        h = (h + 1) & mask;
      }
    }
  }

  const normals = new Float32Array(triTotal * 3);
  for (let t = 0; t < triTotal; t++) {
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const ux = vx[b] - vx[a];
    const uy = vx[b + 1] - vx[a + 1];
    const uz = vx[b + 2] - vx[a + 2];
    const wx = vx[c] - vx[a];
    const wy = vx[c + 1] - vx[a + 1];
    const wz = vx[c + 2] - vx[a + 2];
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[t * 3] = nx / len;
    normals[t * 3 + 1] = ny / len;
    normals[t * 3 + 2] = nz / len;
  }

  const info = new Uint16Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    let foliage = 0;
    let see = 0;
    let outside = 0;
    let onFloor = 0;
    let floorless = 0;
    for (let k = 0; k < 3; k++) {
      const v = tris[t * 3 + k];
      const flag = vflag[v];
      const surface = flag & 3;
      if (surface === SURFACE_FOLIAGE) {
        foliage++;
      } else if (surface === SURFACE_SEE_THROUGH) {
        see++;
      }
      if (flag & FLAG_OUTSIDE) {
        outside++;
      }
      const floor = vz[v];
      if (floor !== floor) {
        floorless++;
      } else if (Math.abs(vx[v * 3 + 2] - floor) <= ON_FLOOR) {
        onFloor++;
      }
    }
    // The outside flag and the floor height are noisy per corner (bumpy
    // ground in mid has whole triangles flagged outside), so two of three
    // corners decide, and `adoptFloorPatches` catches the rest.
    const walkable =
      (onFloor === 3 || (onFloor === 2 && outside <= 1)) &&
      normals[t * 3 + 2] >= 0.6;
    let value =
      see >= 2 ? SURFACE_SEE_THROUGH : foliage >= 2 ? SURFACE_FOLIAGE : 0;
    if (outside >= 2) {
      value |= INFO_OUTSIDE;
    }
    if (walkable) {
      value |= INFO_WALKABLE;
    }
    if (floorless === 3) {
      value |= INFO_NO_FLOOR;
    }
    info[t] = value;
  }

  // Edge search: each undirected edge between canonical corners remembers the
  // first two triangle sides that use it. Pairs sharing an edge are kept for
  // the roof cut's patches.
  const pairs = new Int32Array(triTotal * 3);
  let pairCount = 0;
  {
    const size = nextPow2(triTotal * 3 * 2);
    const mask = size - 1;
    const keyA = new Int32Array(size).fill(-1);
    const keyB = new Int32Array(size);
    const first = new Int32Array(size);
    const second = new Int32Array(size).fill(-1);
    for (let t = 0; t < triTotal; t++) {
      for (let e = 0; e < 3; e++) {
        let a = canon[tris[t * 3 + ((e + 1) % 3)]];
        let b = canon[tris[t * 3 + ((e + 2) % 3)]];
        if (a === b) {
          continue;
        }
        if (a > b) {
          const swap = a;
          a = b;
          b = swap;
        }
        let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) & mask;
        for (;;) {
          if (keyA[h] < 0) {
            keyA[h] = a;
            keyB[h] = b;
            first[h] = t * 3 + e;
            break;
          }
          if (keyA[h] === a && keyB[h] === b) {
            if (second[h] === -1) {
              second[h] = t * 3 + e;
            } else {
              second[h] = -2;
            }
            break;
          }
          h = (h + 1) & mask;
        }
      }
    }
    for (let h = 0; h < size; h++) {
      if (keyA[h] < 0) {
        continue;
      }
      const s1 = first[h];
      const s2 = second[h];
      const t1 = (s1 / 3) | 0;
      if (s2 === -1) {
        // An open edge: where a prop meets the floor, or a wall ends. Flat
        // floors have T-junction seams everywhere, so they never outline.
        if (normals[t1 * 3 + 2] < 0.6) {
          info[t1] |= 1 << (INFO_EDGE_SHIFT + (s1 % 3));
        }
        continue;
      }
      if (s2 < 0) {
        continue;
      }
      const t2 = (s2 / 3) | 0;
      pairs[pairCount * 2] = t1;
      pairs[pairCount * 2 + 1] = t2;
      pairCount++;
      const dot =
        normals[t1 * 3] * normals[t2 * 3] +
        normals[t1 * 3 + 1] * normals[t2 * 3 + 1] +
        normals[t1 * 3 + 2] * normals[t2 * 3 + 2];
      // Short creases between two up-facing faces are roof tiles and other
      // corrugation: inked, they turn every eave into a row of spikes.
      const a = keyA[h] * 3;
      const b = keyB[h] * 3;
      const corrugation =
        normals[t1 * 3 + 2] > 0.5 &&
        normals[t2 * 3 + 2] > 0.5 &&
        Math.hypot(
          vx[a] - vx[b],
          vx[a + 1] - vx[b + 1],
          vx[a + 2] - vx[b + 2],
        ) < CORRUGATION_EDGE;
      if (dot < CREASE_COS && !corrugation) {
        info[t1] |= 1 << (INFO_EDGE_SHIFT + (s1 % 3));
        info[t2] |= 1 << (INFO_EDGE_SHIFT + (s2 % 3));
      }
    }
  }

  classifyParts(vx, tris, canon, info, triTotal);
  let floors = floorLevels(vx, tris, info, triTotal);
  for (let pass = 0; pass < 4; pass++) {
    if (
      !adoptFloorPatches(vx, tris, info, normals, triTotal, growLevels(floors))
    ) {
      break;
    }
    floors = floorLevels(vx, tris, info, triTotal);
  }
  const reachable = growLevels(
    reachableFloors(vx, tris, info, normals, triTotal, floors, areas),
  );
  const cut = cutPlanes(
    vx,
    tris,
    canon,
    info,
    normals,
    triTotal,
    pairs.subarray(0, pairCount * 2),
    reachable,
  );

  const stray = strayParts(vx, tris, canon, info, normals, triTotal, reachable);
  const distanceAt = floorDistance(reachable);
  const canopy = canopyNormals(vx, tris, info, triTotal);
  const ground = groundFill(vx, tris, info, normals, triTotal, stray);
  for (let t = 0; t < triTotal; t++) {
    if (info[t] & INFO_NO_FLOOR && normals[t * 3 + 2] >= 0.6) {
      const z =
        (vx[tris[t * 3] * 3 + 2] +
          vx[tris[t * 3 + 1] * 3 + 2] +
          vx[tris[t * 3 + 2] * 3 + 2]) /
        3;
      if (z < ground.level + GROUND_RISE) {
        info[t] |= INFO_GROUND;
      }
    }
  }
  // Never cut first, then cut only in 2D, then cut in 3D as well.
  const order = (t: number) => {
    if (cut[t * 3] === NO_CUT) {
      return 0;
    }
    const wall = (info[t] & (INFO_CUT_WALL | INFO_CUT_WHOLE)) === INFO_CUT_WALL;
    const top = wall
      ? Math.max(
          vx[tris[t * 3] * 3 + 2],
          vx[tris[t * 3 + 1] * 3 + 2],
          vx[tris[t * 3 + 2] * 3 + 2],
        )
      : cut[t * 3 + 1];
    return (info[t] & INFO_SURFACE) !== SURFACE_FOLIAGE &&
      top > cut[t * 3] + GHOST_HEIGHT
      ? 2
      : 1;
  };
  const solidOrder: number[] = [];
  const seeOrder: number[] = [];
  const starts = [0, 0, 0, 0];
  for (let pass = 0; pass < 3; pass++) {
    for (let t = 0; t < triTotal; t++) {
      if (stray[t] || order(t) !== pass) {
        continue;
      }
      ((info[t] & INFO_SURFACE) === SURFACE_SEE_THROUGH
        ? seeOrder
        : solidOrder
      ).push(t);
    }
    if (pass === 0) {
      starts[0] = solidOrder.length;
      starts[2] = seeOrder.length;
    } else if (pass === 1) {
      starts[1] = solidOrder.length;
      starts[3] = seeOrder.length;
    }
  }
  const remote = new Uint8Array(vertexTotal);
  for (let v = 0; v < vertexTotal; v++) {
    const away = distanceAt(vx[v * 3], vx[v * 3 + 1]);
    remote[v] = Math.round(
      Math.min(
        1,
        Math.max(0, (away - REMOTE_NEAR) / (REMOTE_FAR - REMOTE_NEAR)),
      ) * 255,
    );
  }
  const canopyOut = new Int8Array(vertexTotal * 4);
  for (const [v, normal] of canopy) {
    canopyOut.set(normal, v * 4);
  }
  return {
    solidOrder: Uint32Array.from(solidOrder),
    seeOrder: Uint32Array.from(seeOrder),
    solidCuttable: starts[0],
    solidGhost: starts[1],
    seeCuttable: starts[2],
    seeGhost: starts[3],
    info,
    cut,
    remote,
    canopy: canopyOut,
    ground,
    ms: performance.now() - started,
  };
}

/** The fast part of prep: the meshes the map draws, from what was decided. */
export function expandPrep(chunks: PrepChunk[], core: PrepCore): PrepResult {
  const started = performance.now();
  const { vx, vz, tris } = mergeChunks(chunks);
  const build = (order: Uint32Array, cuttable: number, ghost: number) => {
    const mesh = allocMesh(order.length);
    mesh.cuttableStart = cuttable;
    mesh.ghostStart = ghost;
    for (let o = 0; o < order.length; o++) {
      const t = order[o];
      let value = core.info[t];
      if ((value & INFO_SURFACE) === SURFACE_FOLIAGE) {
        value &= ~(0b111 << INFO_EDGE_SHIFT);
      }
      for (let k = 0; k < 3; k++) {
        const v = tris[t * 3 + k];
        const out = o * 3 + k;
        mesh.positions[out * 3] = vx[v * 3];
        mesh.positions[out * 3 + 1] = vx[v * 3 + 1];
        mesh.positions[out * 3 + 2] = vx[v * 3 + 2];
        const floor = vz[v];
        mesh.height[out] =
          floor === floor
            ? Math.max(
                -32000,
                Math.min(32000, Math.round(vx[v * 3 + 2] - floor)),
              )
            : NO_FLOOR;
        mesh.info[out] = value;
        mesh.cut[out * 3] = core.cut[t * 3];
        mesh.cut[out * 3 + 1] = core.cut[t * 3 + 1];
        mesh.cut[out * 3 + 2] = core.cut[t * 3 + 2];
        mesh.remote[out] = core.remote[v];
        mesh.canopy[out * 4] = core.canopy[v * 4];
        mesh.canopy[out * 4 + 1] = core.canopy[v * 4 + 1];
        mesh.canopy[out * 4 + 2] = core.canopy[v * 4 + 2];
        mesh.canopy[out * 4 + 3] = core.canopy[v * 4 + 3];
      }
    }
    return mesh;
  };
  const solid = build(core.solidOrder, core.solidCuttable, core.solidGhost);
  const seeThrough = build(core.seeOrder, core.seeCuttable, core.seeGhost);
  const pick = pickGrid(solid.positions);
  // Copies, so the result holds nothing of the core's buffer.
  const ground = {
    ...core.ground,
    z: core.ground.z.slice(),
    enclosed: core.ground.enclosed.slice(),
    open: core.ground.open.slice(),
  };
  return {
    solid,
    seeThrough,
    pick,
    ground,
    ms: core.ms + performance.now() - started,
  };
}

/**
 * Soft canopy normals for foliage: each leaf corner points away from the
 * middle of the foliage within a block or so of it (a sparse 3D grid of
 * foliage mass, summed over each cell's neighbours), tipped upward so tops
 * catch the sun. Big jungle canopies and lone palms alike shade as rounded
 * blobs. The tone (w) is per tree clump, for mild colour variation.
 */
function canopyNormals(
  vx: Float32Array,
  tris: Uint32Array,
  info: Uint16Array,
  triTotal: number,
): Map<number, Int8Array> {
  const cells = new Map<string, Float64Array>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const corners = new Set<number>();
  for (let t = 0; t < triTotal; t++) {
    if ((info[t] & INFO_SURFACE) !== SURFACE_FOLIAGE) {
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const v = tris[t * 3 + k];
      corners.add(v);
      const x = vx[v * 3];
      const y = vx[v * 3 + 1];
      const z = vx[v * 3 + 2];
      const id = key(
        Math.floor(x / CANOPY_CELL),
        Math.floor(y / CANOPY_CELL),
        Math.floor(z / CANOPY_CELL),
      );
      let sum = cells.get(id);
      if (!sum) {
        sum = new Float64Array(4);
        cells.set(id, sum);
      }
      sum[0] += x;
      sum[1] += y;
      sum[2] += z;
      sum[3]++;
    }
  }
  const out = new Map<number, Int8Array>();
  for (const v of corners) {
    const x = vx[v * 3];
    const y = vx[v * 3 + 1];
    const z = vx[v * 3 + 2];
    const gx = Math.floor(x / CANOPY_CELL);
    const gy = Math.floor(y / CANOPY_CELL);
    const gz = Math.floor(z / CANOPY_CELL);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sum = cells.get(key(gx + dx, gy + dy, gz + dz));
          if (sum) {
            sx += sum[0];
            sy += sum[1];
            sz += sum[2];
            n += sum[3];
          }
        }
      }
    }
    let nx = x - sx / n;
    let ny = y - sy / n;
    let nz = z - sz / n + CANOPY_CELL * 0.35;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    // One tone per clump: hashed from the 4-block cell the corner is in.
    const h =
      Math.sin(Math.floor(x / 256) * 12.9898 + Math.floor(y / 256) * 78.233) *
      43758.5453;
    const tone = h - Math.floor(h);
    out.set(
      v,
      Int8Array.of(
        Math.round(nx * 127),
        Math.round(ny * 127),
        Math.round(nz * 127),
        Math.round((tone * 2 - 1) * 127),
      ),
    );
  }
  return out;
}

const CANOPY_CELL = 64;

/**
 * Where the roof cut sits on each triangle, decided per patch (connected,
 * nearly coplanar triangles of one class) rather than per pixel, so a cut
 * roof goes whole and a sliced wall ends on one straight line instead of
 * tearing along the floor grid. Measured from the floors a player can reach
 * only, so sealed buildings stay closed.
 *
 * A wall is cut when there is reachable floor on both sides of it (a room's
 * wall, or one between a room and the street); a facade with nothing behind
 * it is the outside of a solid block and keeps its full height. A roof or
 * ceiling is cut when most of it is over floor. Trims, cornices and ledges
 * touching a cut patch take its plane. The plane is the highest floor the
 * patch was measured from: one height per patch. Returns per triangle the
 * plane, its group's top and its patch's bottom (see `PrepMesh.cut`), and
 * marks walls in `info` (INFO_CUT_WALL / INFO_CUT_WHOLE).
 */
function cutPlanes(
  vx: Float32Array,
  tris: Uint32Array,
  canon: Int32Array,
  info: Uint16Array,
  normals: Float32Array,
  triTotal: number,
  pairs: Int32Array,
  floors: FloorLevels,
): Int16Array {
  const parent = new Int32Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    parent[t] = t;
  }
  const find = (i: number) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const CLASS = INFO_WALKABLE | INFO_SURFACE;
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i];
    const b = pairs[i + 1];
    if (
      (info[a] & CLASS) !== (info[b] & CLASS) ||
      (info[a] & INFO_SURFACE) === SURFACE_FOLIAGE
    ) {
      continue;
    }
    const dot =
      normals[a * 3] * normals[b * 3] +
      normals[a * 3 + 1] * normals[b * 3 + 1] +
      normals[a * 3 + 2] * normals[b * 3 + 2];
    // A ceiling is never one patch with the wall it springs from: an arch's
    // sides stay walls under its crown. (A dome's cap faces up and stays.)
    const downA = normals[a * 3 + 2] <= -WALL_UPNESS;
    const downB = normals[b * 3 + 2] <= -WALL_UPNESS;
    if (dot >= PATCH_COS && downA === downB) {
      parent[find(b)] = find(a);
    }
  }

  const patch = new Int32Array(triTotal);
  const area = new Float64Array(triTotal);
  const upness = new Float64Array(triTotal);
  const facing = new Float64Array(triTotal);
  const top = new Float32Array(triTotal).fill(-Infinity);
  const bottom = new Float32Array(triTotal).fill(Infinity);
  const triArea = new Float32Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    const p = find(t);
    patch[t] = p;
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const ux = vx[b] - vx[a];
    const uy = vx[b + 1] - vx[a + 1];
    const uz = vx[b + 2] - vx[a + 2];
    const wx = vx[c] - vx[a];
    const wy = vx[c + 1] - vx[a + 1];
    const wz = vx[c + 2] - vx[a + 2];
    const ta =
      Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
    triArea[t] = ta;
    area[p] += ta;
    upness[p] += ta * Math.abs(normals[t * 3 + 2]);
    facing[p] += ta * normals[t * 3 + 2];
    top[p] = Math.max(top[p], vx[a + 2], vx[b + 2], vx[c + 2]);
    bottom[p] = Math.min(bottom[p], vx[a + 2], vx[b + 2], vx[c + 2]);
  }

  const { minX, minY, cell, width, height, levels } = floors;
  const levelBelow = (x: number, y: number, z: number) => {
    const gx = Math.floor((x - minX) / cell);
    const gy = Math.floor((y - minY) / cell);
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) {
      return -Infinity;
    }
    const at = (gy * width + gx) * 4;
    let best = -Infinity;
    for (let k = 0; k < 4; k++) {
      const level = levels[at + k];
      if (level <= z && level > best) {
        best = level;
      }
    }
    return best;
  };

  // Roof patches joined across their edges (ridges, hips, eaves) decide as
  // one: a roof opens whole or not at all.
  const roofGroup = new Int32Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    roofGroup[t] = t;
  }
  const findGroup = (i: number) => {
    while (roofGroup[i] !== i) {
      roofGroup[i] = roofGroup[roofGroup[i]];
      i = roofGroup[i];
    }
    return i;
  };
  const isRoof = (t: number) =>
    !(info[t] & INFO_WALKABLE) &&
    (info[t] & INFO_SURFACE) !== SURFACE_FOLIAGE &&
    upness[patch[t]] >= area[patch[t]] * WALL_UPNESS;
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i];
    const b = pairs[i + 1];
    if (patch[a] !== patch[b] && isRoof(a) && isRoof(b)) {
      roofGroup[findGroup(patch[a])] = findGroup(patch[b]);
    }
  }
  const columns = surfaceColumns(vx, tris, info, normals, triTotal, floors);
  const nearTop = nearestTopLevel(floors, NEAR_REACH);
  // The reachable floor beside a wall, unless the point stands on a slab of
  // its own within a storey above that floor: then the wall is part of an
  // upper storey over that floor (see `weak` below).
  const openBelow = (x: number, y: number, z: number) => {
    const level = levelBelow(x, y, z);
    return level > -Infinity &&
      columns.anyBetween(
        x,
        y,
        Math.max(level + SLAB_CLEAR, z - STOREY),
        z - SLAB_CLEAR,
      )
      ? -Infinity
      : level;
  };

  // Each triangle is measured at its centroid and at three points between
  // the centroid and its corners. A wall needs reachable floor on both
  // sides; a roof needs reachable floor under it.
  const hit = new Float64Array(triTotal);
  const openHit = new Float64Array(triTotal);
  const base = new Float32Array(triTotal).fill(-Infinity);
  const patchHit = new Float64Array(triTotal);
  const patchBase = new Float32Array(triTotal).fill(-Infinity);
  const triHits = new Uint8Array(triTotal);
  const triBase = new Float32Array(triTotal).fill(-Infinity);
  const nearMax = new Float32Array(triTotal).fill(-Infinity);
  const floating = new Uint8Array(triTotal).fill(1);
  for (let t = 0; t < triTotal; t++) {
    const value = info[t];
    if (value & INFO_WALKABLE) {
      continue;
    }
    const p = patch[t];
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const cx = (vx[a] + vx[b] + vx[c]) / 3;
    const cy = (vx[a + 1] + vx[b + 1] + vx[c + 1]) / 3;
    const cz = (vx[a + 2] + vx[b + 2] + vx[c + 2]) / 3;
    const foliage = (value & INFO_SURFACE) === SURFACE_FOLIAGE;
    const wall = !foliage && upness[p] < area[p] * WALL_UPNESS;
    const owner = wall || foliage ? p : findGroup(p);
    nearMax[p] = Math.max(nearMax[p], nearTop(cx, cy));
    if (wall || columns.anyBelow(cx, cy, cz - ROOF_THICK)) {
      floating[p] = 0;
    }
    let nx = normals[t * 3];
    let ny = normals[t * 3 + 1];
    const nl = Math.hypot(nx, ny) || 1;
    nx = (nx / nl) * WALL_SIDE;
    ny = (ny / nl) * WALL_SIDE;
    for (let k = 0; k < 4; k++) {
      const corner = k === 3 ? -1 : tris[t * 3 + k] * 3;
      const x = corner < 0 ? cx : cx + (vx[corner] - cx) * 0.66;
      const y = corner < 0 ? cy : cy + (vx[corner + 1] - cy) * 0.66;
      const z = (corner < 0 ? cz : cz + (vx[corner + 2] - cz) * 0.66) + 4;
      let level: number;
      if (wall) {
        const front = levelBelow(x + nx, y + ny, z);
        const back = levelBelow(x - nx, y - ny, z);
        level =
          front > -Infinity && back > -Infinity
            ? Math.max(front, back)
            : -Infinity;
        if (
          level > -Infinity &&
          openBelow(x + nx, y + ny, z) > -Infinity &&
          openBelow(x - nx, y - ny, z) > -Infinity
        ) {
          openHit[p] += triArea[t] / 4;
        }
      } else {
        level = levelBelow(x, y, z);
      }
      if (level > -Infinity) {
        hit[owner] += triArea[t] / 4;
        base[owner] = Math.max(base[owner], level);
        patchHit[p] += triArea[t] / 4;
        patchBase[p] = Math.max(patchBase[p], level);
        triHits[t]++;
        triBase[t] = Math.max(triBase[t], level);
      }
    }
  }

  // Decisions: walls per patch; roofs per group, else per patch, else per
  // triangle (a big slab over rooms and solid blocks alike opens over the
  // rooms, along its own triangle edges); and anything floating far above
  // play with nothing under it (an unfinished upper storey) goes whole.
  // Then trims and ledges take the plane of a cut patch they touch.
  const groupArea = new Float64Array(triTotal);
  for (let p = 0; p < triTotal; p++) {
    if (patch[p] === p && isRoof(p)) {
      groupArea[findGroup(p)] += area[p];
    }
  }
  const planeOf = new Float32Array(triTotal).fill(NaN);
  const wallOf = new Uint8Array(triTotal);
  const weak = new Uint8Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    const p = patch[t];
    if (
      p !== t ||
      info[t] & INFO_WALKABLE ||
      (info[t] & INFO_SURFACE) === SURFACE_FOLIAGE
    ) {
      continue;
    }
    if (floating[p] && bottom[p] > nearMax[p] + FLOATING_RISE) {
      planeOf[p] = nearMax[p];
      continue;
    }
    if (upness[p] < area[p] * WALL_UPNESS) {
      if (hit[p] >= area[p] * WALL_ENCLOSED) {
        planeOf[p] = base[p];
        wallOf[p] = 1;
        weak[p] = openHit[p] < area[p] * WALL_ENCLOSED ? 1 : 0;
      }
      continue;
    }
    const g = findGroup(p);
    if (hit[g] >= groupArea[g] * ROOF_COVERED) {
      planeOf[p] = base[g];
    } else if (patchHit[p] >= area[p] * ROOF_COVERED) {
      planeOf[p] = patchBase[p];
    }
  }
  const trimmable = (p: number, t: number) =>
    area[p] < TRIM_AREA &&
    !(info[t] & INFO_WALKABLE) &&
    (info[t] & INFO_SURFACE) !== SURFACE_FOLIAGE;
  // A wall enclosed only through another storey's slab belongs to that upper
  // storey. Set into a bigger facade that stays whole (the wall round a
  // window over a passage) it keeps its height too, instead of leaving a
  // hole; a whole storey of them (a building over a lower level) still opens.
  {
    const isWallTri = (t: number) =>
      !(info[t] & INFO_WALKABLE) &&
      (info[t] & INFO_SURFACE) !== SURFACE_FOLIAGE &&
      upness[patch[t]] < area[patch[t]] * WALL_UPNESS;
    const piece = new Int32Array(triTotal);
    for (let i = 0; i < triTotal; i++) {
      piece[i] = i;
    }
    const findPiece = (i: number) => {
      while (piece[i] !== i) {
        piece[i] = piece[piece[i]];
        i = piece[i];
      }
      return i;
    };
    for (let i = 0; i < pairs.length; i += 2) {
      const pa = patch[pairs[i]];
      const pb = patch[pairs[i + 1]];
      if (pa !== pb && weak[pa] && weak[pb]) {
        piece[findPiece(pa)] = findPiece(pb);
      }
    }
    const pieceArea = new Float64Array(triTotal);
    for (let p = 0; p < triTotal; p++) {
      if (patch[p] === p && weak[p]) {
        pieceArea[findPiece(p)] += area[p];
      }
    }
    const solidAround = new Map<number, Set<number>>();
    for (let i = 0; i < pairs.length; i += 2) {
      for (const [a, b] of [
        [pairs[i], pairs[i + 1]],
        [pairs[i + 1], pairs[i]],
      ]) {
        const pa = patch[a];
        const pb = patch[b];
        if (
          weak[pa] &&
          !weak[pb] &&
          planeOf[pb] !== planeOf[pb] &&
          isWallTri(b)
        ) {
          const root = findPiece(pa);
          const seen = solidAround.get(root) ?? new Set<number>();
          seen.add(pb);
          solidAround.set(root, seen);
        }
      }
    }
    const solidArea = new Float64Array(triTotal);
    for (const [root, seen] of solidAround) {
      for (const q of seen) {
        solidArea[root] += area[q];
      }
    }
    for (let p = 0; p < triTotal; p++) {
      if (patch[p] === p && weak[p]) {
        const root = findPiece(p);
        if (solidArea[root] > pieceArea[root]) {
          planeOf[p] = NaN;
          wallOf[p] = 0;
        }
      }
    }
  }

  // A trim takes a plane from what it hangs off: a cut patch no lower than
  // itself (a cornice under its roof, a ledge on its wall), never one below,
  // so a passage's ceiling does not open the storey standing on it. A piece
  // of wall taller than a roof's edge band is no trim: it was measured as a
  // wall, and a facade with nothing behind it keeps its height.
  const reach = new Float32Array(top);
  const standsAsWall = (p: number) =>
    upness[p] < area[p] * WALL_UPNESS && top[p] - bottom[p] > FASCIA_HEIGHT;
  const next = new Float32Array(triTotal);
  const nextWall = new Uint8Array(triTotal);
  const nextReach = new Float32Array(triTotal);
  for (let round = 0; round < TRIM_ROUNDS; round++) {
    let changed = false;
    next.set(planeOf);
    nextWall.set(wallOf);
    nextReach.set(reach);
    const spread = (from: number, to: number, t: number) => {
      if (
        planeOf[from] !== planeOf[from] ||
        planeOf[to] === planeOf[to] ||
        !trimmable(to, t) ||
        standsAsWall(to) ||
        top[to] > reach[from] + TRIM_RISE
      ) {
        return;
      }
      // The lowest plane wins; a roof's beats a wall's, since it cuts in 3D too.
      if (!(next[to] <= planeOf[from])) {
        next[to] = planeOf[from];
        nextWall[to] = wallOf[from];
        nextReach[to] = reach[from];
        changed = true;
      } else if (next[to] === planeOf[from] && !wallOf[from]) {
        nextWall[to] = 0;
      }
    };
    for (let i = 0; i < pairs.length; i += 2) {
      const pa = patch[pairs[i]];
      const pb = patch[pairs[i + 1]];
      if (pa !== pb) {
        spread(pa, pb, pairs[i + 1]);
        spread(pb, pa, pairs[i]);
      }
    }
    planeOf.set(next);
    wallOf.set(nextWall);
    reach.set(nextReach);
    if (!changed) {
      break;
    }
  }

  const ceiling = new Uint8Array(triTotal);
  for (let p = 0; p < triTotal; p++) {
    ceiling[p] = facing[p] < -area[p] * WALL_UPNESS ? 1 : 0;
  }
  const whole = groupWhole(
    tris,
    canon,
    info,
    triTotal,
    pairs,
    patch,
    triArea,
    planeOf,
    wallOf,
    top,
    bottom,
    ceiling,
  );

  const out = new Int16Array(triTotal * 3);
  const clamp = (v: number) => Math.max(-32000, Math.min(32000, Math.round(v)));
  for (let t = 0; t < triTotal; t++) {
    const p = patch[t];
    const foliage = (info[t] & INFO_SURFACE) === SURFACE_FOLIAGE;
    const a = vx[tris[t * 3] * 3 + 2];
    const b = vx[tris[t * 3 + 1] * 3 + 2];
    const c = vx[tris[t * 3 + 2] * 3 + 2];
    let plane = foliage ? triBase[t] : planeOf[p];
    let top_ = foliage ? -32000 : top[p];
    let bottom_ = foliage ? -32000 : bottom[p];
    if (
      plane !== plane &&
      !foliage &&
      !(info[t] & INFO_WALKABLE) &&
      isRoof(t) &&
      triHits[t] >= TRI_COVERED
    ) {
      // This triangle alone: it goes whole, by its own height.
      plane = triBase[t];
      top_ = Math.max(a, b, c);
      bottom_ = Math.min(a, b, c);
    }
    const cut = plane === plane && plane > -Infinity;
    out[t * 3] = cut ? clamp(plane) : NO_CUT;
    if (cut && !foliage && wallOf[p]) {
      info[t] |= whole[p] ? INFO_CUT_WALL | INFO_CUT_WHOLE : INFO_CUT_WALL;
    }
    out[t * 3 + 1] = clamp(top_);
    out[t * 3 + 2] = clamp(bottom_);
  }
  return out;
}

/**
 * What goes as one when the roof cut reaches it. A roof (any cut surface
 * that is not a wall) goes whole, never sliced, and so does everything joined
 * to it across an edge, so a sloped or broken roof leaves no hanging pieces.
 * A small loose piece (a rafter, a shutter, a sign) goes whole too, with the
 * lowest plane of its patches, unless it is a tall piece of wall. Each
 * group's top becomes every member's, and the shader removes the group once
 * the cut is below that top. A small group of ceilings alone (an arch's
 * crown, under a wall that stays) hides nothing from above, so it goes only
 * once the cut is below all of it. Returns which wall-type patches go whole (roof-type
 * ones always do).
 */
function groupWhole(
  tris: Uint32Array,
  canon: Int32Array,
  info: Uint16Array,
  triTotal: number,
  pairs: Int32Array,
  patch: Int32Array,
  triArea: Float32Array,
  planeOf: Float32Array,
  wallOf: Uint8Array,
  top: Float32Array,
  bottom: Float32Array,
  ceiling: Uint8Array,
): Uint8Array {
  const cuttable = (t: number) =>
    planeOf[patch[t]] === planeOf[patch[t]] &&
    !(info[t] & INFO_WALKABLE) &&
    (info[t] & INFO_SURFACE) !== SURFACE_FOLIAGE;
  const group = new Int32Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    group[t] = t;
  }
  const find = (i: number) => {
    while (group[i] !== i) {
      group[i] = group[group[i]];
      i = group[i];
    }
    return i;
  };
  const join = (a: number, b: number) => {
    group[find(a)] = find(b);
  };
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i];
    const b = pairs[i + 1];
    const pa = patch[a];
    const pb = patch[b];
    if (pa !== pb && cuttable(a) && cuttable(b) && !wallOf[pa] && !wallOf[pb]) {
      join(pa, pb);
    }
  }

  // Small loose parts, by vertex connectivity.
  const parent = new Int32Array(canon.length);
  for (let i = 0; i < parent.length; i++) {
    parent[i] = i;
  }
  const findPart = (i: number) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let t = 0; t < triTotal; t++) {
    const a = findPart(canon[tris[t * 3]]);
    parent[findPart(canon[tris[t * 3 + 1]])] = a;
    parent[findPart(canon[tris[t * 3 + 2]])] = a;
  }
  const partArea = new Float64Array(canon.length);
  const partPlane = new Float32Array(canon.length).fill(Infinity);
  const partRoofArea = new Float64Array(canon.length);
  const partWallArea = new Float64Array(canon.length);
  const partTop = new Float32Array(canon.length).fill(-Infinity);
  const partBottom = new Float32Array(canon.length).fill(Infinity);
  const partFirst = new Int32Array(canon.length).fill(-1);
  const root = new Int32Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    const r = findPart(canon[tris[t * 3]]);
    root[t] = r;
    partArea[r] += triArea[t];
    if (cuttable(t)) {
      const p = patch[t];
      partPlane[r] = Math.min(partPlane[r], planeOf[p]);
      if (wallOf[p]) {
        partWallArea[r] += triArea[t];
      } else {
        partRoofArea[r] += triArea[t];
      }
      partTop[r] = Math.max(partTop[r], top[p]);
      partBottom[r] = Math.min(partBottom[r], bottom[p]);
    }
  }
  const whole = new Uint8Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    const r = root[t];
    const p = patch[t];
    // Mostly wall and taller than a sign (an arch, a door frame): sliced like
    // the wall it is part of, rather than gone with its crown.
    const wallLike = partWallArea[r] > partRoofArea[r];
    if (
      partArea[r] >= SMALL_PART_AREA ||
      partPlane[r] === Infinity ||
      info[t] & INFO_WALKABLE ||
      (info[t] & INFO_SURFACE) === SURFACE_FOLIAGE ||
      (wallLike && partTop[r] - partBottom[r] > LOOSE_WALL_HEIGHT)
    ) {
      continue;
    }
    planeOf[p] = partPlane[r];
    wallOf[p] = wallLike ? 1 : 0;
    whole[p] = 1;
    if (partFirst[r] < 0) {
      partFirst[r] = p;
    } else {
      join(p, partFirst[r]);
    }
  }

  const groupTop = new Float32Array(triTotal).fill(-Infinity);
  const groupLow = new Float32Array(triTotal).fill(Infinity);
  const groupOpen = new Uint8Array(triTotal);
  const groupArea = new Float64Array(triTotal);
  for (let t = 0; t < triTotal; t++) {
    if (cuttable(t)) {
      const p = patch[t];
      const g = find(p);
      groupTop[g] = Math.max(groupTop[g], top[p]);
      groupLow[g] = Math.min(groupLow[g], bottom[p]);
      groupArea[g] += triArea[t];
      if (!ceiling[p]) {
        groupOpen[g] = 1;
      }
    }
  }
  for (let t = 0; t < triTotal; t++) {
    if (cuttable(t) && (!wallOf[patch[t]] || whole[patch[t]])) {
      const g = find(patch[t]);
      top[patch[t]] =
        groupOpen[g] || groupArea[g] >= TRIM_AREA ? groupTop[g] : groupLow[g];
    }
  }
  return whole;
}

const SMALL_PART_AREA = 40000;
/** A wall-like loose piece taller than this is sliced, not taken whole. */
const LOOSE_WALL_HEIGHT = 128;

const PATCH_COS = Math.cos((20 * Math.PI) / 180);
/** Patches flatter than this (mean |n.z|) are roofs and ceilings, not walls. */
const WALL_UPNESS = 0.45;
/** Source units out from a wall to look for the floor on each side. */
const WALL_SIDE = 40;
const WALL_ENCLOSED = 0.25;
const ROOF_COVERED = 0.5;
const TRIM_AREA = 20000;
/** Below a roof sample, this deep is still the roof itself (its underside). */
const ROOF_THICK = 96;
/** A surface this close to a floor or a sample is that floor or that surface. */
const SLAB_CLEAR = 16;
/** A slab this far under a wall's sample is the floor of the storey it is on. */
const STOREY = 160;
/** How far above what it hangs off a trim may reach and still take its cut. */
const TRIM_RISE = 16;
/** A roof slab's edge band is no taller than this; a wall piece is. */
const FASCIA_HEIGHT = 40;
/** A roof triangle on its own opens when this many of its 4 samples do. */
const TRI_COVERED = 4;
/** How far round a piece to look for the floor it stands over. */
const NEAR_REACH = 384;
/** Pieces with nothing under them this far above play are unfinished storeys. */
const FLOATING_RISE = 400;
const TRIM_ROUNDS = 6;

/**
 * Sand that meets the map at its own ground: under each cell the lowest
 * upward surface around it (just below, so it never shows through), and over
 * the holes and the margin a smooth membrane between those heights and the
 * dunes' floor at the rim, relaxed a fixed number of times.
 */
function groundFill(
  vx: Float32Array,
  tris: Uint32Array,
  info: Uint16Array,
  normals: Float32Array,
  triTotal: number,
  stray: Uint8Array,
): GroundFill {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vx.length; i += 3) {
    minX = Math.min(minX, vx[i]);
    maxX = Math.max(maxX, vx[i]);
    minY = Math.min(minY, vx[i + 1]);
    maxY = Math.max(maxY, vx[i + 1]);
    minZ = Math.min(minZ, vx[i + 2]);
  }
  if (!(maxX >= minX)) {
    minX = minY = maxX = maxY = minZ = 0;
  }
  const cell = Math.max(FILL_CELL, Math.max(maxX - minX, maxY - minY) / 200);
  const pad = FILL_PAD * cell;
  minX -= pad;
  minY -= pad;
  const width = Math.ceil((maxX + pad - minX) / cell) + 1;
  const height = Math.ceil((maxY + pad - minY) / cell) + 1;
  // The lowest surface over each point, and the lowest walkable one.
  const low = new Float32Array(width * height).fill(Infinity);
  const ground = new Float32Array(width * height).fill(Infinity);
  for (let t = 0; t < triTotal; t++) {
    if (
      stray[t] ||
      (info[t] & INFO_SURFACE) === SURFACE_FOLIAGE ||
      normals[t * 3 + 2] < 0.3
    ) {
      continue;
    }
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const ax = vx[a];
    const ay = vx[a + 1];
    const bx = vx[b];
    const by = vx[b + 1];
    const cx = vx[c];
    const cy = vx[c + 1];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-3) {
      continue;
    }
    const x0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - minX) / cell));
    const x1 = Math.min(
      width - 1,
      Math.floor((Math.max(ax, bx, cx) - minX) / cell),
    );
    const y0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - minY) / cell));
    const y1 = Math.min(
      height - 1,
      Math.floor((Math.max(ay, by, cy) - minY) / cell),
    );
    for (let gy = y0; gy <= y1; gy++) {
      const py = minY + gy * cell;
      for (let gx = x0; gx <= x1; gx++) {
        const px = minX + gx * cell;
        const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        if (u < -1e-4 || v < -1e-4 || u + v > 1 + 1e-4) {
          continue;
        }
        const at = gy * width + gx;
        const pz = u * vx[a + 2] + v * vx[b + 2] + (1 - u - v) * vx[c + 2];
        low[at] = Math.min(low[at], pz);
        if (info[t] & INFO_WALKABLE) {
          ground[at] = Math.min(ground[at], pz);
        }
      }
    }
  }
  // Walkable ground holds the sand just under it; everything else is free,
  // but never above the lowest surface over it, so it cannot show through.
  const base = minZ - 4;
  const z = new Float32Array(width * height).fill(base);
  const covered = new Uint8Array(width * height);
  const ceiling = new Float32Array(width * height).fill(Infinity);
  const known = new Uint8Array(width * height);
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const at = gy * width + gx;
      let lowest = low[at];
      let floor = ground[at];
      for (let k = 0; k < 8; k++) {
        const nx = gx + NEIGHBOURS[k * 2];
        const ny = gy + NEIGHBOURS[k * 2 + 1];
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          lowest = Math.min(lowest, low[ny * width + nx]);
          floor = Math.min(floor, ground[ny * width + nx]);
        }
      }
      if (low[at] < Infinity) {
        covered[at] = 1;
        ceiling[at] = lowest - 16;
      }
      if (ground[at] < Infinity) {
        z[at] = Math.min(floor, lowest) - 16;
        known[at] = 1;
      }
    }
  }
  // Never above the lowest floor near by: where a building is hollow (no
  // floor inside, only its roof over the ground) the sand stays down at the
  // street, and a courtyard sits at the level of the ground round it.
  const floorNear = minFilter(
    ground,
    width,
    height,
    Math.ceil(FILL_FLOOR_REACH / cell),
  );
  for (let at = 0; at < z.length; at++) {
    if (floorNear[at] < Infinity) {
      ceiling[at] = Math.min(ceiling[at], floorNear[at] + 8);
      if (known[at]) {
        z[at] = Math.min(z[at], ceiling[at]);
      }
    }
  }
  const fixed = known.slice();
  // Free points start from their nearest held height, ring by ring, then
  // relax toward their neighbours' mean with the rim held at the floor.
  for (let ring = 0; ring < FILL_PAD * 4; ring++) {
    let grew = false;
    for (let at = 0; at < z.length; at++) {
      if (known[at]) {
        continue;
      }
      const gx = at % width;
      const gy = (at - gx) / width;
      let sum = 0;
      let n = 0;
      for (let k = 0; k < 8; k++) {
        const nx = gx + NEIGHBOURS[k * 2];
        const ny = gy + NEIGHBOURS[k * 2 + 1];
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          known[ny * width + nx] === 1
        ) {
          sum += z[ny * width + nx];
          n++;
        }
      }
      if (n) {
        z[at] = Math.min(sum / n, ceiling[at]);
        known[at] = 2;
        grew = true;
      }
    }
    for (let at = 0; at < z.length; at++) {
      if (known[at] === 2) {
        known[at] = 1;
      }
    }
    if (!grew) {
      break;
    }
  }
  // The ground beyond the map is where the perimeter's ground settles with
  // the edge left free; the sand is then held level there, so it meets the
  // dunes' plateau flat. A map standing far above everything (a tower) has
  // no ground: its fill slopes away to the floor and is dropped as a cliff.
  const next = new Float32Array(z.length);
  const relax = (rim: number | null) => {
    for (let pass = 0; pass < FILL_RELAX; pass++) {
      next.set(z);
      for (let gy = 0; gy < height; gy++) {
        for (let gx = 0; gx < width; gx++) {
          const at = gy * width + gx;
          if (fixed[at]) {
            continue;
          }
          const edge =
            gx === 0 || gy === 0 || gx === width - 1 || gy === height - 1;
          if (edge && rim !== null) {
            next[at] = rim;
            continue;
          }
          let sum = 0;
          let n = 0;
          for (let k = 0; k < 8; k++) {
            const nx = gx + NEIGHBOURS[k * 2];
            const ny = gy + NEIGHBOURS[k * 2 + 1];
            if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
              sum += z[ny * width + nx];
              n++;
            }
          }
          next[at] = Math.min(sum / n, ceiling[at]);
        }
      }
      z.set(next);
    }
  };
  relax(null);
  const ring: number[] = [];
  for (let gx = 0; gx < width; gx++) {
    ring.push(z[gx], z[(height - 1) * width + gx]);
  }
  for (let gy = 1; gy + 1 < height; gy++) {
    ring.push(z[gy * width], z[gy * width + width - 1]);
  }
  ring.sort((a, b) => a - b);
  let level = ring[ring.length >> 1];
  if (!(level - base < FILL_TOWER)) {
    level = base;
  }
  relax(level);
  // Open points the outside cannot reach are closed in. The map is first
  // grown by a few cells, so a doorway or a gap between two roofs does not
  // let the outside leak into a courtyard.
  const grown = covered.slice();
  for (let pass = 0; pass < YARD_CLOSE; pass++) {
    const from = grown.slice();
    for (let at = 0; at < width * height; at++) {
      if (from[at]) {
        continue;
      }
      const gx = at % width;
      const gy = (at - gx) / width;
      for (let k = 0; k < 8; k++) {
        const nx = gx + NEIGHBOURS[k * 2];
        const ny = gy + NEIGHBOURS[k * 2 + 1];
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          from[ny * width + nx]
        ) {
          grown[at] = 1;
          break;
        }
      }
    }
  }
  const outside = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let at = 0; at < width * height; at++) {
    const gx = at % width;
    const gy = (at - gx) / width;
    if (
      !grown[at] &&
      (gx === 0 || gy === 0 || gx === width - 1 || gy === height - 1)
    ) {
      outside[at] = 1;
      queue.push(at);
    }
  }
  while (queue.length) {
    const at = queue.pop()!;
    const gx = at % width;
    const gy = (at - gx) / width;
    for (let k = 0; k < 4; k++) {
      const nx = gx + NEIGHBOURS[k * 2];
      const ny = gy + NEIGHBOURS[k * 2 + 1];
      const nb = ny * width + nx;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < width &&
        ny < height &&
        !grown[nb] &&
        !outside[nb]
      ) {
        outside[nb] = 1;
        queue.push(nb);
      }
    }
  }
  // The grown band takes the outside's side from its nearest open point.
  for (let pass = 0; pass < YARD_CLOSE; pass++) {
    const from = outside.slice();
    for (let at = 0; at < width * height; at++) {
      if (from[at] || covered[at]) {
        continue;
      }
      const gx = at % width;
      const gy = (at - gx) / width;
      for (let k = 0; k < 8; k++) {
        const nx = gx + NEIGHBOURS[k * 2];
        const ny = gy + NEIGHBOURS[k * 2 + 1];
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          from[ny * width + nx]
        ) {
          outside[at] = 1;
          break;
        }
      }
    }
  }
  const enclosed = new Uint8Array(width * height);
  for (let at = 0; at < width * height; at++) {
    enclosed[at] = !covered[at] && !outside[at] ? 255 : 0;
  }
  // Covered points take the most closed-in open neighbour, a few cells in,
  // so a courtyard's edge under its eaves does not fade to the table.
  for (let pass = 0; pass < YARD_CLOSE; pass++) {
    const from = enclosed.slice();
    for (let at = 0; at < width * height; at++) {
      if (!covered[at]) {
        continue;
      }
      const gx = at % width;
      const gy = (at - gx) / width;
      for (let k = 0; k < 8; k++) {
        const nx = gx + NEIGHBOURS[k * 2];
        const ny = gy + NEIGHBOURS[k * 2 + 1];
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          enclosed[at] = Math.max(enclosed[at], from[ny * width + nx]);
        }
      }
    }
  }
  const open = new Uint8Array(width * height);
  const wallReach = Math.max(1, Math.round(YARD_EDGE / cell));
  for (let at = 0; at < width * height; at++) {
    if (covered[at]) {
      continue;
    }
    const gx = at % width;
    const gy = (at - gx) / width;
    let d = wallReach;
    for (let dy = -wallReach; dy <= wallReach; dy++) {
      for (let dx = -wallReach; dx <= wallReach; dx++) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          covered[ny * width + nx]
        ) {
          d = Math.min(d, Math.hypot(dx, dy));
        }
      }
    }
    open[at] = Math.round((Math.min(d, wallReach) / wallReach) * 255);
  }
  return {
    minX,
    minY,
    cell,
    width,
    height,
    z,
    enclosed,
    open,
    reach: pad,
    level,
  };
}

/** Each cell's minimum over the square `radius` cells round it. */
export function minFilter(
  values: Float32Array,
  width: number,
  height: number,
  radius: number,
) {
  const across = new Float32Array(values.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = Infinity;
      for (
        let i = Math.max(0, x - radius);
        i <= Math.min(width - 1, x + radius);
        i++
      ) {
        m = Math.min(m, values[y * width + i]);
      }
      across[y * width + x] = m;
    }
  }
  const out = new Float32Array(values.length);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let m = Infinity;
      for (
        let j = Math.max(0, y - radius);
        j <= Math.min(height - 1, y + radius);
        j++
      ) {
        m = Math.min(m, across[j * width + x]);
      }
      out[y * width + x] = m;
    }
  }
  return out;
}

const FILL_CELL = 48;
/** How far round a point the fill looks for the floor it may not rise above. */
const FILL_FLOOR_REACH = 360;
/** Floorless flat surfaces this far over the ground round the map are roofs. */
const GROUND_RISE = 96;
/** Courtyard ground darkens within this of its walls. */
const YARD_EDGE = 160;
/** Gaps up to twice this many cells do not open a courtyard to the outside. */
const YARD_CLOSE = 3;
/** Cells of margin round the map, for the sand to slope down in. */
const FILL_PAD = 16;
const FILL_RELAX = 60;
/** Ground this far above the map's lowest point means there is none. */
const FILL_TOWER = 1500;

const PICK_CELL = 128;

function pickGrid(positions: Float32Array): PickGrid {
  const count = Math.floor(positions.length / 9);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < count * 9; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }
  if (!count) {
    minX = minY = minZ = maxX = maxY = maxZ = 0;
  }
  const cell = PICK_CELL;
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell));
  const ny = Math.max(1, Math.ceil((maxY - minY) / cell));
  const cellOf = (v: number, min: number, n: number) =>
    Math.min(n - 1, Math.max(0, Math.floor((v - min) / cell)));
  const start = new Uint32Array(nx * ny + 1);
  const visit = (t: number, fn: (cell: number) => void) => {
    const i = t * 9;
    const x0 = cellOf(
      Math.min(positions[i], positions[i + 3], positions[i + 6]),
      minX,
      nx,
    );
    const x1 = cellOf(
      Math.max(positions[i], positions[i + 3], positions[i + 6]),
      minX,
      nx,
    );
    const y0 = cellOf(
      Math.min(positions[i + 1], positions[i + 4], positions[i + 7]),
      minY,
      ny,
    );
    const y1 = cellOf(
      Math.max(positions[i + 1], positions[i + 4], positions[i + 7]),
      minY,
      ny,
    );
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        fn(y * nx + x);
      }
    }
  };
  for (let t = 0; t < count; t++) {
    visit(t, (c) => start[c + 1]++);
  }
  for (let c = 0; c < nx * ny; c++) {
    start[c + 1] += start[c];
  }
  const items = new Uint32Array(start[nx * ny]);
  const fill = start.slice(0, nx * ny);
  for (let t = 0; t < count; t++) {
    visit(t, (c) => (items[fill[c]++] = t));
  }
  return { minX, minY, minZ, maxX, maxY, maxZ, cell, nx, ny, start, items };
}

/**
 * Flat pieces level with a walkable floor in their cell are floor too: the
 * extractor's per-vertex floor misses some patches (a corner flagged outside,
 * a vertex over a different storey) and they would read as roof tops.
 */
function adoptFloorPatches(
  vx: Float32Array,
  tris: Uint32Array,
  info: Uint16Array,
  normals: Float32Array,
  triTotal: number,
  floors: FloorLevels,
) {
  const { minX, minY, cell, width, height, levels } = floors;
  let adopted = 0;
  for (let t = 0; t < triTotal; t++) {
    const value = info[t];
    if (
      value & INFO_WALKABLE ||
      value & INFO_SURFACE ||
      normals[t * 3 + 2] < 0.8
    ) {
      continue;
    }
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const z = (vx[a + 2] + vx[b + 2] + vx[c + 2]) / 3;
    const gx = Math.floor(((vx[a] + vx[b] + vx[c]) / 3 - minX) / cell);
    const gy = Math.floor(
      ((vx[a + 1] + vx[b + 1] + vx[c + 1]) / 3 - minY) / cell,
    );
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) {
      continue;
    }
    // The grown levels reach a cell past the floor, so patches join from
    // the edges in over a few passes.
    const at = gy * width + gx;
    // Levels keep the lowest height of a cluster, so a floor sits at or a
    // little above its level; a roof is a storey above.
    for (let k = 0; k < 4; k++) {
      const rise = z - levels[at * 4 + k];
      if (rise >= -4 && rise <= 20) {
        info[t] |= INFO_WALKABLE;
        adopted++;
        break;
      }
    }
  }
  return adopted;
}

/**
 * Sorts the mesh's connected parts. Wire-like parts (little surface for
 * their size: cables, poles, thin trim) alias into dotted lines from above,
 * so the top-down bake leaves them out. Clusters of small parts that touch
 * (a crate is a dozen planks) are props and get a tone of their own.
 */
function classifyParts(
  vx: Float32Array,
  tris: Uint32Array,
  canon: Int32Array,
  info: Uint16Array,
  triTotal: number,
) {
  const vertexTotal = canon.length;
  const parent = new Int32Array(vertexTotal);
  for (let i = 0; i < vertexTotal; i++) {
    parent[i] = i;
  }
  const find = (i: number) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let t = 0; t < triTotal; t++) {
    const a = find(canon[tris[t * 3]]);
    const b = find(canon[tris[t * 3 + 1]]);
    parent[b] = a;
    parent[find(canon[tris[t * 3 + 2]])] = a;
  }

  // Parts, numbered densely.
  const partOf = new Int32Array(vertexTotal).fill(-1);
  const triPart = new Int32Array(triTotal);
  let partCount = 0;
  for (let t = 0; t < triTotal; t++) {
    const r = find(canon[tris[t * 3]]);
    if (partOf[r] < 0) {
      partOf[r] = partCount++;
    }
    triPart[t] = partOf[r];
  }
  const area = new Float64Array(partCount);
  const box = new Float32Array(partCount * 6);
  const foliage = new Uint8Array(partCount);
  for (let i = 0; i < partCount; i++) {
    box[i * 6] = box[i * 6 + 1] = box[i * 6 + 2] = Infinity;
    box[i * 6 + 3] = box[i * 6 + 4] = box[i * 6 + 5] = -Infinity;
  }
  for (let t = 0; t < triTotal; t++) {
    const part = triPart[t];
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const ux = vx[b] - vx[a];
    const uy = vx[b + 1] - vx[a + 1];
    const uz = vx[b + 2] - vx[a + 2];
    const wx = vx[c] - vx[a];
    const wy = vx[c + 1] - vx[a + 1];
    const wz = vx[c + 2] - vx[a + 2];
    area[part] +=
      Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
    if ((info[t] & INFO_SURFACE) === SURFACE_FOLIAGE) {
      foliage[part] = 1;
    }
    for (const v of [a, b, c]) {
      for (let k = 0; k < 3; k++) {
        box[part * 6 + k] = Math.min(box[part * 6 + k], vx[v + k]);
        box[part * 6 + 3 + k] = Math.max(box[part * 6 + 3 + k], vx[v + k]);
      }
    }
  }
  const diagonal = (b: Float32Array, i: number) =>
    Math.hypot(
      b[i * 6 + 3] - b[i * 6],
      b[i * 6 + 4] - b[i * 6 + 1],
      b[i * 6 + 5] - b[i * 6 + 2],
    );

  // Small parts whose boxes touch join one cluster, found through a grid.
  const cluster = new Int32Array(partCount);
  for (let i = 0; i < partCount; i++) {
    cluster[i] = i;
  }
  const findCluster = (i: number) => {
    while (cluster[i] !== i) {
      cluster[i] = cluster[cluster[i]];
      i = cluster[i];
    }
    return i;
  };
  const small = new Uint8Array(partCount);
  const cells = new Map<number, number[]>();
  const touches = (i: number, j: number) => {
    for (let k = 0; k < 3; k++) {
      if (
        box[i * 6 + k] > box[j * 6 + 3 + k] + PROP_GAP ||
        box[j * 6 + k] > box[i * 6 + 3 + k] + PROP_GAP
      ) {
        return false;
      }
    }
    return true;
  };
  for (let i = 0; i < partCount; i++) {
    if (foliage[i] || diagonal(box, i) > PROP_PART) {
      continue;
    }
    small[i] = 1;
    const x0 = Math.floor((box[i * 6] - PROP_GAP) / PROP_CELL);
    const x1 = Math.floor((box[i * 6 + 3] + PROP_GAP) / PROP_CELL);
    const y0 = Math.floor((box[i * 6 + 1] - PROP_GAP) / PROP_CELL);
    const y1 = Math.floor((box[i * 6 + 4] + PROP_GAP) / PROP_CELL);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const key = gx * 73856093 + gy * 19349663;
        let list = cells.get(key);
        if (!list) {
          list = [];
          cells.set(key, list);
        }
        for (const j of list) {
          if (touches(i, j)) {
            cluster[findCluster(j)] = findCluster(i);
          }
        }
        list.push(i);
      }
    }
  }
  const clusterBox = new Float32Array(partCount * 6);
  for (let i = 0; i < partCount; i++) {
    clusterBox[i * 6] =
      clusterBox[i * 6 + 1] =
      clusterBox[i * 6 + 2] =
        Infinity;
    clusterBox[i * 6 + 3] =
      clusterBox[i * 6 + 4] =
      clusterBox[i * 6 + 5] =
        -Infinity;
  }
  for (let i = 0; i < partCount; i++) {
    if (!small[i]) {
      continue;
    }
    const c = findCluster(i);
    for (let k = 0; k < 3; k++) {
      clusterBox[c * 6 + k] = Math.min(clusterBox[c * 6 + k], box[i * 6 + k]);
      clusterBox[c * 6 + 3 + k] = Math.max(
        clusterBox[c * 6 + 3 + k],
        box[i * 6 + 3 + k],
      );
    }
  }

  for (let t = 0; t < triTotal; t++) {
    const part = triPart[t];
    if (area[part] / Math.max(diagonal(box, part), 1) < THIN_PART) {
      info[t] |= INFO_THIN;
    }
    if (!small[part]) {
      continue;
    }
    const c = findCluster(part);
    const size = diagonal(clusterBox, c);
    // A cluster big enough to be a building, or a lone sliver, is not a prop.
    if (size > PROP_CLUSTER || size < 12) {
      continue;
    }
    const tone = 1 + ((Math.imul(c, 2654435761) >>> 30) % 3);
    info[t] |= tone << INFO_PROP_SHIFT;
  }
}

const THIN_PART = 8;
const PROP_PART = 200;
const PROP_CLUSTER = 340;
const PROP_GAP = 2;
const PROP_CELL = 64;

function allocMesh(triangles: number): PrepMesh {
  return {
    positions: new Float32Array(triangles * 9),
    height: new Int16Array(triangles * 3),
    info: new Uint16Array(triangles * 3),
    cut: new Int16Array(triangles * 9),
    remote: new Uint8Array(triangles * 3),
    canopy: new Int8Array(triangles * 12),
    cuttableStart: triangles,
    ghostStart: triangles,
  };
}

/**
 * Walkable heights per 16u cell, from triangles that sit on their own floor.
 * A cell only takes a floor covering its centre, so walls stay on the side of
 * "no floor here" and keep their full height.
 */
function floorLevels(
  vx: Float32Array,
  tris: Uint32Array,
  info: Uint16Array,
  triTotal: number,
): FloorLevels {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vx.length; i += 3) {
    minX = Math.min(minX, vx[i]);
    maxX = Math.max(maxX, vx[i]);
    minY = Math.min(minY, vx[i + 1]);
    maxY = Math.max(maxY, vx[i + 1]);
  }
  if (!(maxX >= minX)) {
    minX = minY = maxX = maxY = 0;
  }
  const cell = Math.max(LEVEL_CELL, Math.max(maxX - minX, maxY - minY) / 1024);
  const width = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const height = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);
  const levels = new Float32Array(width * height * 4).fill(EMPTY_LEVEL);

  for (let t = 0; t < triTotal; t++) {
    if (!(info[t] & INFO_WALKABLE)) {
      continue;
    }
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const ax = vx[a];
    const ay = vx[a + 1];
    const bx = vx[b];
    const by = vx[b + 1];
    const cx = vx[c];
    const cy = vx[c + 1];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-3) {
      continue;
    }
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / cell));
    const x1 = Math.min(
      width - 1,
      Math.floor((Math.max(ax, bx, cx) - minX) / cell),
    );
    const y0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - minY) / cell));
    const y1 = Math.min(
      height - 1,
      Math.floor((Math.max(ay, by, cy) - minY) / cell),
    );
    for (let gy = y0; gy <= y1; gy++) {
      const py = minY + (gy + 0.5) * cell;
      for (let gx = x0; gx <= x1; gx++) {
        const px = minX + (gx + 0.5) * cell;
        const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        const w = 1 - u - v;
        if (u < -1e-4 || v < -1e-4 || w < -1e-4) {
          continue;
        }
        const z = u * vx[a + 2] + v * vx[b + 2] + w * vx[c + 2];
        const at = (gy * width + gx) * 4;
        let placed = false;
        for (let k = 0; k < 4 && !placed; k++) {
          const level = levels[at + k];
          if (level === EMPTY_LEVEL) {
            levels[at + k] = z;
            placed = true;
          } else if (Math.abs(level - z) < LEVEL_MERGE) {
            levels[at + k] = Math.min(level, z);
            placed = true;
          }
        }
      }
    }
  }
  const coverage = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    coverage[i] = levels[i * 4] === EMPTY_LEVEL ? 0 : 255;
  }
  return { minX, minY, cell, width, height, levels, coverage };
}

/**
 * The levels grown by a cell into empty neighbours, so a sample just past
 * the edge of a floor (beside a wall, over a kerb) still finds it.
 */
function growLevels(floors: FloorLevels): FloorLevels {
  const { width, height, coverage } = floors;
  const levels = floors.levels.slice();
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const at = gy * width + gx;
      if (coverage[at]) {
        continue;
      }
      for (let k = 0; k < 8; k++) {
        const nx = gx + NEIGHBOURS[k * 2];
        const ny = gy + NEIGHBOURS[k * 2 + 1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          continue;
        }
        const from = ny * width + nx;
        if (coverage[from]) {
          levels.copyWithin(at * 4, from * 4, from * 4 + 4);
          break;
        }
      }
    }
  }
  return { ...floors, levels };
}

/**
 * Only the floors a player can walk to. The ground runs on under closed
 * buildings and the extractor calls it floor; cutting a roof for it would
 * open a sealed, empty shell. Walls at body height block a 4-way flood that
 * starts from every floor open to the sky and climbs steps, not walls.
 */
function reachableFloors(
  vx: Float32Array,
  tris: Uint32Array,
  info: Uint16Array,
  normals: Float32Array,
  triTotal: number,
  floors: FloorLevels,
  areas: PrepArea,
): FloorLevels {
  const { minX, minY, cell, width, height, levels } = floors;
  const cells = width * height;
  const over = new Float32Array(cells).fill(-Infinity);
  const blocked = new Uint8Array(cells);
  const cellX = (x: number) => Math.floor((x - minX) / cell);
  const cellY = (y: number) => Math.floor((y - minY) / cell);
  const blockCell = (gx: number, gy: number, zmin: number, zmax: number) => {
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) {
      return;
    }
    const at = gy * width + gx;
    for (let k = 0; k < 4; k++) {
      const level = levels[at * 4 + k];
      if (
        level !== EMPTY_LEVEL &&
        zmax > level + BODY_LOW &&
        zmin < level + BODY_HIGH
      ) {
        blocked[at] |= 1 << k;
      }
    }
  };
  for (let t = 0; t < triTotal; t++) {
    const value = info[t];
    if (
      value & (INFO_WALKABLE | INFO_THIN) ||
      (value & INFO_SURFACE) === SURFACE_FOLIAGE ||
      (value >> INFO_PROP_SHIFT) & 3
    ) {
      continue;
    }
    const a = tris[t * 3] * 3;
    const b = tris[t * 3 + 1] * 3;
    const c = tris[t * 3 + 2] * 3;
    const zmin = Math.min(vx[a + 2], vx[b + 2], vx[c + 2]);
    const zmax = Math.max(vx[a + 2], vx[b + 2], vx[c + 2]);
    if (Math.abs(normals[t * 3 + 2]) < 0.5) {
      // A wall: every cell its footprint crosses, walked edge by edge.
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const steps =
          Math.ceil(
            Math.hypot(vx[q] - vx[p], vx[q + 1] - vx[p + 1]) / (cell * 0.5),
          ) + 1;
        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          blockCell(
            cellX(vx[p] + (vx[q] - vx[p]) * f),
            cellY(vx[p + 1] + (vx[q + 1] - vx[p + 1]) * f),
            zmin,
            zmax,
          );
        }
      }
      continue;
    }
    // A roof or ceiling: the cells whose centre it covers.
    const ax = vx[a];
    const ay = vx[a + 1];
    const bx = vx[b];
    const by = vx[b + 1];
    const cx = vx[c];
    const cy = vx[c + 1];
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-3) {
      continue;
    }
    const x0 = Math.max(0, cellX(Math.min(ax, bx, cx)));
    const x1 = Math.min(width - 1, cellX(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, cellY(Math.min(ay, by, cy)));
    const y1 = Math.min(height - 1, cellY(Math.max(ay, by, cy)));
    for (let gy = y0; gy <= y1; gy++) {
      const py = minY + (gy + 0.5) * cell;
      for (let gx = x0; gx <= x1; gx++) {
        const px = minX + (gx + 0.5) * cell;
        const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        if (u < -1e-4 || v < -1e-4 || u + v > 1 + 1e-4) {
          continue;
        }
        const z = u * vx[a + 2] + v * vx[b + 2] + (1 - u - v) * vx[c + 2];
        const at = gy * width + gx;
        over[at] = Math.max(over[at], z);
      }
    }
  }

  const reached = new Uint8Array(cells * 4);
  const queue = new Int32Array(cells * 4);
  let head = 0;
  let tail = 0;
  for (let at = 0; at < cells; at++) {
    let top = -1;
    for (let k = 0; k < 4; k++) {
      const level = levels[at * 4 + k];
      if (level !== EMPTY_LEVEL && (top < 0 || level > levels[at * 4 + top])) {
        top = k;
      }
    }
    if (
      top >= 0 &&
      !(blocked[at] & (1 << top)) &&
      over[at] <= levels[at * 4 + top] + 16
    ) {
      reached[at * 4 + top] = 1;
      queue[tail++] = at * 4 + top;
    }
  }
  // Callout boxes are where players stand: their floors are reached even
  // under a roof (an enclosed site, a lower level, a tower top).
  for (const box of areas) {
    const x0 = Math.max(0, cellX(box.min[0]));
    const x1 = Math.min(width - 1, cellX(box.max[0]));
    const y0 = Math.max(0, Math.floor((box.min[1] - minY) / cell));
    const y1 = Math.min(height - 1, Math.floor((box.max[1] - minY) / cell));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const at = gy * width + gx;
        for (let k = 0; k < 4; k++) {
          const level = levels[at * 4 + k];
          if (
            level !== EMPTY_LEVEL &&
            level >= box.min[2] - AREA_SLACK &&
            level <= box.max[2] + AREA_SLACK &&
            !reached[at * 4 + k] &&
            !(blocked[at] & (1 << k))
          ) {
            reached[at * 4 + k] = 1;
            queue[tail++] = at * 4 + k;
          }
        }
      }
    }
  }
  while (head < tail) {
    const node = queue[head++];
    const at = node >> 2;
    const level = levels[node];
    const gx = at % width;
    const gy = (at - gx) / width;
    for (let d = 0; d < 4; d++) {
      const nx = gx + NEIGHBOURS[d * 2];
      const ny = gy + NEIGHBOURS[d * 2 + 1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const nb = ny * width + nx;
      for (let k = 0; k < 4; k++) {
        const other = levels[nb * 4 + k];
        if (
          other !== EMPTY_LEVEL &&
          Math.abs(other - level) <= STEP &&
          !reached[nb * 4 + k] &&
          !(blocked[nb] & (1 << k))
        ) {
          reached[nb * 4 + k] = 1;
          queue[tail++] = nb * 4 + k;
        }
      }
    }
  }

  const out = new Float32Array(levels.length).fill(EMPTY_LEVEL);
  const coverage = new Uint8Array(cells);
  for (let at = 0; at < cells; at++) {
    let o = 0;
    for (let k = 0; k < 4; k++) {
      // A wall's own cells were never stood on, but count when the floor
      // beside them was reached, so the wall still finds it.
      const near =
        reached[at * 4 + k] ||
        (blocked[at] & (1 << k) && touchesReached(at, levels[at * 4 + k]));
      if (near) {
        out[at * 4 + o++] = levels[at * 4 + k];
      }
    }
    coverage[at] = o ? 255 : 0;
  }
  return { ...floors, levels: out, coverage };

  function touchesReached(at: number, level: number) {
    const gx = at % width;
    const gy = (at - gx) / width;
    for (let d = 0; d < 8; d++) {
      const nx = gx + NEIGHBOURS[d * 2];
      const ny = gy + NEIGHBOURS[d * 2 + 1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const nb = ny * width + nx;
      for (let k = 0; k < 4; k++) {
        if (
          reached[nb * 4 + k] &&
          Math.abs(levels[nb * 4 + k] - level) <= STEP
        ) {
          return true;
        }
      }
    }
    return false;
  }
}

/** Walls between these heights over a floor stop a player walking. */
/** A callout box's floor may sit this far outside its z range. */
const AREA_SLACK = 40;
const BODY_LOW = 28;
const BODY_HIGH = 64;
const STEP = 32;

const NEIGHBOURS = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, -1, -1, 1, -1, -1, 1];
