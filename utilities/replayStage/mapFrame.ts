import cleanMapName from "~/utilities/cleanMapName";
import type { StageMap, Vec3 } from "./types";

/**
 * Where play happens: the callout boxes' extent, padded, which on maps like
 * Vertigo is far smaller than everything drawn (the street far below the
 * tower). What is drawn when a map has no callouts. The camera frames this,
 * with room south of it for the map's title.
 */
export function playArea(map: StageMap): { min: Vec3; max: Vec3 } {
  const boxes = map.callouts.flatMap((c) => c.boxes);
  if (!boxes.length) {
    return { min: { ...map.min }, max: { ...map.max } };
  }
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const box of boxes) {
    min.x = Math.min(min.x, box.min[0]);
    min.y = Math.min(min.y, box.min[1]);
    min.z = Math.min(min.z, box.min[2]);
    max.x = Math.max(max.x, box.max[0]);
    max.y = Math.max(max.y, box.max[1]);
    max.z = Math.max(max.z, box.max[2]);
  }
  const pad = Math.max(max.x - min.x, max.y - min.y) * 0.08;
  min.x = Math.max(map.min.x, min.x - pad);
  min.y = Math.max(map.min.y, min.y - pad);
  max.x = Math.min(map.max.x, max.x + pad);
  max.y = Math.min(map.max.y, max.y + pad);
  return { min, max };
}

export type TitlePlace = { x: number; y: number; height: number };

const places = new WeakMap<StageMap, TitlePlace>();

/**
 * Where the map's title lies: centred under the play area, a little south
 * of it, then further south past any of the map's geometry in the way (a
 * few steps at most; then the clearest spot found). Sync, from the view
 * mesh, so the camera can frame it as soon as the map lands.
 */
export function titlePlace(map: StageMap): TitlePlace {
  const known = places.get(map);
  if (known) {
    return known;
  }
  const area = playArea(map);
  const height = (area.max.x - area.min.x) * 0.06;
  const x = (area.min.x + area.max.x) / 2;
  const half = (height * 1.25 * cleanMapName(map.name).length) / 2;
  const top = area.min.y - height * 0.4;
  const steps = 20;
  const bottom = top - height * (1.4 + steps * 0.25);
  // Vertices that could be in the way, once.
  const near: number[] = [];
  for (const chunk of map.view?.chunks ?? []) {
    const p = chunk.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i] - x) <= half && p[i + 1] <= top && p[i + 1] >= bottom) {
        near.push(p[i + 1]);
      }
    }
  }
  let best = { y: top - height * 0.7, count: Infinity };
  for (let step = 0; step <= steps; step++) {
    const y = top - height * (0.7 + step * 0.25);
    let count = 0;
    for (const vy of near) {
      if (Math.abs(vy - y) <= height * 0.7) {
        count++;
      }
    }
    if (count < best.count) {
      best = { y, count };
    }
    if (!count) {
      break;
    }
  }
  const place = { x, y: best.y, height };
  places.set(map, place);
  return place;
}

/** What the camera frames: the play area and the map's title. */
export function frameArea(map: StageMap): { min: Vec3; max: Vec3 } {
  const area = playArea(map);
  const title = titlePlace(map);
  area.min.y = Math.min(area.min.y, title.y - title.height * 0.9);
  return area;
}
