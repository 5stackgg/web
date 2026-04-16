// Generates utilities/topoContours.ts — precomputed topographic contour data
// for TopoBackground.vue. Run once whenever peaks or grid settings change:
//
//   node scripts/generate-topo.mjs
//
// Keeps the heavy marching-squares + Chaikin smoothing work off the client so
// every page load doesn't have to recompute the same deterministic paths.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../utilities/topoContours.ts");

const VB_W = 1600;
const VB_H = 1000;
const CELL = 18;

const peaks = [
  // Broad base so contours exist across the whole map
  { cx: 800, cy: 500, h: 0.35, sx: 900, sy: 620 },

  // Major peaks — anisotropic + rotated so inner contours are irregular
  { cx: 400, cy: 380, h: 0.9, sx: 200, sy: 140, rot: 0.35 },
  { cx: 1220, cy: 250, h: 0.8, sx: 140, sy: 220, rot: -0.4 },
  { cx: 1100, cy: 780, h: 0.88, sx: 220, sy: 145, rot: 0.2 },
  { cx: 260, cy: 830, h: 0.68, sx: 135, sy: 170, rot: -0.25 },

  // Satellite bumps — break concentric symmetry
  { cx: 350, cy: 320, h: 0.28, sx: 75, sy: 60 },
  { cx: 475, cy: 430, h: 0.22, sx: 60, sy: 80 },
  { cx: 1280, cy: 310, h: 0.24, sx: 65, sy: 55 },
  { cx: 1170, cy: 195, h: 0.2, sx: 55, sy: 70 },
  { cx: 1045, cy: 720, h: 0.26, sx: 70, sy: 65 },
  { cx: 1165, cy: 835, h: 0.22, sx: 55, sy: 60 },
  { cx: 210, cy: 790, h: 0.2, sx: 55, sy: 55 },
  { cx: 315, cy: 885, h: 0.18, sx: 65, sy: 50 },

  // Ridges (elongated rotated peaks)
  { cx: 820, cy: 500, h: 0.55, sx: 280, sy: 95, rot: 0.28 },
  { cx: 680, cy: 180, h: 0.42, sx: 160, sy: 110, rot: -0.15 },
  { cx: 1380, cy: 620, h: 0.5, sx: 200, sy: 90, rot: -0.5 },

  // Secondary bumps filling gaps
  { cx: 140, cy: 540, h: 0.3, sx: 110, sy: 130 },
  { cx: 540, cy: 950, h: 0.28, sx: 140, sy: 80 },
  { cx: 1450, cy: 100, h: 0.32, sx: 110, sy: 100 },
  { cx: 940, cy: 820, h: 0.36, sx: 130, sy: 110 },
  { cx: 60, cy: 180, h: 0.26, sx: 120, sy: 110 },
  { cx: 1560, cy: 920, h: 0.3, sx: 110, sy: 120 },

  // Valleys (depressions)
  { cx: 560, cy: 640, h: -0.38, sx: 140, sy: 140 },
  { cx: 980, cy: 340, h: -0.3, sx: 130, sy: 120 },
  { cx: 1250, cy: 460, h: -0.26, sx: 110, sy: 140 },
];

function field(x, y) {
  let v = 0;
  for (const p of peaks) {
    const dx = x - p.cx;
    const dy = y - p.cy;
    const c = Math.cos(p.rot ?? 0);
    const s = Math.sin(p.rot ?? 0);
    const rx = dx * c + dy * s;
    const ry = -dx * s + dy * c;
    v +=
      p.h *
      Math.exp(-((rx * rx) / (2 * p.sx * p.sx) + (ry * ry) / (2 * p.sy * p.sy)));
  }
  return v;
}

function lerp(a, b, va, vb, iso) {
  if (Math.abs(vb - va) < 1e-9) return a;
  return a + ((iso - va) / (vb - va)) * (b - a);
}

