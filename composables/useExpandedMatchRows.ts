import { provide, reactive, type InjectionKey } from "vue";

// Which PlayerMatchRows are open, and on what tab/map, owned by the page so it
// can hand them back after a back navigation. Rows outside a provider (the
// right hub) keep their own local state.
export type ExpandedMatchRow = { tab: string; mapId: string | null };
export type ExpandedMatchRows = Record<string, ExpandedMatchRow>;

export const EXPANDED_MATCH_ROWS: InjectionKey<ExpandedMatchRows> =
  Symbol("expandedMatchRows");

export function provideExpandedMatchRows(initial?: ExpandedMatchRows | null) {
  const rows = reactive<ExpandedMatchRows>({ ...initial });
  provide(EXPANDED_MATCH_ROWS, rows);
  return rows;
}
