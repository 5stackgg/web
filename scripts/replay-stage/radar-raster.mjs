// Mask work for bake-radars.mjs, on square single-channel rasters (row-major,
// top row first): distance transforms, hole filling, island removal, and the
// playable-area footprint the transparent radars are cut to.

const INF = 1e20;

/** Distance in pixels from every pixel to the nearest set one (Felzenszwalb). */
export function distanceTo(mask, n) {
  const d = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) d[i] = mask[i] ? 0 : INF;
  const f = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const pass = () => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  };
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) f[y] = d[y * n + x];
    pass();
    for (let y = 0; y < n; y++) d[y * n + x] = out[y];
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) f[x] = d[y * n + x];
    pass();
    for (let x = 0; x < n; x++) d[y * n + x] = out[x];
  }
  const dist = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) dist[i] = Math.sqrt(d[i]);
  return dist;
}

/** Labels 4-connected regions of `value`; calls `visit(pixels)` per region. */
function regions(mask, n, value, visit) {
  const seen = new Uint8Array(n * n);
  const stack = new Int32Array(n * n);
  for (let start = 0; start < n * n; start++) {
    if (seen[start] || !!mask[start] !== value) continue;
    let top = 0;
    const pixels = [];
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const i = stack[--top];
      pixels.push(i);
      const x = i % n;
      for (const j of [i - n, i + n, x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < n * n && !seen[j] && !!mask[j] === value) {
          seen[j] = 1;
          stack[top++] = j;
        }
      }
    }
    visit(pixels);
  }
}

/** Fills every hole that does not reach the image edge. */
export function fillHoles(mask, n) {
  const out = Uint8Array.from(mask);
  regions(mask, n, false, (pixels) => {
    const edge = pixels.some((i) => i < n || i >= n * (n - 1) || i % n === 0 || i % n === n - 1);
    if (!edge) for (const i of pixels) out[i] = 1;
  });
  return out;
}

/** Drops regions smaller than `minPixels`. */
export function dropIslands(mask, n, minPixels) {
  const out = Uint8Array.from(mask);
  regions(mask, n, true, (pixels) => {
    if (pixels.length < minPixels) for (const i of pixels) out[i] = 0;
  });
  return out;
}

/**
 * The playable area as an antialiased alpha: the walkable floor closed over
 * gaps narrower than `close` (thin walls, noisy patches), its enclosed blocks
 * filled, grown by `grow` to take in the walls around it. Both in pixels.
 */
export function footprint(floor, n, { close, grow, minIsland }) {
  const solid = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) solid[i] = floor[i] >= 128 ? 1 : 0;
  const near = distanceTo(dropIslands(solid, n, minIsland), n);
  const beyond = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) beyond[i] = near[i] > close ? 1 : 0;
  const far = distanceTo(beyond, n);
  const closed = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) closed[i] = far[i] > close ? 1 : 0;
  const reach = distanceTo(fillHoles(closed, n), n);
  const alpha = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) alpha[i] = Math.min(1, Math.max(0, grow + 0.5 - reach[i]));
  return alpha;
}

/**
 * How far `b` sits from `a`, in pixels: the shift of `b` (within `range`)
 * that best overlaps `a`, refined to a fraction of a pixel, over the window
 * [x0, y0, x1, y1]. Also the overlap (intersection over union) at no shift
 * and at the best one.
 */
export function bestShift(a, b, n, range, window = [0, 0, n, n]) {
  const [x0, y0, x1, y1] = window;
  const iou = (dx, dy) => {
    let both = 0;
    let either = 0;
    for (let y = y0; y < y1; y++) {
      const sy = y - dy;
      for (let x = x0; x < x1; x++) {
        const sx = x - dx;
        const va = a[y * n + x];
        const vb = sx >= 0 && sy >= 0 && sx < n && sy < n ? b[sy * n + sx] : 0;
        both += va & vb;
        either += va | vb;
      }
    }
    return either ? both / either : 0;
  };
  const scores = new Map();
  let best = { dx: 0, dy: 0, score: -1 };
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const score = iou(dx, dy);
      scores.set(`${dx},${dy}`, score);
      if (score > best.score) best = { dx, dy, score };
    }
  }
  const at = (dx, dy) => scores.get(`${dx},${dy}`) ?? best.score;
  const refine = (lo, mid, hi) => {
    const denom = lo - 2 * mid + hi;
    return denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (lo - hi)) / denom)) : 0;
  };
  // b moved by (dx, dy) lines up with a, so b's error is the opposite.
  return {
    dx: -(best.dx + refine(at(best.dx - 1, best.dy), best.score, at(best.dx + 1, best.dy))),
    dy: -(best.dy + refine(at(best.dx, best.dy - 1), best.score, at(best.dx, best.dy + 1))),
    iou: best.score,
    iou0: scores.get("0,0"),
  };
}
