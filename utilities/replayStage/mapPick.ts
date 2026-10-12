import {
  INFO_CUT_WALL,
  INFO_CUT_WHOLE,
  INFO_SURFACE,
  NO_CUT,
  type PickGrid,
  type PrepMesh,
} from "./mapPrep";

/**
 * Ray picking against what the map draws, for camera input: the solid mesh's
 * triangles in the prep's grid of xy cells, walked along the ray, with the
 * shader's roof cut applied to every hit. A pick tests a few thousand
 * triangles where a raycast over the whole mesh tests a quarter million.
 */
export type MapPicker = {
  /**
   * Distance along the ray (source units, direction normalised) to the first
   * surface the map draws, or null.
   */
  pick(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
  ): number | null;
};

export type PickCut = {
  /** Height above each floor where geometry is cut (removed or ghosted), or null. */
  cut: number | null;
  /** A chosen lower storey: everything above this height is taken away. */
  above: number | null;
  /** Canopies above the cut are screened (2D): they let the pick through. */
  screenCanopies: boolean;
};

const EPSILON = 1e-4;

export function createMapPicker(
  mesh: PrepMesh,
  grid: PickGrid,
  cut: () => PickCut,
): MapPicker {
  const { positions, info, cut: planes } = mesh;
  const { minX, minY, minZ, maxX, maxY, maxZ, cell, nx, ny, start, items } =
    grid;

  /** Whether this hit is not solid right now (as `cutBy` in the shader). */
  function cutAway(t: number, z: number, state: PickCut) {
    if (state.above !== null && z > state.above) {
      return true;
    }
    const floor = planes[t * 9];
    if (state.cut === null || floor === NO_CUT) {
      return false;
    }
    const plane = floor + state.cut;
    const flags = info[t * 3];
    if ((flags & INFO_SURFACE) === 1) {
      return state.screenCanopies && z > plane;
    }
    if ((flags & (INFO_CUT_WALL | INFO_CUT_WHOLE)) === INFO_CUT_WALL) {
      return z > plane;
    }
    return planes[t * 9 + 1] > plane;
  }

  const cellOf = (v: number, min: number, n: number) =>
    Math.min(n - 1, Math.max(0, Math.floor((v - min) / cell)));

  return {
    pick(ox, oy, oz, dx, dy, dz) {
      if (!items.length) {
        return null;
      }
      // Clip the ray to the mesh's box.
      let t0 = 0;
      let t1 = Infinity;
      const slab = (o: number, d: number, lo: number, hi: number) => {
        if (Math.abs(d) < 1e-9) {
          return o >= lo && o <= hi;
        }
        const a = (lo - o) / d;
        const b = (hi - o) / d;
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
        return t0 <= t1;
      };
      if (
        !slab(ox, dx, minX, maxX) ||
        !slab(oy, dy, minY, maxY) ||
        !slab(oz, dz, minZ, maxZ)
      ) {
        return null;
      }
      const state = cut();
      let cx = cellOf(ox + dx * t0, minX, nx);
      let cy = cellOf(oy + dy * t0, minY, ny);
      const stepX = dx > 0 ? 1 : -1;
      const stepY = dy > 0 ? 1 : -1;
      const deltaX = Math.abs(dx) > 1e-9 ? cell / Math.abs(dx) : Infinity;
      const deltaY = Math.abs(dy) > 1e-9 ? cell / Math.abs(dy) : Infinity;
      let nextX =
        deltaX === Infinity
          ? Infinity
          : (minX + (cx + (dx > 0 ? 1 : 0)) * cell - ox) / dx;
      let nextY =
        deltaY === Infinity
          ? Infinity
          : (minY + (cy + (dy > 0 ? 1 : 0)) * cell - oy) / dy;
      let enter = t0;
      for (;;) {
        const exit = Math.min(nextX, nextY, t1);
        const at = cy * nx + cx;
        let best = Infinity;
        for (let k = start[at]; k < start[at + 1]; k++) {
          const t = items[k];
          const i = t * 9;
          // Möller-Trumbore, both faces.
          const ax = positions[i];
          const ay = positions[i + 1];
          const az = positions[i + 2];
          const e1x = positions[i + 3] - ax;
          const e1y = positions[i + 4] - ay;
          const e1z = positions[i + 5] - az;
          const e2x = positions[i + 6] - ax;
          const e2y = positions[i + 7] - ay;
          const e2z = positions[i + 8] - az;
          const px = dy * e2z - dz * e2y;
          const py = dz * e2x - dx * e2z;
          const pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-9) {
            continue;
          }
          const inv = 1 / det;
          const sx = ox - ax;
          const sy = oy - ay;
          const sz = oz - az;
          const u = (sx * px + sy * py + sz * pz) * inv;
          if (u < -EPSILON || u > 1 + EPSILON) {
            continue;
          }
          const qx = sy * e1z - sz * e1y;
          const qy = sz * e1x - sx * e1z;
          const qz = sx * e1y - sy * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < -EPSILON || u + v > 1 + EPSILON) {
            continue;
          }
          const hit = (e2x * qx + e2y * qy + e2z * qz) * inv;
          // Only hits inside this cell: later ones come round again there.
          if (hit < enter - EPSILON || hit > exit + EPSILON || hit >= best) {
            continue;
          }
          if (!cutAway(t, oz + dz * hit, state)) {
            best = hit;
          }
        }
        if (best < Infinity) {
          return best;
        }
        if (exit >= t1) {
          return null;
        }
        enter = exit;
        if (nextX < nextY) {
          cx += stepX;
          nextX += deltaX;
          if (cx < 0 || cx >= nx) {
            return null;
          }
        } else {
          cy += stepY;
          nextY += deltaY;
          if (cy < 0 || cy >= ny) {
            return null;
          }
        }
      }
    },
  };
}
