import {
  lerpAngle,
  roundIndex,
  roundTrails,
  trackAt,
  upperBound,
} from "./frameIndex";
import type { RoundIndex, StageBlob } from "./frameIndex";
import type {
  StageFrame,
  StageGrenadeType,
  StageHeatPoint,
  StageOverlayActor,
  StageTrails,
} from "./types";

/**
 * The buy-round overlay as a stage frame: several rounds stacked on one
 * clock, seconds after each one's freeze time ended, so the same moment of
 * every round shows at once ("where every CT stands at 0:15"). Each round's
 * living players become overlay actors, their walks short fading tails, and
 * the utility thrown so far heatmap discs. Pure, like `buildStageFrame`.
 */

export type OverlayFrameOptions = {
  /** Steam ids to show (one team across halves); everyone when unset. */
  include?: ReadonlySet<string> | null;
  /** Utility types to draw, as `StageFrameOptions.utility`. */
  utility?: Partial<Record<StageGrenadeType, boolean>>;
  /** Seconds of walk drawn behind each player. */
  tail?: number;
  callouts?: boolean;
  levelBand?: { min: number; max: number } | null;
};

type Heat = { at: number; point: StageHeatPoint };

type Stack = {
  key: string;
  trails: StageTrails;
  /** Detonations of every round, by seconds after freeze time. */
  heat: Heat[];
  shown: number;
  slice: StageHeatPoint[];
};

const stacks = new WeakMap<StageBlob, Stack>();

function includeKey(include: ReadonlySet<string> | null | undefined) {
  return include ? [...include].sort().join(",") : "*";
}

function utilityKey(utility: OverlayFrameOptions["utility"]) {
  if (!utility) {
    return "";
  }
  let key = "";
  for (const type of Object.keys(utility).sort()) {
    key += utility[type as StageGrenadeType] === false ? `-${type}` : "";
  }
  return key;
}

/** Trails and utility of a stack of rounds, built once per selection. */
function stackOf(
  blob: StageBlob,
  indexes: RoundIndex[],
  options: OverlayFrameOptions,
): Stack {
  const include = options.include ?? null;
  const key = `${indexes.map((i) => i.round).join(",")}|${includeKey(include)}|${utilityKey(options.utility)}|${options.tail ?? ""}`;
  const hit = stacks.get(blob);
  if (hit?.key === key) {
    return hit;
  }
  const strips: StageTrails["strips"] = [];
  let total = 0;
  const parts: StageTrails[] = indexes.map((index) => roundTrails(index));
  for (const trails of parts) {
    for (const strip of trails.strips) {
      if (!include || include.has(strip.id)) {
        total += strip.count;
      }
    }
  }
  const points = new Float32Array(total * 4);
  let at = 0;
  parts.forEach((trails, i) => {
    for (const strip of trails.strips) {
      if (include && !include.has(strip.id)) {
        continue;
      }
      points.set(
        trails.points.subarray(
          strip.start * 4,
          (strip.start + strip.count) * 4,
        ),
        at * 4,
      );
      strips.push({
        id: `${indexes[i].round}:${strip.id}`,
        team: strip.team,
        start: at,
        count: strip.count,
      });
      at += strip.count;
    }
  });

  const heat: Heat[] = [];
  for (const index of indexes) {
    for (const g of index.grenades) {
      if (
        !g.detonated ||
        g.endTick === null ||
        options.utility?.[g.type] === false ||
        (include && !(g.throwerId && include.has(g.throwerId)))
      ) {
        continue;
      }
      heat.push({
        at: (g.endTick - index.range.freezeEndTick) / index.rate,
        point: {
          key: g.key,
          gid: g.gid,
          type: g.type,
          team: g.team,
          at: g.at,
          selected: false,
        },
      });
    }
  }
  heat.sort((a, b) => a.at - b.at);

  const stack: Stack = {
    key,
    trails: { points, strips, tail: options.tail },
    heat,
    shown: 0,
    slice: [],
  };
  stacks.set(blob, stack);
  return stack;
}

export function buildOverlayFrame(
  blob: StageBlob,
  rounds: readonly number[],
  seconds: number,
  options: OverlayFrameOptions = {},
): StageFrame {
  const rate = blob.tick_rate || 64;
  const indexes: RoundIndex[] = [];
  for (const round of [...rounds].sort((a, b) => a - b)) {
    const index = roundIndex(blob, round);
    if (index) {
      indexes.push(index);
    }
  }
  const include = options.include ?? null;
  const actors: StageOverlayActor[] = [];
  for (const index of indexes) {
    const tick = index.range.freezeEndTick + seconds * index.rate;
    if (tick > index.range.endTick) {
      continue;
    }
    for (const track of index.tracks) {
      if (include && !include.has(track.id)) {
        continue;
      }
      if (track.deathTick !== null && tick >= track.deathTick) {
        continue;
      }
      const i = upperBound(track.ticks, tick) - 1;
      const row = track.rows[i];
      if (!row || !row.alive) {
        continue;
      }
      const next = track.rows[i + 1] ?? row;
      const k =
        next === row
          ? 0
          : (tick - row.tick) / Math.max(1, next.tick - row.tick);
      const p = trackAt(track, tick);
      actors.push({
        key: `${index.round}:${track.id}`,
        round: index.round,
        team: track.team,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: lerpAngle(row.yaw ?? 0, next.yaw ?? row.yaw ?? 0, k),
      });
    }
  }

  const stack = stackOf(blob, indexes, options);
  // The utility gone off by now: a prefix of the sorted list, kept while it
  // does not grow, so frames between detonations share one array.
  const shown = upperBoundHeat(stack.heat, seconds);
  if (shown !== stack.shown) {
    stack.shown = shown;
    stack.slice = stack.heat.slice(0, shown).map((h) => h.point);
  }

  const frame: StageFrame = {
    time: seconds,
    tickRate: rate,
    players: [],
    shots: [],
    damages: [],
    kills: [],
    projectiles: [],
    detonations: [],
    smokes: [],
    infernos: [],
    blasts: [],
    bomb: null,
    trails: stack.trails.strips.length ? stack.trails : null,
    overlay: { rounds: indexes.map((index) => index.round), actors },
  };
  if (stack.slice.length) {
    frame.heat = stack.slice;
  }
  if (options.callouts) {
    frame.callouts = true;
  }
  if (options.levelBand) {
    frame.levelBand = options.levelBand;
  }
  return frame;
}

function upperBoundHeat(heat: Heat[], seconds: number) {
  let lo = 0;
  let hi = heat.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (heat[mid].at <= seconds) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}
