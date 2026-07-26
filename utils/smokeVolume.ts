// Smoke volumes as the demo parser measured them.
//
// A CS2 smoke is not a sphere: it fills the space it is thrown into, stops at
// whatever it hits, settles wider than it is tall, and thins where an explosion
// disturbs it. The parser derives that shape by flooding the free space around
// the detonation point against the map's collision mesh, and ships a density
// field. Both the 2D radar and the 3D replay draw from this, and the parser's
// sightline tests read the same field with the same thinning rules — so what is
// on screen and what the stats claim cannot drift apart.

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

// Kept in step with the parser (internal/parser/smoke.go). These decide how an
// explosion thins a cloud, and both sides must agree or the drawing will show a
// hole the stats do not believe in.
export const HE_BLAST_RADIUS = 250;
export const HE_BLAST_FULL_RADIUS = 100;
export const C4_BLAST_RADIUS = 600;
export const C4_BLAST_FULL_RADIUS = 240;
export const BLAST_CLEAR_SECS = 2.0;
/**
 * What a blast leaves behind where it is strongest. Matches the parser: the
 * shader's 2% floor applies only where its occlusion term is zero, which we do
 * not model, so a flat 2% would erase small clouds outright.
 */
export const RESIDUAL_DENSITY = 0.15;
/**
 * Cell widths of fully dense smoke needed to hide a target — the parser's
 * `blockingDepth`. Shading against it means a part of the cloud drawn opaque is
 * exactly a part that blocks sightlines.
 */
export const BLOCKING_DEPTH = 3.0;

/** An explosion that displaces smoke. */
export type SmokeBlast = {
  x: number;
  y: number;
  z: number;
  tick: number;
  radius: number;
  full: number;
};

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * The smallest grid worth drawing. A reconstruction that collapsed to a couple
 * of cells describes nothing, and rendering it produces an invisible cloud
 * where the viewer expects smoke — falling back to the plain puff is wrong but
 * at least visible. Mirrors `minCloudCells` in the parser.
 */
const MIN_VOLUME_CELLS = 48;

/**
 * Decodes a volume's density field. Returns null when the cloud is empty or too
 * small to describe a shape, so callers fall back to their unshaped rendering.
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
 * How much of a cell's density survives the explosions acting on it, mirroring
 * `blastThinning` in the parser. Full strength inside a blast's inner radius,
 * smoothly fading to nothing at its outer one, leaving a 2% floor rather than
 * erasing the smoke — a blast thins a cloud, it does not delete it.
 */
export function blastThinning(
  x: number,
  y: number,
  z: number,
  blasts: Array<{ x: number; y: number; z: number; r: number; full: number }>,
): number {
  let survive = 1;
  for (const b of blasts) {
    const dx = x - b.x;
    const dy = y - b.y;
    const dz = z - b.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist >= b.r) continue;
    let strength = 1;
    if (dist > b.full) {
      const f = (dist - b.full) / (b.r - b.full);
      strength = 1 - f * f * (3 - 2 * f);
    }
    survive *= 1 - strength * (1 - RESIDUAL_DENSITY);
  }
  return survive;
}

/**
 * The blasts still holding a cloud open at a tick, with their radii shrunk by
 * how far the smoke has filled back in.
 */
