// CS2 navigation meshes (`maps/<map>.nav`, version 36) and the floor queries
// the view mesh is built on.
//
// FORMAT, as measured on every pool map and rush_001 (all 36.1):
//
//   u32 magic 0xFEEDFACE, u32 version, u32 subversion
//   binary KV3 blob -- variable length, not decoded
//   u32 cornerCount; f32x3 corners[cornerCount]
//   u32 polygonCount; { u8 k; u32 cornerIndex[k]; u32 unknown }[polygonCount]
//   a few bytes, then a SECOND KV3 blob
//   u32 areaCount; area[] {
//     u32 id; u64 attributeFlags; u8 hullIndex; u32 polygonIndex; u32 unknown
//     per polygon edge: u32 connectionCount; (u32 areaId, u32 edgeId)[connectionCount]
//     u8[5] legacy; u32 laddersAbove; u32[]; u32 laddersBelow; u32[]
//   }
//   ladders, hiding spots ... (not needed)
//
// Neither KV3 blob is decoded: the corner array and the area list are found by
// SHAPE -- a count followed by data that parses to completion with every index
// in range. Shape alone is not enough for the area list: a file cut in half
// still "parses" to a one-area list somewhere past the polygons. On every real
// nav the area count equals the polygon count and the list starts 138-144
// bytes after the polygons, so both are required, and anything else throws a
// NavError -- the caller builds floors from collision rather than trust it.

const NAV_MAGIC = 0xfeedface;
const NAV_VERSION = 36;
const MAX_CONNECTIONS = 64;
const MAX_LADDERS = 64;
const AREA_SCAN_BYTES = 4096;

export class NavError extends Error {
  constructor(message) {
    super(message);
    this.name = "NavError";
  }
}

function findCorners(dv) {
  const limit = Math.min(65536, dv.byteLength - 4);
  for (let offset = 16; offset < limit; offset++) {
    const n = dv.getUint32(offset, true);
    if (n <= 3 || n >= 500000 || offset + 4 + n * 12 + 5 > dv.byteLength) {
      continue;
    }
    let plausible = true;
    for (let i = 0; i < Math.min(n, 64) && plausible; i++) {
      for (let c = 0; c < 3; c++) {
        const v = dv.getFloat32(offset + 4 + i * 12 + c * 4, true);
        if (!(Math.abs(v) < 40000)) {
          plausible = false;
          break;
        }
      }
    }
    if (!plausible) {
      continue;
    }
    const p = offset + 4 + n * 12;
    const polygons = dv.getUint32(p, true);
    const k = dv.getUint8(p + 4);
    if (polygons === 0 || polygons >= 500000 || k < 3 || k > 16) {
      continue;
    }
    if (p + 5 + k * 4 > dv.byteLength) {
      continue;
    }
    let inRange = true;
    for (let i = 0; i < k; i++) {
      if (dv.getUint32(p + 5 + i * 4, true) >= n) {
        inRange = false;
        break;
      }
    }
    if (inRange) {
      return offset;
    }
  }
  return -1;
}

function tryAreas(dv, start, polygons) {
  const end = dv.byteLength;
  if (start + 4 > end) {
    return null;
  }
  const count = dv.getUint32(start, true);
  if (count === 0 || count !== polygons.length) {
    return null;
  }
  let o = start + 4;
  const areas = new Array(count);
  for (let a = 0; a < count; a++) {
    if (o + 21 > end) {
      return null;
    }
    const id = dv.getUint32(o, true);
    const polygon = dv.getUint32(o + 13, true);
    if (polygon >= polygons.length) {
      return null;
    }
    o += 21;
    for (let edge = 0; edge < polygons[polygon].length; edge++) {
      if (o + 4 > end) {
        return null;
      }
      const connections = dv.getUint32(o, true);
      if (connections > MAX_CONNECTIONS) {
        return null;
      }
      o += 4 + 8 * connections;
    }
    o += 5;
    for (let side = 0; side < 2; side++) {
      if (o + 4 > end) {
        return null;
      }
      const ladders = dv.getUint32(o, true);
      if (ladders > MAX_LADDERS) {
        return null;
      }
      o += 4 + 4 * ladders;
    }
    areas[a] = { id, polygon: polygons[polygon] };
  }
  return { areas, end: o };
}

