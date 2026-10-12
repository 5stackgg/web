import cleanMapName from "~/utilities/cleanMapName";
import { levelsFor } from "./mapLevels";
import type { StageMap, Vec3 } from "./types";

/**
 * Where play happens: the callout boxes' extent, padded, which on maps like
 * Vertigo is far smaller than everything drawn (the street far below the
 * tower). What is drawn when a map has no callouts. The camera frames this,
 * with room south of it for the map's title.
 */
export function playArea(map: StageMap): { min: Vec3; max: Vec3 } {
  const boxes = map.callouts.flatMap((c) => c.boxes);
  if (!boxes.length && map.play) {
    // No callouts: where the match was played, with room round it.
    const { min, max } = map.play;
    const pad = Math.max(max.x - min.x, max.y - min.y, 512) * 0.15;
    return {
      min: {
        x: Math.max(map.min.x, min.x - pad),
        y: Math.max(map.min.y, min.y - pad),
        z: min.z,
      },
      max: {
        x: Math.min(map.max.x, max.x + pad),
        y: Math.min(map.max.y, max.y + pad),
        z: max.z,
      },
    };
  }
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

/** What a framing holds: the play area, the map's title, and a lower storey laid beside it. */
function areaWith(
  map: StageMap,
  split: LevelSplit | null,
): { min: Vec3; max: Vec3 } {
  const area = playArea(map);
  const title = titlePlace(map);
  area.min.y = Math.min(area.min.y, title.y - title.height * 0.9);
  if (split) {
    area.min.x = Math.min(area.min.x, split.min.x);
    area.max.x = Math.max(area.max.x, split.max.x);
    area.max.y = Math.max(area.max.y, split.max.y);
    // Its own title sits under it, as the map's does.
    area.min.y = Math.min(area.min.y, split.min.y - title.height * 2.2);
  }
  return area;
}

/**
 * What the camera frames. Given the screen's aspect (width / height), a
 * lower storey laid side by side first moves to the side that suits it.
 */
export function frameArea(
  map: StageMap,
  aspect?: number,
): { min: Vec3; max: Vec3 } {
  if (aspect && isSideBySide(map)) {
    fitSplit(map, aspect);
  }
  return areaWith(map, isSideBySide(map) ? levelSplit(map) : null);
}

/** The map's bounds and, laid beside it, its lower storey's: where the camera may go. */
export function drawnBounds(map: StageMap): { min: Vec3; max: Vec3 } {
  const split = isSideBySide(map) ? levelSplit(map) : null;
  if (!split) {
    return map;
  }
  return {
    min: {
      x: Math.min(map.min.x, split.min.x),
      y: Math.min(map.min.y, split.min.y),
      z: map.min.z,
    },
    max: {
      x: Math.max(map.max.x, split.max.x),
      y: Math.max(map.max.y, split.max.y),
      z: Math.max(map.max.z, split.max.z),
    },
  };
}

/**
 * A stacked map laid out side by side: its lower storey lifted out and set
 * beside the rest on the same table. Everything at or under `below` (source
 * z) is drawn, and placed, shifted by `offset` (source units).
 */
export type LevelSplit = {
  /** Points under this height are on the lower storey (where they are placed). */
  below: number;
  /** The storey's copy keeps geometry between these heights... */
  cut: number;
  bottom: number;
  /** ...and inside this source rect [x0, y0, x1, y1] (before the shift). */
  rect: [number, number, number, number];
  /** The storey's floor (source z, before the shift). */
  floor: number;
  offset: Vec3;
  /** The copy's footprint after the shift, for framing and its title. */
  min: Vec3;
  max: Vec3;
};

type Placement = "right" | "below";
type Splits = Record<Placement, LevelSplit> & { chosen: Placement };

const splits = new WeakMap<StageMap, Splits | null>();
const sideBySide = new WeakMap<StageMap, boolean>();

/** Whether a stacked map is shown side by side (the default). */
export function isSideBySide(map: StageMap) {
  return (sideBySide.get(map) ?? true) && !!levelSplit(map);
}

export function setSideBySide(map: StageMap, on: boolean) {
  sideBySide.set(map, on);
}

/**
 * Where the lower storey goes: right of the play area or below the map's
 * title (see `fitSplit`), a gap apart, its floor lifted to the upper floor's
 * height. Null on a map played on one storey. The object changes only when
 * the storey moves.
 */
export function levelSplit(map: StageMap): LevelSplit | null {
  const known = splitsOf(map);
  return known ? known[known.chosen] : null;
}

/** Both places the lower storey can go, for keeping either clear. */
export function levelSplits(map: StageMap): LevelSplit[] {
  const known = splitsOf(map);
  return known ? [known.right, known.below] : [];
}

/**
 * Moves the lower storey to the side that frames bigger on a screen of this
 * aspect: right on a wide one, below on a tall or narrow one. A clear margin
 * is needed to switch, so a screen near the tipping point does not flip it.
 */
function fitSplit(map: StageMap, aspect: number) {
  const known = splitsOf(map);
  if (known) {
    choose(known, map, aspect, 0.97);
  }
}

function choose(known: Splits, map: StageMap, aspect: number, margin: number) {
  // Right only when clearly bigger: the replay's scoreboard sits on the right.
  const size = (placement: Placement) => {
    const area = areaWith(map, known[placement]);
    const fit = Math.max(
      (area.max.x - area.min.x) / aspect,
      area.max.y - area.min.y,
    );
    return placement === "right" ? fit * 1.06 : fit;
  };
  const other: Placement = known.chosen === "right" ? "below" : "right";
  if (size(other) < size(known.chosen) * margin) {
    known.chosen = other;
  }
}

function splitsOf(map: StageMap): Splits | null {
  if (splits.has(map)) {
    return splits.get(map)!;
  }
  const levels = levelsFor(map.name.replace(/_night$/, ""));
  const upper = levels[0];
  const lower = levels[levels.length - 1];
  const ceiling = lower?.below ?? null;
  if (levels.length < 2 || ceiling === null) {
    splits.set(map, null);
    return null;
  }
  const area = playArea(map);
  // The storey's footprint: what of it lies in the play area, less the odd
  // stray (a dip in the terrain at the edge) that would drag it wide.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const chunk of map.view?.chunks ?? []) {
    const p = chunk.positions;
    for (let i = 0; i < p.length; i += 3) {
      const z = p[i + 2];
      if (
        z >= lower.bottom &&
        z <= ceiling &&
        p[i] >= area.min.x &&
        p[i] <= area.max.x &&
        p[i + 1] >= area.min.y &&
        p[i + 1] <= area.max.y
      ) {
        xs.push(p[i]);
        ys.push(p[i + 1]);
      }
    }
  }
  if (xs.length < 100) {
    splits.set(map, null);
    return null;
  }
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const at = (v: number[], f: number) => v[Math.floor((v.length - 1) * f)];
  const pad = 128;
  const min = {
    x: Math.max(area.min.x, at(xs, 0.01) - pad),
    y: Math.max(area.min.y, at(ys, 0.01) - pad),
    z: lower.bottom,
  };
  const max = {
    x: Math.min(area.max.x, at(xs, 0.99) + pad),
    y: Math.min(area.max.y, at(ys, 0.99) + pad),
    z: ceiling,
  };
  // The copy keeps only this, so the strays are not drawn either.
  const rect: [number, number, number, number] = [min.x, min.y, max.x, max.y];
  const gap = Math.max(area.max.x - area.min.x, area.max.y - area.min.y) * 0.06;
  const title = titlePlace(map);
  const lift = upper.floor - lower.floor;
  const placed = (offset: Vec3): LevelSplit => ({
    below: upper.from,
    cut: ceiling,
    bottom: lower.bottom,
    rect,
    floor: lower.floor,
    offset,
    min: { x: min.x + offset.x, y: min.y + offset.y, z: min.z + offset.z },
    max: { x: max.x + offset.x, y: max.y + offset.y, z: max.z + offset.z },
  });
  const right = placed({
    x: area.max.x + gap - min.x,
    y: (area.min.y + area.max.y) / 2 - (min.y + max.y) / 2,
    z: lift,
  });
  // Below the map's title, so the two never meet.
  const below = placed({
    x: (area.min.x + area.max.x) / 2 - (min.x + max.x) / 2,
    y: title.y - title.height * 0.9 - gap - max.y,
    z: lift,
  });
  const known: Splits = { right, below, chosen: "right" };
  // Until a screen says otherwise, a 16:10 one.
  choose(known, map, 1.6, 1);
  splits.set(map, known);
  return known;
}