export function activeBlastsAt(
  blasts: SmokeBlast[],
  tick: number,
  tickRate: number,
): Array<{ x: number; y: number; z: number; r: number; full: number }> {
  if (!blasts.length || !tickRate) return [];
  const out: Array<{
    x: number;
    y: number;
    z: number;
    r: number;
    full: number;
  }> = [];
  for (const b of blasts) {
    if (tick < b.tick) continue;
    const age = (tick - b.tick) / tickRate;
    if (age >= BLAST_CLEAR_SECS) continue;
    const shrink = 1 - age / BLAST_CLEAR_SECS;
    out.push({
      x: b.x,
      y: b.y,
      z: b.z,
      r: b.radius * shrink,
      full: b.full * shrink,
    });
  }
  return out;
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
export function smokeFootprint(
  v: DecodedSmokeVolume,
  blasts: Array<{ x: number; y: number; z: number; r: number; full: number }>,
): Float32Array {
  const mask = new Float32Array(v.dx * v.dy);
  for (let j = 0; j < v.dy; j++) {
    for (let i = 0; i < v.dx; i++) {
      let sum = 0;
      for (let k = 0; k < v.dz; k++) {
        let d = v.at(i, j, k);
        if (d <= 0) continue;
        if (blasts.length) {
          d *= blastThinning(
            v.ox + (i + 0.5) * v.vs,
            v.oy + (j + 0.5) * v.vs,
            v.oz + (k + 0.5) * v.vs,
            blasts,
          );
        }
        sum += d;
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
 * even-odd fill an SVG path uses by default. Drawing several levels nested
 * inside each other is what gives the cloud a dense core and a soft rim.
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

/**
 * Density levels drawn as nested contours, faintest first. Three bands read as
 * a volume; one reads as a cut-out.
 */
export const SMOKE_CONTOUR_LEVELS = [0.12, 0.4, 0.72];

/**
 * How far a cloud has bloomed at a tick, 0 → 1. A smoke takes about a second to
 * fill its volume; the parser applies the same ramp when deciding sightlines,
 * so the drawing and the stats agree on when a smoke started blocking.
 */
export const SMOKE_BLOOM_SECS = 1.0;

export function smokeBloom(
  v: SmokeVolume,
  tick: number,
  tickRate: number,
): number {
  if (tick < v.start_tick) return 0;
  if (v.end_tick && tick > v.end_tick) return 0;
  if (!tickRate) return 1;
  const age = (tick - v.start_tick) / tickRate;
  return age >= SMOKE_BLOOM_SECS ? 1 : Math.max(0, age / SMOKE_BLOOM_SECS);
}

/** Whether a cloud is deployed at a tick at all. */
export function smokeAlive(v: SmokeVolume, tick: number): boolean {
  return tick >= v.start_tick && (!v.end_tick || tick <= v.end_tick);
}

/**
 * Bullet trails through smoke.
 *
 * Deliberately visual only. Per the CS2 shader breakdown the trail offsets the
 * sampling point along the bullet's path — a swirl — rather than reducing
 * density, so shooting a smoke does not open a sightline and the parser
 * correctly ignores it. Drawing it keeps the picture honest without inventing a
 * way to clear smoke that the game does not have.
 */
export const BULLET_SWIRL_SECS = 0.45;

export function bulletSwirlAlpha(
  shotTick: number,
  tick: number,
  tickRate: number,
): number {
  if (!tickRate || tick < shotTick) return 0;
  const age = (tick - shotTick) / tickRate;
  if (age >= BULLET_SWIRL_SECS) return 0;
  // Snaps in behind the bullet, then fades.
  return 1 - age / BULLET_SWIRL_SECS;
}

// ---------------------------------------------------------------------------
// Fire
// ---------------------------------------------------------------------------
//
// Unlike smoke, fire needs no reconstruction at all: the engine networks every
// individual flame, so the parser records exactly where each one burned and for
// how long. Drawing from that means the fire on screen is the ground the fire
// actually denied — including flames a smoke put out early, which show up as
// part of the burn simply going dark.

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

/** A flame that is alight at a tick, with how far through its life it is. */
export type LiveFlame = {
  x: number;
  y: number;
  z: number;
  /** 0 at ignition, 1 at burnout. */
  age: number;
  /** Ramps in as the flame catches and out as it dies. */
  intensity: number;
};

/** How long a flame takes to catch, and to gutter out, in seconds. */
const FLAME_IGNITE_SECS = 0.35;
const FLAME_DIE_SECS = 0.6;

/**
 * The flames alight at a tick. Each carries an intensity that ramps in as it
 * catches and out as it dies, so the edge of a burn flickers down rather than
 * vanishing — and a smoked-out molotov visibly dies back instead of cutting.
 */
export function liveFlames(
  inf: Inferno,
  tick: number,
  tickRate: number,
): LiveFlame[] {
  const out: LiveFlame[] = [];
  if (!inf.fires?.length || !tickRate) return out;
  for (const f of inf.fires) {
    if (tick < f.s || tick > f.e) continue;
    const span = Math.max(1, f.e - f.s);
    const age = (tick - f.s) / span;
    const inSecs = (tick - f.s) / tickRate;
    const outSecs = (f.e - tick) / tickRate;
    const intensity = Math.min(
      1,
      inSecs / FLAME_IGNITE_SECS,
      outSecs / FLAME_DIE_SECS,
    );
    if (intensity <= 0) continue;
    out.push({ x: f.x, y: f.y, z: f.z, age, intensity });
  }
  return out;
}

/** Whether a burn has any flame alight at a tick. */
export function infernoAlive(inf: Inferno, tick: number): boolean {
  return tick >= inf.start_tick && (!inf.end_tick || tick <= inf.end_tick);
}

/**
 * Deterministic 0→1 noise from a flame's position and the tick, so fire
 * flickers while playing, holds still when paused, and looks identical on a
 * second pass over the same moment.
 */
export function flameFlicker(x: number, y: number, tick: number): number {
  const v = Math.sin(x * 0.11 + y * 0.07 + tick * 0.21) * 43758.5453;
  return v - Math.floor(v);
}