/**
 * Parse a v36 nav. Returns `{ version, subversion, areas }` where each area is
 * `{ id, polygon: [[x, y, z], ...] }` in source units. Throws NavError for
 * anything it cannot vouch for.
 */
export function parseNav(input) {
  try {
    return parseNavUnchecked(input);
  } catch (error) {
    if (error instanceof NavError) {
      throw error;
    }
    throw new NavError(`nav unreadable: ${error.message}`);
  }
}

function parseNavUnchecked(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.byteLength < 16 || dv.getUint32(0, true) !== NAV_MAGIC) {
    throw new NavError("not a nav file (bad magic)");
  }
  const version = dv.getUint32(4, true);
  const subversion = dv.getUint32(8, true);
  if (version !== NAV_VERSION) {
    throw new NavError(`nav v${version}.${subversion} is not the v${NAV_VERSION} this reads`);
  }

  const cornerStart = findCorners(dv);
  if (cornerStart < 0) {
    throw new NavError(`nav v${version}.${subversion}: no corner array found`);
  }
  const cornerCount = dv.getUint32(cornerStart, true);
  const corners = new Array(cornerCount);
  for (let i = 0; i < cornerCount; i++) {
    const o = cornerStart + 4 + i * 12;
    corners[i] = [dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)];
  }

  let o = cornerStart + 4 + cornerCount * 12;
  const polygonCount = dv.getUint32(o, true);
  o += 4;
  const polygons = new Array(polygonCount);
  for (let i = 0; i < polygonCount; i++) {
    if (o + 1 > dv.byteLength) {
      throw new NavError(`nav: polygon ${i} runs past the end of the file`);
    }
    const k = dv.getUint8(o);
    if (o + 1 + 4 * k + 4 > dv.byteLength) {
      throw new NavError(`nav: polygon ${i} runs past the end of the file`);
    }
    const polygon = new Array(k);
    for (let c = 0; c < k; c++) {
      const index = dv.getUint32(o + 1 + c * 4, true);
      if (index >= cornerCount) {
        throw new NavError(`nav: polygon ${i} names corner ${index} of ${cornerCount}`);
      }
      polygon[c] = corners[index];
    }
    polygons[i] = polygon;
    o += 1 + 4 * k + 4;
  }

  const scanEnd = Math.min(dv.byteLength, o + AREA_SCAN_BYTES);
  for (let candidate = o; candidate < scanEnd; candidate++) {
    const parsed = tryAreas(dv, candidate, polygons);
    if (parsed) {
      return { version, subversion, areas: parsed.areas };
    }
  }
  throw new NavError(
    `nav v${version}.${subversion}: no list of ${polygonCount} areas within ` +
      `${AREA_SCAN_BYTES} bytes of the polygons`,
  );
}

/**
 * The XY-nearest point of a polygon to (x, y), with the polygon's height
 * there: inside it the height comes off the fan triangle under the point,
 * outside it off the nearest edge. Returns [distanceSquared, z].
 */
function nearestOnPolygon(xs, ys, zs, start, count, x, y) {
  let inside = false;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = xs[start + i];
    const yi = ys[start + i];
    const xj = xs[start + j];
    const yj = ys[start + j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  if (inside) {
    const ax = xs[start];
    const ay = ys[start];
    const az = zs[start];
    for (let t = 1; t + 1 < count; t++) {
      const bx = xs[start + t];
      const by = ys[start + t];
      const cx = xs[start + t + 1];
      const cy = ys[start + t + 1];
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-9) {
        continue;
      }
      const w1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const w2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      const w3 = 1 - w1 - w2;
      if (w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6) {
        return [0, w1 * az + w2 * zs[start + t] + w3 * zs[start + t + 1]];
      }
    }
  }

  let best = Infinity;
  let bestZ = zs[start];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const ax = xs[start + i];
    const ay = ys[start + i];
    const ex = xs[start + j] - ax;
    const ey = ys[start + j] - ay;
    const len2 = ex * ex + ey * ey;
    let t = len2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = ax + ex * t - x;
    const dy = ay + ey * t - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      bestZ = zs[start + i] + (zs[start + j] - zs[start + i]) * t;
    }
  }
  return [inside ? 0 : best, bestZ];
}

