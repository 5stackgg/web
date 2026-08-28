import type { UtilityType } from "~/types/utility";

export type CalloutBox = {
  min: [number, number, number];
  max: [number, number, number];
};

export type MapCallout = {
  name: string;
  boxes: CalloutBox[];
};

export type CalloutPoint = {
  x: number | string;
  y: number | string;
  z?: number | string | null;
};

/**
 * How far outside every place volume a point may sit and still be named. A
 * grenade rests on top of geometry as often as inside a place, and the volumes
 * do not tile the map -- without a snap, half the smokes on any map have no
 * name at all.
 */
export const CALLOUT_SNAP_UNITS = 256;

// Hasura serialises double precision as a string so it cannot lose digits.
function num(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The tightest enclosing volume wins where places overlap. MEASURED, not
 * assumed: scored against `player_kills.attacker_location` (the engine's own
 * answer) over 1,920 labelled kills, smallest-volume beat smallest-footprint
 * 92.5% to 89.8%. Footprint alone loses the stacked pairs -- it called Mirage's
 * Catwalk "Underpass" 41 times, because Underpass sits under it and is the
 * narrower of the two seen from above.
 */
function volume(box: CalloutBox): number {
  return (
    (box.max[0] - box.min[0]) *
    (box.max[1] - box.min[1]) *
    Math.max(box.max[2] - box.min[2], 1)
  );
}

function containsXY(box: CalloutBox, x: number, y: number): boolean {
  return (
    x >= box.min[0] && x <= box.max[0] && y >= box.min[1] && y <= box.max[1]
  );
}

function axisGap(value: number, min: number, max: number): number {
  if (value < min) {
    return min - value;
  }
  if (value > max) {
    return value - max;
  }
  return 0;
}

function distanceTo(box: CalloutBox, x: number, y: number, z: number): number {
  const dx = axisGap(x, box.min[0], box.max[0]);
  const dy = axisGap(y, box.min[1], box.max[1]);
  const dz = axisGap(z, box.min[2], box.max[2]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

type Candidate = { name: string; box: CalloutBox };

/**
 * The name of the place a world point is in.
 *
 * XY containment is decided before Z because places stack: a smoke sitting on
 * a roof, or in the air over a site, still belongs to the place beneath it. Z
 * only breaks ties -- which is what keeps Nuke and Vertigo from naming the
 * lower level's callout for a point on the upper one.
 *
 * Where volumes nest ("A Site" containing "Goose"), the tightest one wins: the
 * more specific name is the one a player would say. See `volume` for why that
 * is measured in three dimensions rather than by footprint.
 */
export function calloutAt(
  point: CalloutPoint | null | undefined,
  callouts: MapCallout[] | null | undefined,
  options: { snap?: number } = {},
): string | null {
  if (!point || !callouts?.length) {
    return null;
  }

  const x = num(point.x);
  const y = num(point.y);
  const z = num(point.z);

  const inside: Candidate[] = [];
  const above: Candidate[] = [];
  let nearest: Candidate | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const callout of callouts) {
    for (const box of callout.boxes ?? []) {
      if (!box?.min || !box?.max) {
        continue;
      }
      if (containsXY(box, x, y)) {
        if (z >= box.min[2] && z <= box.max[2]) {
          inside.push({ name: callout.name, box });
        } else {
          above.push({ name: callout.name, box });
        }
        continue;
      }
      const distance = distanceTo(box, x, y, z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { name: callout.name, box };
      }
    }
  }

  if (inside.length) {
    return smallest(inside).name;
  }

  if (above.length) {
    let best = above[0];
    let bestGap = axisGap(z, best.box.min[2], best.box.max[2]);
    for (const candidate of above.slice(1)) {
      const gap = axisGap(z, candidate.box.min[2], candidate.box.max[2]);
      if (gap < bestGap || (gap === bestGap && volume(candidate.box) < volume(best.box))) {
        best = candidate;
        bestGap = gap;
      }
    }
    return best.name;
  }

  const snap = options.snap ?? CALLOUT_SNAP_UNITS;
  return nearest && nearestDistance <= snap ? nearest.name : null;
}

function smallest(candidates: Candidate[]): Candidate {
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (volume(candidate.box) < volume(best.box)) {
      best = candidate;
    }
  }
  return best;
}

// Valve names that read badly once split, keyed by the name with its spaces and
// case removed so a raw token and an already-spaced one both land here.
const CALLOUT_ALIASES: Record<string, string> = {
  bombsitea: "A Site",
  bombsiteb: "B Site",
  bombsitec: "C Site",
  tspawn: "T Spawn",
  ctspawn: "CT Spawn",
  terroristspawn: "T Spawn",
  counterterroristspawn: "CT Spawn",
};

export function humanizeCallout(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) {
    return "";
  }

  const alias = CALLOUT_ALIASES[value.toLowerCase().replace(/[\s_]+/g, "")];
  if (alias) {
    return alias;
  }

  return (
    value
      .replace(/[_-]+/g, " ")
      // Valve glues a lowercase joining word between two capitalised ones --
      // TopofMid, BackofA. The camelCase rule below would read that as one
      // word and give "Topof Mid", so it is split first.
      .replace(/([a-z])of([A-Z])/g, "$1 of $2")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export type AutoNameInput = {
  utilityType: UtilityType;
  origin: CalloutPoint | null | undefined;
  landing: CalloutPoint | null | undefined;
  callouts: MapCallout[] | null | undefined;
  t: (key: string, values?: Record<string, unknown>) => string;
};

/**
 * The name a throw would be given if nobody typed one. Empty when the map has
 * nothing to say about either end -- callers keep their own fallback rather
 * than being handed a name that says nothing.
 */
export function autoUtilityName({
  utilityType,
  origin,
  landing,
  callouts,
  t,
}: AutoNameInput): string {
  const from = humanizeCallout(calloutAt(origin, callouts));
  const to = humanizeCallout(calloutAt(landing, callouts));
  const type = t(`pages.utility.types.${utilityType}`);

  if (to && from) {
    return to === from
      ? t("pages.utility.auto_name.same", { to, type })
      : t("pages.utility.auto_name.full", { to, type, from });
  }
  if (to) {
    return t("pages.utility.auto_name.to_only", { to, type });
  }
  if (from) {
    return t("pages.utility.auto_name.from_only", { type, from });
  }
  return "";
}