function marchCell(x, y, cs, vtl, vtr, vbr, vbl, iso) {
  let code = 0;
  if (vtl > iso) code |= 1;
  if (vtr > iso) code |= 2;
  if (vbr > iso) code |= 4;
  if (vbl > iso) code |= 8;
  if (code === 0 || code === 15) return [];
  const top = [lerp(x, x + cs, vtl, vtr, iso), y];
  const right = [x + cs, lerp(y, y + cs, vtr, vbr, iso)];
  const bottom = [lerp(x, x + cs, vbl, vbr, iso), y + cs];
  const left = [x, lerp(y, y + cs, vtl, vbl, iso)];
  switch (code) {
    case 1: case 14: return [[left, top]];
    case 2: case 13: return [[top, right]];
    case 3: case 12: return [[left, right]];
    case 4: case 11: return [[right, bottom]];
    case 6: case 9: return [[top, bottom]];
    case 7: case 8: return [[left, bottom]];
    case 5: {
      const c = (vtl + vtr + vbr + vbl) / 4;
      return c > iso
        ? [[left, bottom], [top, right]]
        : [[left, top], [right, bottom]];
    }
    case 10: {
      const c = (vtl + vtr + vbr + vbl) / 4;
      return c > iso
        ? [[left, top], [right, bottom]]
        : [[left, bottom], [top, right]];
    }
    default:
      return [];
  }
}

function stitch(segments) {
  const key = (p) => `${Math.round(p[0] * 10)}_${Math.round(p[1] * 10)}`;
  const index = new Map();
  for (let i = 0; i < segments.length; i++) {
    for (const p of segments[i]) {
      const k = key(p);
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(i);
    }
  }
  const used = new Array(segments.length).fill(false);
  const polylines = [];
  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const [a, b] = segments[start];
    const pts = [a, b];
    while (true) {
      const last = pts[pts.length - 1];
      const cands = index.get(key(last)) || [];
      const next = cands.find((i) => !used[i]);
      if (next === undefined) break;
      used[next] = true;
      const seg = segments[next];
      pts.push(key(seg[0]) === key(last) ? seg[1] : seg[0]);
    }
    while (true) {
      const first = pts[0];
      const cands = index.get(key(first)) || [];
      const next = cands.find((i) => !used[i]);
      if (next === undefined) break;
      used[next] = true;
      const seg = segments[next];
      pts.unshift(key(seg[0]) === key(first) ? seg[1] : seg[0]);
    }
    const closed = key(pts[0]) === key(pts[pts.length - 1]);
    if (closed) pts.pop();
    polylines.push({ pts, closed });
  }
  return polylines;
}