/**
 * A 2D grid over walkable polygons (nav areas, or up-facing collision
 * triangles when a map ships no nav) answering "what floor is under this
 * point". Heights are only ever taken from surfaces at or below the query
 * point plus `tolerance`, so the storey above a point never counts as its
 * floor.
 */
export class FloorIndex {
  constructor(polygons, { cell = 128 } = {}) {
    const total = polygons.reduce((n, p) => n + p.length, 0);
    this.count = polygons.length;
    this.cell = cell;
    this.xs = new Float64Array(total);
    this.ys = new Float64Array(total);
    this.zs = new Float64Array(total);
    this.start = new Uint32Array(polygons.length);
    this.size = new Uint8Array(polygons.length);
    this.minZ = new Float64Array(polygons.length);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const boxes = new Float64Array(polygons.length * 4);
    let w = 0;
    polygons.forEach((polygon, i) => {
      this.start[i] = w;
      this.size[i] = polygon.length;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      let z0 = Infinity;
      for (const [x, y, z] of polygon) {
        this.xs[w] = x;
        this.ys[w] = y;
        this.zs[w] = z;
        w += 1;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
        z0 = Math.min(z0, z);
      }
      this.minZ[i] = z0;
      boxes.set([x0, y0, x1, y1], i * 4);
      minX = Math.min(minX, x0);
      minY = Math.min(minY, y0);
      maxX = Math.max(maxX, x1);
      maxY = Math.max(maxY, y1);
    });

    if (!polygons.length) {
      minX = minY = 0;
      maxX = maxY = 0;
    }
    this.bounds = { minX, minY, maxX, maxY };
    this.nx = Math.max(1, Math.floor((maxX - minX) / cell) + 1);
    this.ny = Math.max(1, Math.floor((maxY - minY) / cell) + 1);

    const cells = this.nx * this.ny;
    const counts = new Uint32Array(cells + 1);
    const span = (i) => [
      Math.floor((boxes[i * 4] - minX) / cell),
      Math.floor((boxes[i * 4 + 1] - minY) / cell),
      Math.floor((boxes[i * 4 + 2] - minX) / cell),
      Math.floor((boxes[i * 4 + 3] - minY) / cell),
    ];
    for (let i = 0; i < polygons.length; i++) {
      const [ix0, iy0, ix1, iy1] = span(i);
      for (let iy = iy0; iy <= iy1; iy++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          counts[iy * this.nx + ix + 1] += 1;
        }
      }
    }
    for (let c = 0; c < cells; c++) {
      counts[c + 1] += counts[c];
    }
    this.offsets = counts;
    this.items = new Uint32Array(counts[cells]);
    const fill = counts.slice(0, cells);
    for (let i = 0; i < polygons.length; i++) {
      const [ix0, iy0, ix1, iy1] = span(i);
      for (let iy = iy0; iy <= iy1; iy++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          this.items[fill[iy * this.nx + ix]++] = i;
        }
      }
    }
    this.stamp = new Uint32Array(polygons.length);
    this.generation = 0;
  }

  nearest(i, x, y) {
    return nearestOnPolygon(this.xs, this.ys, this.zs, this.start[i], this.size[i], x, y);
  }

  nextGeneration() {
    this.generation += 1;
    if (this.generation === 0xffffffff) {
      this.stamp.fill(0);
      this.generation = 1;
    }
    return this.generation;
  }

  /**
   * Highest floor at or below z + tolerance within `radius` (XY) of (x, y),
   * or null.
   */
  floorAt(x, y, z, radius, tolerance = 8) {
    if (!this.count) {
      return null;
    }
    const { minX, minY } = this.bounds;
    const ix0 = Math.max(0, Math.floor((x - radius - minX) / this.cell));
    const iy0 = Math.max(0, Math.floor((y - radius - minY) / this.cell));
    const ix1 = Math.min(this.nx - 1, Math.floor((x + radius - minX) / this.cell));
    const iy1 = Math.min(this.ny - 1, Math.floor((y + radius - minY) / this.cell));
    const r2 = radius * radius;
    const ceiling = z + tolerance;
    const generation = this.nextGeneration();
    let best = null;
    for (let iy = iy0; iy <= iy1; iy++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const cellIndex = iy * this.nx + ix;
        for (let k = this.offsets[cellIndex]; k < this.offsets[cellIndex + 1]; k++) {
          const i = this.items[k];
          if (this.stamp[i] === generation) {
            continue;
          }
          this.stamp[i] = generation;
          if (this.minZ[i] > ceiling) {
            continue;
          }
          const [d2, h] = this.nearest(i, x, y);
          if (d2 <= r2 && h <= ceiling && (best === null || h > best)) {
            best = h;
          }
        }
      }
    }
    return best;
  }

  /**
   * The floor at or below z + tolerance whose XY-nearest point is closest to
   * (x, y), searched out to `radius`, or null. Rings of cells are walked
   * outwards and the walk stops once no unvisited cell can be closer.
   */
  nearestFloorAt(x, y, z, radius, tolerance = 8) {
    if (!this.count) {
      return null;
    }
    const { minX, minY } = this.bounds;
    const cx = Math.floor((x - minX) / this.cell);
    const cy = Math.floor((y - minY) / this.cell);
    const rings = Math.ceil(radius / this.cell) + 1;
    const ceiling = z + tolerance;
    const generation = this.nextGeneration();
    let bestD2 = radius * radius;
    let best = null;

    for (let ring = 0; ring <= rings; ring++) {
      for (let iy = cy - ring; iy <= cy + ring; iy++) {
        if (iy < 0 || iy >= this.ny) {
          continue;
        }
        const edgeRow = iy === cy - ring || iy === cy + ring;
        for (let ix = cx - ring; ix <= cx + ring; ix += edgeRow ? 1 : 2 * ring || 1) {
          if (ix < 0 || ix >= this.nx) {
            continue;
          }
          const cellIndex = iy * this.nx + ix;
          for (let k = this.offsets[cellIndex]; k < this.offsets[cellIndex + 1]; k++) {
            const i = this.items[k];
            if (this.stamp[i] === generation) {
              continue;
            }
            this.stamp[i] = generation;
            if (this.minZ[i] > ceiling) {
              continue;
            }
            const [d2, h] = this.nearest(i, x, y);
            if (h > ceiling) {
              continue;
            }
            if (best === null ? d2 <= bestD2 : d2 < bestD2 || (d2 === bestD2 && h > best)) {
              bestD2 = d2;
              best = h;
            }
          }
        }
      }
      if (best !== null && bestD2 <= (ring * this.cell) ** 2) {
        break;
      }
    }
    return best;
  }

  /**
   * The spec's two-step floor: the highest floor within `near`, else the
   * nearest within `far` flagged as outside playable space, else NaN.
   */
  floor(x, y, z, { near = 48, far = 1024, tolerance = 8 } = {}) {
    const close = this.floorAt(x, y, z, near, tolerance);
    if (close !== null) {
      return { z: close, outside: false };
    }
    const wide = this.nearestFloorAt(x, y, z, far, tolerance);
    if (wide !== null) {
      return { z: wide, outside: true };
    }
    return { z: NaN, outside: false };
  }
}

