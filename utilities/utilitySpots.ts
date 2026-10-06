import { calloutAt, humanizeCallout } from "~/utilities/mapCallouts";
import type { MapCallout } from "~/utilities/mapCallouts";
import { UTILITY_TYPES } from "~/utilities/utilityDisplay";
import type { UtilityType } from "~/types/utility";

/**
 * Just enough of a lineup to say where it lands. The page fetches this for the
 * whole filtered library, not the visible page of 60, so a spot's count is the
 * count of everything that reaches it rather than of whatever happened to load.
 */
export type UtilityLandingRow = {
  id: string;
  utility_type: UtilityType;
  land_x: number | string | null;
  land_y: number | string | null;
  land_z: number | string | null;
};

export type UtilitySpot = {
  /** The raw callout name. Stable across locales, so it is what the URL holds. */
  key: string;
  /** What a player would call it: "Bombsite A" reads "A Site". */
  label: string;
  /** Every lineup that lands here, in the order they came in. */
  ids: string[];
  /** The kinds of grenade that reach it, in the app's usual type order. */
  types: UtilityType[];
};

/**
 * The library grouped by the place each throw lands, biggest first.
 *
 * Spot-first browsing starts from "where do I need utility", and the callout a
 * grenade comes to rest in is the answer a player would give. A throw with no
 * landing recorded, or one that lands nowhere the map names, belongs to no spot:
 * it stays in the full list but cannot be found from here, which is better than
 * inventing an "Other" spot that would be the biggest one on half the maps.
 */
export function groupUtilitySpots(
  rows: UtilityLandingRow[],
  callouts: MapCallout[],
): UtilitySpot[] {
  if (!callouts.length) {
    return [];
  }

  const byKey = new Map<string, { ids: string[]; types: Set<UtilityType> }>();
  for (const row of rows) {
    if (row.land_x == null || row.land_y == null) {
      continue;
    }
    const key = calloutAt(
      { x: row.land_x, y: row.land_y, z: row.land_z },
      callouts,
    );
    if (!key) {
      continue;
    }
    const entry = byKey.get(key) ?? { ids: [], types: new Set<UtilityType>() };
    entry.ids.push(row.id);
    entry.types.add(row.utility_type);
    byKey.set(key, entry);
  }

  return [...byKey.entries()]
    .map(([key, entry]) => ({
      key,
      label: humanizeCallout(key),
      ids: entry.ids,
      types: UTILITY_TYPES.filter((type) => entry.types.has(type)),
    }))
    .sort(
      (a, b) => b.ids.length - a.ids.length || a.label.localeCompare(b.label),
    );
}
