/**
 * Line of sight for the replay stage's vision layer. The map's collision hull
 * is baked once into a bit grid of voxels (a voxel is set when a triangle
 * passes through it) plus, per block of voxels, the triangles in it. A ray
 * walks the voxels with a 3D DDA, skipping open air at a few lookups a voxel,
 * and tests only the triangles of the blocks it meets something in, so it
 * stops exactly where the hull is, not a voxel early. CS2's smoke grids are
 * sampled along the same rays.
 *
 * Pure: no three.js, no DOM, so the worker builds the grid and the tests run
 * it in node.
 */

export type VisionGrid = {
  /** Minimum corner, source units. */
  ox: number;
  oy: number;
  oz: number;
  /** Voxel edge, source units. */
  vs: number;
  nx: number;
  ny: number;
  nz: number;
  /** One bit per voxel, solid = 1; index i + nx * (j + ny * k). */
  bits: Uint32Array;
  /** Voxels per block edge, and blocks per axis. */
  block: number;
  bx: number;
  by: number;
  bz: number;
  /** Triangle ids per block, CSR: block b owns blockTris[blockStart[b]..blockStart[b + 1]). */
  blockStart: Uint32Array;
  blockTris: Uint32Array;
  /** Per triangle, the ray that last tested it (made on first use, not sent by the worker). */
  seen?: Uint32Array;
  ray?: number;
};

export type VisionBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

/** Finest voxel, and the most memory the bits may take. */
const MIN_VOXEL = 12;
const MAX_BYTES = 12 * 1024 * 1024;
/** Voxels per block edge, coarser if the triangle lists would get too big. */
const BLOCKS = [3, 4, 6];
const MAX_BLOCK_ENTRIES = 5_000_000;
/** Air kept around the drawn map, so rays leave the grid in the open. */
const MARGIN = 64;
/**
 * Off the hull's integer grid, so a face is never exactly on a voxel
 * boundary (where it would mark both sides and thicken the wall).
 */
const ORIGIN_NUDGE = 0.37;

/**
 * Marks every voxel a hull triangle passes through (separating axes against
 * the voxel box) and lists every triangle under the blocks its box touches.
 * `bounds` crops the grid to the map that is drawn (skyboxes sit far outside).
 */