function distanceTransform1d(f, n, d, v, zb) {
  let k = 0;
  v[0] = 0;
  zb[0] = -Infinity;
  zb[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= zb[k]) {
      k -= 1;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    zb[k] = s;
    zb[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (zb[k + 1] < q) {
      k += 1;
    }
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/**
 * XY distance from any point to the nearest polygon, rasterised at `cell`
 * units: an exact Euclidean transform over polygon bounding-box cells, so it
 * errs slightly generous, which is the safe side for a keep/drop cut.
 */
export function distanceField(polygons, { cell = 64, margin = 2048 } = {}) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons) {
    for (const [x, y] of polygon) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!polygons.length) {
    return { at: () => Infinity };
  }
  minX -= margin + cell;
  minY -= margin + cell;
  maxX += margin + cell;
  maxY += margin + cell;
  const nx = Math.floor((maxX - minX) / cell) + 1;
  const ny = Math.floor((maxY - minY) / cell) + 1;
  const BIG = 1e20;
  const grid = new Float64Array(nx * ny).fill(BIG);
  for (const polygon of polygons) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of polygon) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    for (let iy = Math.floor((y0 - minY) / cell); iy <= Math.floor((y1 - minY) / cell); iy++) {
      for (let ix = Math.floor((x0 - minX) / cell); ix <= Math.floor((x1 - minX) / cell); ix++) {
        grid[iy * nx + ix] = 0;
      }
    }
  }

  const n = Math.max(nx, ny);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const zb = new Float64Array(n + 1);
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      f[iy] = grid[iy * nx + ix];
    }
    distanceTransform1d(f, ny, d, v, zb);
    for (let iy = 0; iy < ny; iy++) {
      grid[iy * nx + ix] = d[iy];
    }
  }
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      f[ix] = grid[iy * nx + ix];
    }
    distanceTransform1d(f, nx, d, v, zb);
    for (let ix = 0; ix < nx; ix++) {
      grid[iy * nx + ix] = Math.sqrt(d[ix]) * cell;
    }
  }

  return {
    at(x, y) {
      const ix = Math.floor((x - minX) / cell);
      const iy = Math.floor((y - minY) / cell);
      if (ix < 0 || iy < 0 || ix >= nx || iy >= ny) {
        return Infinity;
      }
      return grid[iy * nx + ix];
    },
  };
}

