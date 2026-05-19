import { ref } from "vue";

type SortDir = "asc" | "desc";

export function useTableSort<TKey extends string = string>(
  defaultKey: TKey | null = null,
  defaultDir: SortDir = "desc",
) {
  const sortKey = ref<TKey | null>(defaultKey);
  const sortDir = ref<SortDir>(defaultDir);

  function toggle(key: TKey) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
    } else {
      sortKey.value = key;
      sortDir.value = "desc";
    }
  }

  function sortRows<T>(
    rows: T[],
    getters: Partial<Record<TKey, (row: T) => unknown>>,
  ): T[] {
    const key = sortKey.value;
    if (!key) return rows;
    const getter = getters[key];
    if (!getter) return rows;
    const dir = sortDir.value === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  return { sortKey, sortDir, toggle, sortRows };
}