export function buildVisionGrid(
  tri: Float32Array,
  bounds?: VisionBounds | null,
): VisionGrid {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < tri.length; i += 3) {
    const x = tri[i];
    const y = tri[i + 1];
    const z = tri[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (
    bounds &&
    Number.isFinite(bounds.min.x) &&
    Number.isFinite(bounds.max.x)
  ) {
    minX = Math.max(minX, bounds.min.x - MARGIN);
    minY = Math.max(minY, bounds.min.y - MARGIN);
    minZ = Math.max(minZ, bounds.min.z - MARGIN);
    maxX = Math.min(maxX, bounds.max.x + MARGIN);
    maxY = Math.min(maxY, bounds.max.y + MARGIN);
    maxZ = Math.min(maxZ, bounds.max.z + MARGIN);
  }
  if (!(maxX > minX && maxY > minY && maxZ > minZ)) {
    minX = minY = minZ = 0;
    maxX = maxY = maxZ = 1;
  }
  const volume = (maxX - minX) * (maxY - minY) * (maxZ - minZ);
  const vs = Math.max(
    MIN_VOXEL,
    Math.ceil(Math.cbrt(volume / (MAX_BYTES * 8))),
  );
  const nx = Math.ceil((maxX - minX) / vs) + 2;
  const ny = Math.ceil((maxY - minY) / vs) + 2;
  const nz = Math.ceil((maxZ - minZ) / vs) + 2;
  const grid: VisionGrid = {
    ox: minX - ORIGIN_NUDGE,
    oy: minY - ORIGIN_NUDGE,
    oz: minZ - ORIGIN_NUDGE,
    vs,
    nx,
    ny,
    nz,
    bits: new Uint32Array(Math.ceil((nx * ny * nz) / 32)),
    block: 1,
    bx: 1,
    by: 1,
    bz: 1,
    blockStart: new Uint32Array(2),
    blockTris: new Uint32Array(0),
  };
  voxelize(grid, tri);
  for (const block of BLOCKS) {
    grid.block = block;
    grid.bx = Math.ceil(nx / block);
    grid.by = Math.ceil(ny / block);
    grid.bz = Math.ceil(nz / block);
    if (
      indexBlocks(
        grid,
        tri,
        block === BLOCKS[BLOCKS.length - 1] ? Infinity : MAX_BLOCK_ENTRIES,
      )
    ) {
      break;
    }
  }
  return grid;
}

/**
 * Lists each triangle under every block its bounding box touches; false
 * (and nothing built) when that would take more than `cap` entries.
 */
function indexBlocks(grid: VisionGrid, t: Float32Array, cap: number) {
  const { ox, oy, oz, bx, by, bz } = grid;
  const blockStart = new Uint32Array(bx * by * bz + 1);
  const size = grid.vs * grid.block;
  const inv = 1 / size;
  const count = t.length / 9;
  // Block ranges per triangle, computed once for both passes.
  const ranges = new Int32Array(count * 6);
  for (let n = 0; n < count; n++) {
    const o = n * 9;
    const r = n * 6;
    ranges[r] = Math.max(
      0,
      Math.floor((Math.min(t[o], t[o + 3], t[o + 6]) - ox) * inv),
    );
    ranges[r + 1] = Math.min(
      bx - 1,
      Math.floor((Math.max(t[o], t[o + 3], t[o + 6]) - ox) * inv),
    );
    ranges[r + 2] = Math.max(
      0,
      Math.floor((Math.min(t[o + 1], t[o + 4], t[o + 7]) - oy) * inv),
    );
    ranges[r + 3] = Math.min(
      by - 1,
      Math.floor((Math.max(t[o + 1], t[o + 4], t[o + 7]) - oy) * inv),
    );
    ranges[r + 4] = Math.max(
      0,
      Math.floor((Math.min(t[o + 2], t[o + 5], t[o + 8]) - oz) * inv),
    );
    ranges[r + 5] = Math.min(
      bz - 1,
      Math.floor((Math.max(t[o + 2], t[o + 5], t[o + 8]) - oz) * inv),
    );
  }
  for (let pass = 0; pass < 2; pass++) {
    const fill = pass === 1 ? blockStart.slice(0, -1) : null;
    for (let n = 0; n < count; n++) {
      const r = n * 6;
      for (let c = ranges[r + 4]; c <= ranges[r + 5]; c++) {
        for (let b = ranges[r + 2]; b <= ranges[r + 3]; b++) {
          let cell = ranges[r] + bx * (b + by * c);
          for (let a = ranges[r]; a <= ranges[r + 1]; a++, cell++) {
            if (fill) {
              grid.blockTris[fill[cell]++] = n;
            } else {
              blockStart[cell + 1]++;
            }
          }
        }
      }
    }
    if (!fill) {
      for (let i = 1; i < blockStart.length; i++) {
        blockStart[i] += blockStart[i - 1];
      }
      const total = blockStart[blockStart.length - 1];
      if (total > cap) {
        return false;
      }
      grid.blockStart = blockStart;
      grid.blockTris = new Uint32Array(total);
    }
  }
  return true;
}

function voxelize(grid: VisionGrid, t: Float32Array) {
  const { ox, oy, oz, vs, nx, ny, nz, bits } = grid;
  const inv = 1 / vs;
  const h = vs / 2;
  const axes = new Float64Array(10 * 6);
  const nxy = nx * ny;
  for (let o = 0; o < t.length; o += 9) {
    const ax = t[o],
      ay = t[o + 1],
      az = t[o + 2];
    const bx = t[o + 3],
      by = t[o + 4],
      bz = t[o + 5];
    const cx = t[o + 6],
      cy = t[o + 7],
      cz = t[o + 8];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - ox) * inv));
    const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - ox) * inv));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - oy) * inv));
    const j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - oy) * inv));
    const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - oz) * inv));
    const k1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - oz) * inv));
    if (i0 > i1 || j0 > j1 || k0 > k1) {
      continue;
    }
    if (i0 === i1 && j0 === j1 && k0 === k1) {
      const v = i0 + nx * j0 + nxy * k0;
      bits[v >>> 5] |= 1 << (v & 31);
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
    // The face normal first: it rejects most of a big slanted triangle's box.
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
    const end = n * 6;
    for (let k = k0; k <= k1; k++) {
      const pz = oz + (k + 0.5) * vs;
      for (let j = j0; j <= j1; j++) {
        const py = oy + (j + 0.5) * vs;
        let v = i0 + nx * j + nxy * k;
        for (let i = i0; i <= i1; i++, v++) {
          if (bits[v >>> 5] & (1 << (v & 31))) {
            continue;
          }
          const px = ox + (i + 0.5) * vs;
          let hit = true;
          for (let q = 0; q < end; q += 6) {
            const centre = axes[q] * px + axes[q + 1] * py + axes[q + 2] * pz;
            const rad = axes[q + 5];
            if (axes[q + 3] - centre > rad || axes[q + 4] - centre < -rad) {
              hit = false;
              break;
            }
          }
          if (hit) {
            bits[v >>> 5] |= 1 << (v & 31);
          }
        }
      }
    }
  }
}

