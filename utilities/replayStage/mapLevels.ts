/**
 * Maps played on two storeys stacked over each other (Nuke's B under A,
 * Vertigo's lower floor under the upper). Choosing the lower one takes away
 * everything above its ceiling so it can be seen from above; the upper one
 * is the map as it is.
 */
export type MapLevel = {
  id: string;
  label: string;
  /** Height (source units) above which the map is taken away, or null. */
  below: number | null;
  /** Lowest height (source units) a player on this level stands at. */
  from: number;
  /** Where its floors mostly are (source units). */
  floor: number;
  /** Nothing of this level is under this height (source units). */
  bottom: number;
};

const LEVELS: Record<string, MapLevel[]> = {
  // Upper floors stand at -416 and their undersides at about -430; B and
  // the tunnels are at -640..-768 with ceilings no higher than -504.
  de_nuke: [
    {
      id: "upper",
      label: "Upper",
      below: null,
      from: -560,
      floor: -416,
      bottom: -560,
    },
    {
      id: "lower",
      label: "Lower",
      below: -500,
      from: -Infinity,
      floor: -768,
      bottom: -900,
    },
  ],
  // The upper floor is at 11776, tunnels and T's lower floor at 11488 with
  // ceilings up to 11664.
  de_vertigo: [
    {
      id: "upper",
      label: "Upper",
      below: null,
      from: 11640,
      floor: 11776,
      bottom: 11640,
    },
    {
      id: "lower",
      label: "Lower",
      below: 11700,
      from: -Infinity,
      floor: 11488,
      bottom: 11380,
    },
  ],
};

/** The levels of a map, top first; empty for a map played on one. */
export function levelsFor(map: string): MapLevel[] {
  return LEVELS[map] ?? [];
}

/** The level someone standing at height `z` is on, or null on a one-level map. */
export function levelAt(map: string, z: number): string | null {
  const levels = levelsFor(map);
  return levels.find((level) => z >= level.from)?.id ?? null;
}
