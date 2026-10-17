import { ref, type Ref } from "vue";

export type SortDir = "asc" | "desc";
export type SortState<K extends string = string> = { key: K; dir: SortDir };
export type AriaSort = "ascending" | "descending" | "none";

/**
 * Clicking the sorted column flips it; clicking another column switches to it
 * in that column's natural direction (numbers and dates usually start largest
 * first, names A to Z), or ascending when it has none.
 */
export function nextSort<K extends string>(
  current: SortState<K>,
  key: K,
  naturalDirs: Partial<Record<K, SortDir>> = {},
): SortState<K> {
  if (current.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key, dir: naturalDirs[key] ?? "asc" };
}

/** The header's aria-sort: sorted when any of its keys is the active one. */
export function ariaSortFor(
  current: { key: string | null | undefined; dir: SortDir },
  keys: string | readonly string[],
): AriaSort {
  const list = typeof keys === "string" ? [keys] : keys;
  if (!current.key || !list.includes(current.key)) {
    return "none";
  }
  return current.dir === "asc" ? "ascending" : "descending";
}

/**
 * Sort state for a table:
 *   const sort = useSort("name", "asc", { players: "desc" });
 *   <SortHeader sort-key="players" :active="sort.key.value" :dir="sort.dir.value" @sort="sort.toggle" />
 */
export function useSort<K extends string>(
  defaultKey: K,
  defaultDir: SortDir = "asc",
  naturalDirs: Partial<Record<K, SortDir>> = {},
) {
  const key = ref(defaultKey) as Ref<K>;
  const dir = ref<SortDir>(defaultDir);

  function toggle(next: K) {
    const state = nextSort(
      { key: key.value, dir: dir.value },
      next,
      naturalDirs,
    );
    key.value = state.key;
    dir.value = state.dir;
  }

  return {
    key,
    dir,
    toggle,
    ariaSort: (keys: K | readonly K[]) =>
      ariaSortFor({ key: key.value, dir: dir.value }, keys),
    /** 1 ascending, -1 descending: multiply a comparator by it. */
    sign: () => (dir.value === "asc" ? 1 : -1),
  };
}