/** Hits nearer than this are the surface the ray starts on. */
const NEAR = 0.05;

/**
 * Distance along a ray (direction normalised) to the first triangle of
 * `tri` it crosses, or `maxT` when it is clear that far. Leaving the grid is
 * clear. The voxels only say where to look: every block the ray meets
 * something in has its triangles tested exactly.
 */
export function castRay(
  g: VisionGrid,
  tri: Float32Array,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number,
): number {
  const vs = g.vs;
  const nx = g.nx;
  const ny = g.ny;
  const nz = g.nz;
  // Into the grid's box first, if the ray starts outside it.
  let t = 0;
  let tEnd = maxT;
  const sizeX = nx * vs;
  const sizeY = ny * vs;
  const sizeZ = nz * vs;
  let lx = x - g.ox;
  let ly = y - g.oy;
  let lz = z - g.oz;
  if (lx < 0 || ly < 0 || lz < 0 || lx >= sizeX || ly >= sizeY || lz >= sizeZ) {
    let t0 = 0;
    let t1 = maxT;
    const clip = (o: number, d: number, hi: number) => {
      if (Math.abs(d) < 1e-12) {
        return o >= 0 && o < hi;
      }
      const a = -o / d;
      const b = (hi - o) / d;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
      return t0 <= t1;
    };
    if (!clip(lx, dx, sizeX) || !clip(ly, dy, sizeY) || !clip(lz, dz, sizeZ)) {
      return maxT;
    }
    t = t0;
    tEnd = t1;
    lx += dx * t;
    ly += dy * t;
    lz += dz * t;
  }
  let i = Math.min(nx - 1, Math.max(0, Math.floor(lx / vs)));
  let j = Math.min(ny - 1, Math.max(0, Math.floor(ly / vs)));
  let k = Math.min(nz - 1, Math.max(0, Math.floor(lz / vs)));
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const deltaX = stepX ? vs / Math.abs(dx) : Infinity;
  const deltaY = stepY ? vs / Math.abs(dy) : Infinity;
  const deltaZ = stepZ ? vs / Math.abs(dz) : Infinity;
  let nextX = stepX ? t + ((stepX > 0 ? i + 1 : i) * vs - lx) / dx : Infinity;
  let nextY = stepY ? t + ((stepY > 0 ? j + 1 : j) * vs - ly) / dy : Infinity;
  let nextZ = stepZ ? t + ((stepZ > 0 ? k + 1 : k) * vs - lz) / dz : Infinity;
  const strideY = nx * stepY;
  const strideZ = nx * ny * stepZ;
  const bits = g.bits;
  const block = g.block;
  const bx = g.bx;
  const by = g.by;
  const starts = g.blockStart;
  const ids = g.blockTris;
  const seen = (g.seen ??= new Uint32Array(tri.length / 9));
  const ray = (g.ray = ((g.ray ?? 0) + 1) >>> 0);
  let v = i + nx * (j + ny * k);
  let lastBlock = -1;
  let best = tEnd < maxT ? tEnd : maxT;
  for (;;) {
    if (bits[v >>> 5] & (1 << (v & 31))) {
      // A ray never comes back to a block it left: one test each.
      const b =
        Math.floor(i / block) +
        bx * (Math.floor(j / block) + by * Math.floor(k / block));
      if (b !== lastBlock) {
        lastBlock = b;
        for (let s = starts[b]; s < starts[b + 1]; s++) {
          const id = ids[s];
          if (seen[id] === ray) {
            continue;
          }
          seen[id] = ray;
          const o = id * 9;
          // Möller-Trumbore, both faces.
          const ax = tri[o];
          const ay = tri[o + 1];
          const az = tri[o + 2];
          const e1x = tri[o + 3] - ax;
          const e1y = tri[o + 4] - ay;
          const e1z = tri[o + 5] - az;
          const e2x = tri[o + 6] - ax;
          const e2y = tri[o + 7] - ay;
          const e2z = tri[o + 8] - az;
          const px = dy * e2z - dz * e2y;
          const py = dz * e2x - dx * e2z;
          const pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-9 && det < 1e-9) {
            continue;
          }
          const inv = 1 / det;
          const sx = x - ax;
          const sy = y - ay;
          const sz = z - az;
          const u = (sx * px + sy * py + sz * pz) * inv;
          if (u < 0 || u > 1) {
            continue;
          }
          const qx = sy * e1z - sz * e1y;
          const qy = sz * e1x - sx * e1z;
          const qz = sx * e1y - sy * e1x;
          const w = (dx * qx + dy * qy + dz * qz) * inv;
          if (w < 0 || u + w > 1) {
            continue;
          }
          const hit = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (hit > NEAR && hit < best) {
            best = hit;
          }
        }
      }
    }
    if (nextX < nextY) {
      if (nextX < nextZ) {
        t = nextX;
        i += stepX;
        v += stepX;
        nextX += deltaX;
        if (t >= best || i < 0 || i >= nx) break;
      } else {
        t = nextZ;
        k += stepZ;
        v += strideZ;
        nextZ += deltaZ;
        if (t >= best || k < 0 || k >= nz) break;
      }
    } else if (nextY < nextZ) {
      t = nextY;
      j += stepY;
      v += strideY;
      nextY += deltaY;
      if (t >= best || j < 0 || j >= ny) break;
    } else {
      t = nextZ;
      k += stepZ;
      v += strideZ;
      nextZ += deltaZ;
      if (t >= best || k < 0 || k >= nz) break;
    }
  }
  return best < tEnd ? best : maxT;
}

