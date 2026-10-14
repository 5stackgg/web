// Smokes and fires as the demo parser recorded them, straight off the playback
// blob. The replay stage draws from these.
//
// A CS2 smoke is not a sphere: it fills the space it is thrown into, stops at
// whatever it hits, settles wider than it is tall, and thins where an explosion
// disturbs it. The parser derives that shape by flooding the free space around
// the detonation point against the map's collision mesh, and ships a density
// field.

/** One cloud's density field, straight off the playback blob (schema v9+). */
export type SmokeVolume = {
  gid?: number | null;
  round?: number;
  start_tick: number;
  /** Engine SmokeExpired tick. Absent when the round ended first. */
  end_tick?: number;
  /** World position of the grid's minimum corner, in source units. */
  ox: number;
  oy: number;
  oz: number;
  /** Cell edge length, in source units. */
  vs: number;
  dx: number;
  dy: number;
  dz: number;
  /**
   * base64, two cells per byte with the low nibble first, over dx*dy*dz cells
   * x-major then y then z. 0 is clear, 15 is fully dense.
   */
  den?: string;
};

// The Discover panel draws a predicted smoke's ground footprint on the radar
// from the same field: decode it, collapse it to columns, smooth it, and trace
// its outline.

/** A decoded field: `at(i,j,k)` gives density 0→1 for that cell. */
export type DecodedSmokeVolume = {
  src: SmokeVolume;
  dx: number;
  dy: number;
  dz: number;
  vs: number;
  ox: number;
  oy: number;
  oz: number;
  at(i: number, j: number, k: number): number;
};

/**
 * Cell widths of fully dense smoke needed to hide a target — the parser's
 * `blockingDepth`. Shading against it means a part of the cloud drawn opaque is
 * exactly a part that blocks sightlines.
 */
const BLOCKING_DEPTH = 3.0;

/**
 * The smallest grid worth drawing. A reconstruction that collapsed to a couple
 * of cells describes nothing. Mirrors `minCloudCells` in the parser.
 */
const MIN_VOLUME_CELLS = 48;

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Decodes a volume's density field. Returns null when the cloud is empty or too
 * small to describe a shape.
 */
export function decodeSmokeVolume(v: SmokeVolume): DecodedSmokeVolume | null {
  if (!v?.den || !v.dx || !v.dy || !v.dz) return null;
  if (v.dx * v.dy * v.dz < MIN_VOLUME_CELLS) return null;
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(v.den);
  } catch {
    return null;
  }
  const { dx, dy, dz } = v;
  if (bytes.length < Math.ceil((dx * dy * dz) / 2)) return null;
  return {
    src: v,
    dx,
    dy,
    dz,
    vs: v.vs,
    ox: v.ox,
    oy: v.oy,
    oz: v.oz,
    at(i, j, k) {
      if (i < 0 || j < 0 || k < 0 || i >= dx || j >= dy || k >= dz) return 0;
      const n = (k * dy + j) * dx + i;
      const q = n & 1 ? bytes[n >> 1] >> 4 : bytes[n >> 1] & 0x0f;
      return q / 15;
    },
  };
}

/**
 * Collapses a volume to a ground footprint, 0→1 per column.
 *
 * The value is the column's optical depth — its densities summed down through
 * the cloud — scaled against BLOCKING_DEPTH and clamped. So a column drawn
 * fully opaque is one that would actually hide someone, and the soft rim is
 * genuinely see-through. Taking the *thickest* cell instead would saturate
 * almost every column, since the dense core runs vertically through the middle,
 * and the cloud would render as a flat disc.
 */
export function smokeFootprint(v: DecodedSmokeVolume): Float32Array {
  const mask = new Float32Array(v.dx * v.dy);
  for (let j = 0; j < v.dy; j++) {
    for (let i = 0; i < v.dx; i++) {
      let sum = 0;
      for (let k = 0; k < v.dz; k++) {
        sum += v.at(i, j, k);
      }
      mask[j * v.dx + i] = Math.min(1, sum / BLOCKING_DEPTH);
    }
  }
  return mask;
}

/**
 * Resamples a footprint onto a finer grid with bilinear interpolation.
 *
 * Contours traced straight off 16-unit cells stair-step badly. Interpolating
 * first costs almost nothing and gives the cloud a rounded edge, which is
 * closer to the truth than the blocky one — the underlying field is smooth, the
 * grid is just how it is stored.
 */
