export type FacetOption = {
  value: string;
  label: string;
  /** Live count of rows this value would add; drawn only in counts mode. */
  count?: number;
  /** Without counts: picking this value would return nothing. */
  empty?: boolean;
  mono?: boolean;
  /** Small trailing word, e.g. "node". */
  tag?: string;
  /** Colour square before the label, e.g. an award tier. */
  swatch?: string;
};

export type FacetGroup = {
  key: string;
  label: string;
  options: FacetOption[];
  /** Show this many values until "Show all" is pressed (selected ones always show). */
  limit?: number;
};

export type FacetSelection = Record<string, string[]>;

export type FacetChip = { key: string; value: string; label: string };

export function sameValues(
  a: readonly string[] = [],
  b: readonly string[] = [],
): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

export function isFacetDefault(
  selection: FacetSelection,
  defaults: FacetSelection | undefined,
  key: string,
): boolean {
  return sameValues(selection[key] ?? [], defaults?.[key] ?? []);
}

export function toggleFacet(
  selection: FacetSelection,
  key: string,
  value: string,
): FacetSelection {
  const current = selection[key] ?? [];
  return {
    ...selection,
    [key]: current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value],
  };
}

export function resetFacets(
  keys: readonly string[],
  defaults: FacetSelection | undefined,
  selection: FacetSelection = {},
): FacetSelection {
  const next = { ...selection };
  for (const key of keys) {
    next[key] = [...(defaults?.[key] ?? [])];
  }
  return next;
}

/** Groups that differ from their default. */
export function activeFacetCount(
  groups: readonly FacetGroup[],
  selection: FacetSelection,
  defaults?: FacetSelection,
): number {
  return groups.filter(
    (group) => !isFacetDefault(selection, defaults, group.key),
  ).length;
}

/**
 * One chip per value the reader chose. A group that starts with values picked
 * (servers hide disabled ones) only chips what was added to it, so an untouched
 * default never shows up as five chips.
 */
export function facetChips(
  groups: readonly FacetGroup[],
  selection: FacetSelection,
  defaults?: FacetSelection,
): FacetChip[] {
  const chips: FacetChip[] = [];
  for (const group of groups) {
    const picked = selection[group.key] ?? [];
    const base = defaults?.[group.key] ?? [];
    if (sameValues(picked, base)) {
      continue;
    }
    const values =
      base.length && base.every((value) => picked.includes(value))
        ? picked.filter((value) => !base.includes(value))
        : picked;
    for (const value of values) {
      const option = group.options.find((entry) => entry.value === value);
      chips.push({ key: group.key, value, label: option?.label ?? value });
    }
  }
  return chips;
}

export type FacetValues<T> = (item: T, key: string) => string | string[];

const asList = (value: string | string[]) =>
  Array.isArray(value) ? value : [value];

/** OR inside a group, AND across groups; an empty group filters nothing. */
export function matchesFacets<T>(
  item: T,
  selection: FacetSelection,
  values: FacetValues<T>,
  except?: string,
): boolean {
  for (const key of Object.keys(selection)) {
    if (key === except) {
      continue;
    }
    const picked = selection[key];
    if (!picked?.length) {
      continue;
    }
    if (!asList(values(item, key)).some((value) => picked.includes(value))) {
      return false;
    }
  }
  return true;
}

/**
 * Rows that would carry `value` with every other group (and `extra`, the
 * search or a kind filter) applied. Zero means picking it returns nothing.
 */
export function facetHits<T>(
  items: readonly T[],
  key: string,
  value: string,
  selection: FacetSelection,
  values: FacetValues<T>,
  extra?: (item: T) => boolean,
): number {
  let hits = 0;
  for (const item of items) {
    if (
      asList(values(item, key)).includes(value) &&
      (!extra || extra(item)) &&
      matchesFacets(item, selection, values, key)
    ) {
      hits++;
    }
  }
  return hits;
}