/**
 * The walkable polygons a view mesh's floors come from: the nav's areas when
 * it parses and validates, else collision (see collisionFloors). `rejected`
 * carries why a nav that exists was not used, for the caller to shout about.
 */
export function walkableSurfaces(navBuffer, soup, playerClip) {
  let rejected = null;
  if (navBuffer) {
    try {
      const nav = parseNav(navBuffer);
      return {
        source: "nav",
        polygons: nav.areas.map((a) => a.polygon),
        rejected,
      };
    } catch (error) {
      if (!(error instanceof NavError)) {
        throw error;
      }
      rejected = error.message;
    }
  }
  return { source: "collision", polygons: collisionFloors(soup, playerClip), rejected };
}

/**
 * Walkable surfaces for a map that ships no nav: up-facing collision
 * triangles that no player clip covers within a player's height. Measured
 * against the nav on mirage and nuke it trims LESS than the nav does (roughly
 * a third of what the nav would cut stays) and almost never more -- a roof
 * nobody clipped still reads as a floor -- so it errs toward showing geometry.
 */
export function collisionFloors(soup, playerClip, { minNormalZ = 0.7, headroom = 72 } = {}) {
  const triangle = (s, t) => {
    const o = t * 9;
    return [
      [s[o], s[o + 1], s[o + 2]],
      [s[o + 3], s[o + 4], s[o + 5]],
      [s[o + 6], s[o + 7], s[o + 8]],
    ];
  };
  const clips = [];
  for (let t = 0; t < playerClip.length / 9; t++) {
    clips.push(triangle(playerClip, t));
  }
  const clipIndex = new FloorIndex(clips);

  const floors = [];
  for (let t = 0; t < soup.length / 9; t++) {
    const o = t * 9;
    const ux = soup[o + 3] - soup[o];
    const uy = soup[o + 4] - soup[o + 1];
    const uz = soup[o + 5] - soup[o + 2];
    const vx = soup[o + 6] - soup[o];
    const vy = soup[o + 7] - soup[o + 1];
    const vz = soup[o + 8] - soup[o + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-6 || Math.abs(nz) / length < minNormalZ) {
      continue;
    }
    const cx = (soup[o] + soup[o + 3] + soup[o + 6]) / 3;
    const cy = (soup[o + 1] + soup[o + 4] + soup[o + 7]) / 3;
    const cz = (soup[o + 2] + soup[o + 5] + soup[o + 8]) / 3;
    const clip = clipIndex.floorAt(cx, cy, cz + headroom, 1, 0);
    if (clip !== null && clip > cz - 1) {
      continue;
    }
    floors.push(triangle(soup, t));
  }
  return floors;
}
