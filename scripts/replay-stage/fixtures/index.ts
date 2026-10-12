import type {
  StageFrame,
  StageMap,
} from "../../../utilities/replayStage/types";
import { mirageASite } from "./mirageASite";
import { nukeLevelsLower, nukeLevelsUpper } from "./nukeLevels";

/**
 * Height of the floor under (x, y), source units: the upward surface closest
 * to `near` (the scenario's rough floor height), so roofs are skipped.
 */
export type Ground = (x: number, y: number) => number;

export type Scenario = {
  name: string;
  map: string;
  /** Rough floor height, so scripted feet land on floors, not roofs. */
  floor: number;
  duration: number;
  frameAt(t: number, ground: Ground): StageFrame;
};

export const scenarios: Record<string, Scenario> = {
  [mirageASite.name]: mirageASite,
  [nukeLevelsLower.name]: nukeLevelsLower,
  [nukeLevelsUpper.name]: nukeLevelsUpper,
};

/**
 * The floor under a point, from the collision hull: good enough to stand
 * scripted players on the map. Cached per cell.
 */
export function groundFor(map: StageMap | null, near: number): Ground {
  const cache = new Map<string, number>();
  const tri = map?.tri;
  return (x, y) => {
    if (!tri) {
      return 0;
    }
    const key = `${Math.round(x / 8)},${Math.round(y / 8)}`;
    const hit = cache.get(key);
    if (hit !== undefined) {
      return hit;
    }
    let best = -Infinity;
    for (let i = 0; i < tri.length; i += 9) {
      const ax = tri[i],
        ay = tri[i + 1],
        az = tri[i + 2];
      const bx = tri[i + 3],
        by = tri[i + 4],
        bz = tri[i + 5];
      const cx = tri[i + 6],
        cy = tri[i + 7],
        cz = tri[i + 8];
      if (
        x < Math.min(ax, bx, cx) ||
        x > Math.max(ax, bx, cx) ||
        y < Math.min(ay, by, cy) ||
        y > Math.max(ay, by, cy)
      ) {
        continue;
      }
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-6) {
        continue;
      }
      const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      const w = 1 - u - v;
      if (u < 0 || v < 0 || w < 0) {
        continue;
      }
      const z = u * az + v * bz + w * cz;
      if (Math.abs(z - near) < Math.abs(best - near)) {
        best = z;
      }
    }
    const z = Number.isFinite(best) ? best : 0;
    cache.set(key, z);
    return z;
  };
}