function chaikin(pts, closed, passes = 3) {
  let out = pts;
  for (let p = 0; p < passes; p++) {
    const next = [];
    const n = out.length;
    if (closed) {
      for (let i = 0; i < n; i++) {
        const a = out[i];
        const b = out[(i + 1) % n];
        next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
    } else {
      next.push(out[0]);
      for (let i = 0; i < n - 1; i++) {
        const a = out[i];
        const b = out[i + 1];
        next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      next.push(out[n - 1]);
    }
    out = next;
  }
  return out;
}

function polylineLen(pts, closed) {
  let l = 0;
  const n = pts.length;
  const limit = closed ? n : n - 1;
  for (let i = 0; i < limit; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    l += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return l;
}

// Douglas-Peucker simplification — drop points within `tol` of the line
// they fall on. Shrinks path-data size ~3× with no visible change.
function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const mag2 = dx * dx + dy * dy;
  if (mag2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / mag2;
  const px = a[0] + t * dx;
  const py = a[1] + t * dy;
  return Math.hypot(p[0] - px, p[1] - py);
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let maxD = 0;
    let maxIdx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = perpDist(pts[k], pts[i], pts[j]);
      if (d > maxD) {
        maxD = d;
        maxIdx = k;
      }
    }
    if (maxD > tol && maxIdx > 0) {
      keep[maxIdx] = true;
      stack.push([i, maxIdx], [maxIdx, j]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function toPath(pts, closed) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += `L${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  }
  if (closed) d += "Z";
  return d;
}

// ── Build the grid ─────────────────────────────────────────────────────
const nx = Math.ceil(VB_W / CELL);
const ny = Math.ceil(VB_H / CELL);
const grid = new Float32Array((nx + 1) * (ny + 1));
const gi = (x, y) => x + y * (nx + 1);
for (let y = 0; y <= ny; y++) {
  for (let x = 0; x <= nx; x++) {
    grid[gi(x, y)] = field(x * CELL, y * CELL);
  }
}

const levels = [];
for (let v = -0.34; v <= -0.04; v += 0.03) levels.push(v);
for (let v = -0.01; v <= 0.3; v += 0.025) levels.push(v);
for (let v = 0.33; v <= 0.65; v += 0.03) levels.push(v);
for (let v = 0.69; v <= 1.0; v += 0.04) levels.push(v);

const contours = [];
let idx = 0;
for (let li = 0; li < levels.length; li++) {
  const iso = levels[li];
  const segs = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const vtl = grid[gi(x, y)];
      const vtr = grid[gi(x + 1, y)];
      const vbr = grid[gi(x + 1, y + 1)];
      const vbl = grid[gi(x, y + 1)];
      for (const s of marchCell(
        x * CELL,
        y * CELL,
        CELL,
        vtl,
        vtr,
        vbr,
        vbl,
        iso
      ))
        segs.push(s);
    }
  }
  for (const p of stitch(segs)) {
    if (p.pts.length < 4) continue;
    const smooth = chaikin(p.pts, p.closed, 3);
    const simplified = simplify(smooth, 0.3);
    const len = polylineLen(simplified, p.closed);
    if (len < 28) continue;
    const level = li / (levels.length - 1);
    const dur = 22 + li * 1.4 + ((idx * 7) % 9);
    const delay = -((idx * 2.3) % dur);
    let cx = 0;
    let cy = 0;
    for (const pt of simplified) {
      cx += pt[0];
      cy += pt[1];
    }
    cx /= simplified.length;
    cy /= simplified.length;
    contours.push({
      d: toPath(simplified, p.closed),
      level,
      length: len,
      closed: p.closed,
      dur,
      delay,
      idx: idx++,
      cx,
      cy,
    });
  }
}

// ── Pick animated flow paths (farthest-point within safe area) ─────────
const FLOW_COUNT = 9;
const eligible = contours.filter(
  (c) =>
    c.length > 180 &&
    c.cx >= VB_W * 0.18 &&
    c.cx <= VB_W * 0.82 &&
    c.cy >= VB_H * 0.2 &&
    c.cy <= VB_H * 0.8
);
const sorted = [...eligible].sort((a, b) => b.length - a.length);
const picked = [sorted[0]];
while (picked.length < FLOW_COUNT && picked.length < eligible.length) {
  let best = null;
  let bestMinDist = -1;
  for (const c of eligible) {
    if (picked.includes(c)) continue;
    let minDist = Infinity;
    for (const p of picked) {
      const dx = c.cx - p.cx;
      const dy = c.cy - p.cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist) minDist = d2;
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      best = c;
    }
  }
  if (!best) break;
  picked.push(best);
}

// ── Emit TypeScript ────────────────────────────────────────────────────
const staticPaths = contours.map((c) => ({
  d: c.d,
  o: Math.round((0.35 + c.level * 0.55) * 1000) / 1000,
}));
const flowPaths = picked.map((c) => ({
  d: c.d,
  len: Math.round(c.length * 10) / 10,
  dur: Math.round(c.dur * 10) / 10,
  delay: Math.round(c.delay * 10) / 10,
}));

const out = `// Auto-generated by scripts/generate-topo.mjs — DO NOT EDIT BY HAND.
// Precomputed topographic contour paths for TopoBackground.vue.
// Regenerate with: node scripts/generate-topo.mjs

export interface StaticContour {
  d: string;
  o: number;
}

export interface FlowContour {
  d: string;
  len: number;
  dur: number;
  delay: number;
}

export const TOPO_VIEW_WIDTH = ${VB_W};
export const TOPO_VIEW_HEIGHT = ${VB_H};

export const TOPO_STATIC: StaticContour[] = ${JSON.stringify(staticPaths)};

export const TOPO_FLOW: FlowContour[] = ${JSON.stringify(flowPaths)};
`;

writeFileSync(OUT_PATH, out);
const size = Buffer.byteLength(out);
console.log(
  `Wrote ${OUT_PATH} (${contours.length} static, ${picked.length} flow, ${(size / 1024).toFixed(1)}KB)`
);