export function upsampleFootprint(
  v: DecodedSmokeVolume,
  mask: Float32Array,
  factor: number,
): { mask: Float32Array; view: DecodedSmokeVolume } {
  const nx = v.dx * factor;
  const ny = v.dy * factor;
  const out = new Float32Array(nx * ny);
  const src = (i: number, j: number) =>
    i < 0 || j < 0 || i >= v.dx || j >= v.dy ? 0 : mask[j * v.dx + i];

  for (let j = 0; j < ny; j++) {
    // Sample position in source-cell space, offset so cell centres line up.
    const sy = (j + 0.5) / factor - 0.5;
    const j0 = Math.floor(sy);
    const fy = sy - j0;
    for (let i = 0; i < nx; i++) {
      const sx = (i + 0.5) / factor - 0.5;
      const i0 = Math.floor(sx);
      const fx = sx - i0;
      const a = src(i0, j0) * (1 - fx) + src(i0 + 1, j0) * fx;
      const b = src(i0, j0 + 1) * (1 - fx) + src(i0 + 1, j0 + 1) * fx;
      out[j * nx + i] = a * (1 - fy) + b * fy;
    }
  }
  // A view onto the same world space at the finer cell size, so traced contours
  // still come out in world units.
  const view: DecodedSmokeVolume = {
    ...v,
    dx: nx,
    dy: ny,
    vs: v.vs / factor,
    ox: v.ox,
    oy: v.oy,
  };
  return { mask: out, view };
}

/** How much finer the footprint is sampled before contouring. */
export const SMOKE_UPSAMPLE = 3;

/**
 * Traces the outline(s) of everything at or above `level` in a density
 * footprint, as closed loops of world-space points.
 *
 * Walks the boundary edges between inside and outside cells and links them into
 * loops. Every boundary edge belongs to exactly one loop, so this yields one
 * ring per connected piece — including holes, which draw correctly under the
 * even-odd fill an SVG path uses by default.
 */
export function traceContour(
  v: DecodedSmokeVolume,
  mask: Float32Array,
  level: number,
): Array<Array<{ x: number; y: number }>> {
  const { dx, dy, vs, ox, oy } = v;
  const inside = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < dx && j < dy && mask[j * dx + i] >= level;

  // Each boundary edge is directed so the inside cell lies on its left, which
  // makes the loops consistently wound and lets corners be linked by position.
  const edges = new Map<string, { x: number; y: number }>();
  const key = (x: number, y: number) => `${x},${y}`;

  for (let j = 0; j < dy; j++) {
    for (let i = 0; i < dx; i++) {
      if (!inside(i, j)) continue;
      if (!inside(i, j - 1)) edges.set(key(i, j), { x: i + 1, y: j });
      if (!inside(i + 1, j)) edges.set(key(i + 1, j), { x: i + 1, y: j + 1 });
      if (!inside(i, j + 1)) edges.set(key(i + 1, j + 1), { x: i, y: j + 1 });
      if (!inside(i - 1, j)) edges.set(key(i, j + 1), { x: i, y: j });
    }
  }

  const loops: Array<Array<{ x: number; y: number }>> = [];
  while (edges.size > 0) {
    const startKey = edges.keys().next().value as string;
    const [sx, sy] = startKey.split(",").map(Number);
    const loop: Array<{ x: number; y: number }> = [];
    let cx = sx;
    let cy = sy;
    // Bound the walk by the edge count so a malformed mask cannot spin forever.
    for (let guard = edges.size + 1; guard > 0; guard--) {
      const next = edges.get(key(cx, cy));
      if (!next) break;
      edges.delete(key(cx, cy));
      loop.push({ x: ox + cx * vs, y: oy + cy * vs });
      cx = next.x;
      cy = next.y;
      if (cx === sx && cy === sy) break;
    }
    if (loop.length >= 3) loops.push(simplifyLoop(loop));
  }
  return loops;
}

/** Drops collinear points, which removes most vertices along straight runs. */
function simplifyLoop(
  loop: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[(i - 1 + n) % n];
    const b = loop[i];
    const c = loop[(i + 1) % n];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > 1e-6) out.push(b);
  }
  return out.length >= 3 ? out : loop;
}

// Fire needs no reconstruction: the engine networks every individual flame, so
// the parser records exactly where each one burned and for how long.

/** One flame: where it burned, and the tick range it was alight. */
export type InfernoFire = {
  x: number;
  y: number;
  z: number;
  /** First tick alight. */
  s: number;
  /** Last tick alight — early when a smoke extinguished it. */
  e: number;
};

/** One molotov or incendiary burn. */
export type Inferno = {
  id: number;
  round?: number;
  thrower?: string;
  thrower_team?: string;
  start_tick: number;
  end_tick?: number;
  fires?: InfernoFire[];
};
