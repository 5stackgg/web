import type { InjectionKey, ComputedRef } from "vue";

// Provided by SortableTableHead, injected by StatLabel — lets a stat label
// know it lives inside a sortable header (and whether that header is active),
// so it can keep the cell tap reserved for sorting on touch devices.
export const SORTABLE_HEADER_KEY: InjectionKey<ComputedRef<boolean>> =
  Symbol("sortableHeader");