/**
 * The floor under (x, y) going down from `z`: the top of the first solid
 * voxel, or NaN when there is none within `maxDrop`.
 */
export function floorBelow(
  g: VisionGrid,
  x: number,
  y: number,
  z: number,
  maxDrop: number,
): number {
  const i = Math.floor((x - g.ox) / g.vs);
  const j = Math.floor((y - g.oy) / g.vs);
  if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) {
    return NaN;
  }
  let k = Math.min(g.nz - 1, Math.floor((z - g.oz) / g.vs));
  const last = Math.max(0, Math.floor((z - maxDrop - g.oz) / g.vs));
  const layer = g.nx * g.ny;
  let v = i + g.nx * j + layer * k;
  for (; k >= last; k--, v -= layer) {
    if (g.bits[v >>> 5] & (1 << (v & 31))) {
      return g.oz + (k + 1) * g.vs;
    }
  }
  return NaN;
}

/**
 * Eye height for a player standing at (x, y, z): `eye` above the feet, or
 * just under a ceiling lower than that.
 */
export function eyeHeight(
  g: VisionGrid,
  tri: Float32Array,
  x: number,
  y: number,
  z: number,
  eye: number,
): number {
  const from = 20;
  const room = castRay(g, tri, x, y, z + from, 0, 0, 1, eye - from);
  return room < eye - from ? z + from + Math.max(0, room - 4) : z + eye;
}

// ------------------------------------------------------------------ smoke

/**
 * A live CS2 smoke as the stage baked it (smokeWorker.ts): RGBA texels, R the
 * signed distance to the cloud's surface (0.5 on it, `span` source units end
 * to end), G the share of its reach a voxel lies at (255 never), against how
 * far its front has got (`front`, smokeArrival.ts).
 */
export type VisionSmoke = {
  ox: number;
  oy: number;
  oz: number;
  vs: number;
  dx: number;
  dy: number;
  dz: number;
  texels: Uint8Array;
  span: number;
  reach: number;
  front: number;
  /** The cloud's box, source units. */
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  /** HE holes punched in it: x, y, z, radius each. */
  holes: Float32Array;
  holeCount: number;
};

/** Source units inside the surface where the cloud reads as solid. */
const SMOKE_SOLID = 10;
/** The cloud fades out before its grid box (smokeShaders BIAS + 2). */
const BOX_FADE = 22;

/** Whether the point is inside the opaque part of the cloud. */
export function smokeDenseAt(s: VisionSmoke, x: number, y: number, z: number) {
  const i = Math.floor((x - s.ox) / s.vs);
  const j = Math.floor((y - s.oy) / s.vs);
  const k = Math.floor((z - s.oz) / s.vs);
  if (i < 0 || j < 0 || k < 0 || i >= s.dx || j >= s.dy || k >= s.dz) {
    return false;
  }
  const o = (i + s.dx * (j + s.dy * k)) * 4;
  const share = s.texels[o + 1];
  if (share === 255) {
    return false;
  }
  const ahead = Math.max(0, (share / 254) * 1.004 - s.front) * s.reach;
  let d = (s.texels[o] / 255 - 0.5) * s.span - ahead;
  const edge = Math.min(
    x - s.ox,
    y - s.oy,
    z - s.oz,
    s.ox + s.dx * s.vs - x,
    s.oy + s.dy * s.vs - y,
    s.oz + s.dz * s.vs - z,
  );
  d = Math.min(d, edge - BOX_FADE);
  if (d < SMOKE_SOLID) {
    return false;
  }
  for (let h = 0; h < s.holeCount; h++) {
    const hx = s.holes[h * 4] - x;
    const hy = s.holes[h * 4 + 1] - y;
    const hz = s.holes[h * 4 + 2] - z;
    const r = s.holes[h * 4 + 3];
    if (hx * hx + hy * hy + hz * hz < r * r) {
      return false;
    }
  }
  return true;
}

/**
 * Distance along a ray (direction normalised) to the first opaque smoke, or
 * `maxT` when none is in the way.
 */
export function castSmoke(
  smokes: readonly VisionSmoke[],
  count: number,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number,
): number {
  let best = maxT;
  for (let n = 0; n < count; n++) {
    const s = smokes[n];
    let t0 = 0;
    let t1 = best;
    // Slabs against the cloud's box.
    if (Math.abs(dx) < 1e-9) {
      if (x < s.x0 || x > s.x1) continue;
    } else {
      const a = (s.x0 - x) / dx;
      const b = (s.x1 - x) / dx;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (Math.abs(dy) < 1e-9) {
      if (y < s.y0 || y > s.y1) continue;
    } else {
      const a = (s.y0 - y) / dy;
      const b = (s.y1 - y) / dy;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (Math.abs(dz) < 1e-9) {
      if (z < s.z0 || z > s.z1) continue;
    } else {
      const a = (s.z0 - z) / dz;
      const b = (s.z1 - z) / dz;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 > t1) {
      continue;
    }
    const step = s.vs * 0.5;
    for (let t = t0; t <= t1; t += step) {
      if (smokeDenseAt(s, x + dx * t, y + dy * t, z + dz * t)) {
        best = t;
        break;
      }
    }
  }
  return best;
}

/**
 * Whether the segment from a to b is clear of walls and smoke. The end is
 * allowed to sit in a solid voxel's reach by `slack` units (a player against
 * a wall).
 */
export function sightClear(
  g: VisionGrid,
  tri: Float32Array,
  smokes: readonly VisionSmoke[],
  smokeCount: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  slack = 0,
): boolean {
  const ex = bx - ax;
  const ey = by - ay;
  const ez = bz - az;
  const len = Math.sqrt(ex * ex + ey * ey + ez * ez);
  if (len < 1e-6) {
    return true;
  }
  const dx = ex / len;
  const dy = ey / len;
  const dz = ez / len;
  const reach = len - slack;
  if (castRay(g, tri, ax, ay, az, dx, dy, dz, reach) < reach) {
    return false;
  }
  return castSmoke(smokes, smokeCount, ax, ay, az, dx, dy, dz, reach) >= reach;
}

/** Signed angle from `fromDeg` to `toDeg`, degrees in (-180, 180]. */
export function angleBetween(fromDeg: number, toDeg: number) {
  let d = (toDeg - fromDeg) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Whether a point lies inside a player's horizontal field of view. */
export function inView(
  yawDeg: number,
  fovDeg: number,
  fx: number,
  fy: number,
  tx: number,
  ty: number,
) {
  const bearing = (Math.atan2(ty - fy, tx - fx) * 180) / Math.PI;
  return Math.abs(angleBetween(yawDeg, bearing)) <= fovDeg / 2;
}
