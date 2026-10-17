<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

import type { DbGridColumn } from "./dbHealth";

// The explorer's one table: every column sorts, numbers align right and use
// tabular figures, the header stays put while the body scrolls.

const props = withDefaults(
  defineProps<{
    rows: any[];
    columns: DbGridColumn[];
    rowKey: (row: any) => string;
    clickable?: boolean;
    rowClass?: (row: any) => string;
    maxHeight?: number;
    // A live list whose row count swings between polls keeps the tallest
    // height it has reached, so the sections below don't jump when it shrinks.
    holdHeight?: boolean;
  }>(),
  { clickable: false, maxHeight: 0, holdHeight: false },
);

const emit = defineEmits<{ (e: "row-click", row: any): void }>();

const sort = defineModel<string>("sort", { default: "" });
const dir = defineModel<"asc" | "desc">("dir", { default: "desc" });

// With a wrapping column, every other column fits its content and the wrapping
// one takes the rest. Left to auto layout, the spare width is shared out by
// content length, so each poll's new query text moves every column.
const fitColumns = computed(() => props.columns.some((c) => c.wrap));

const valueOf = (col: DbGridColumn | undefined, row: any) =>
  col ? (col.value ? col.value(row) : row[col.key]) : null;

const sorted = computed(() => {
  const col = props.columns.find((c) => c.key === sort.value);
  if (!col) return props.rows;
  const sign = dir.value === "asc" ? 1 : -1;
  return [...props.rows].sort((a, b) => {
    const va = valueOf(col, a);
    const vb = valueOf(col, b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string" || typeof vb === "string") {
      return String(va).localeCompare(String(vb)) * sign;
    }
    return (va > vb ? 1 : va < vb ? -1 : 0) * sign;
  });
});

function toggle(col: DbGridColumn) {
  if (col.sortable === false) return;
  if (sort.value === col.key) {
    dir.value = dir.value === "asc" ? "desc" : "asc";
    return;
  }
  sort.value = col.key;
  dir.value = col.num ? "desc" : "asc";
}

function onRowClick(event: MouseEvent, row: any) {
  if (!props.clickable) return;
  if ((event.target as HTMLElement).closest("button, a, input")) return;
  emit("row-click", row);
}

const tableRef = ref<HTMLTableElement | null>(null);
const heldHeight = ref(0);
let observer: ResizeObserver | null = null;

onMounted(() => {
  if (!props.holdHeight || !tableRef.value) return;
  observer = new ResizeObserver(() => {
    // +2 for the wrapper's top and bottom border.
    const height = (tableRef.value?.offsetHeight || 0) + 2;
    if (height > heldHeight.value) heldHeight.value = height;
  });
  observer.observe(tableRef.value);
});
onBeforeUnmount(() => observer?.disconnect());

function ariaSort(col: DbGridColumn) {
  if (col.sortable === false) return undefined;
  if (sort.value !== col.key) return "none";
  return dir.value === "asc" ? "ascending" : "descending";
}
</script>

<template>
  <div
    class="db-grid overflow-auto rounded-[10px] border border-border"
    :style="{
      maxHeight: maxHeight ? `${maxHeight}px` : undefined,
      minHeight: heldHeight
        ? `${maxHeight ? Math.min(heldHeight, maxHeight) : heldHeight}px`
        : undefined,
    }"
  >
    <table ref="tableRef" class="w-full border-collapse text-[12.5px]">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :class="[
              col.num ? 'text-right' : 'text-left',
              fitColumns && !col.wrap && 'is-fit',
              col.sortable !== false && 'is-sortable',
              sort === col.key && 'is-sorted',
            ]"
            :style="
              col.minWidth ? { minWidth: `${col.minWidth}px` } : undefined
            "
            :aria-sort="ariaSort(col)"
            @click="toggle(col)"
          >
            <span :class="col.srOnly ? 'sr-only' : ''">
              <FiveStackToolTip
                v-if="col.tip"
                as-child
                side="bottom"
                :delay-duration="120"
              >
                <template #trigger>
                  <span
                    class="cursor-help underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px]"
                    >{{ col.label }}</span
                  >
                </template>
                <span class="block max-w-[240px] text-xs leading-snug">{{
                  col.tip
                }}</span>
              </FiveStackToolTip>
              <template v-else>{{ col.label }}</template>
            </span>
            <span
              v-if="sort === col.key"
              aria-hidden="true"
              class="ml-1 text-[10px] text-[hsl(var(--tac-amber))]"
              >{{ dir === "asc" ? "▲" : "▼" }}</span
            >
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in sorted"
          :key="rowKey(row)"
          :class="[clickable && 'is-clickable', rowClass ? rowClass(row) : '']"
          :tabindex="clickable ? 0 : undefined"
          @click="onRowClick($event, row)"
          @keydown.enter="clickable && emit('row-click', row)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            :class="[
              col.num ? 'text-right' : '',
              col.wrap ? 'is-wrap' : fitColumns && 'is-fit',
            ]"
          >
            <slot :name="`cell-${col.key}`" :row="row">{{
              valueOf(col, row) ?? ""
            }}</slot>
          </td>
        </tr>
        <tr v-if="!sorted.length && $slots.empty">
          <td :colspan="columns.length" class="is-empty">
            <slot name="empty" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.db-grid {
  background: hsl(240 6% 5.5%);
  scrollbar-width: thin;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 10px;
  background: hsl(240 6% 5.5%);
  box-shadow: inset 0 -1px 0 hsl(var(--border));
  font-size: 11.5px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  transition: color 150ms ease;
}
th.is-sortable {
  cursor: pointer;
  user-select: none;
}
th.is-sortable:hover,
th.is-sorted {
  color: hsl(var(--foreground));
}
td {
  padding: 7px 10px;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
}
td.is-wrap {
  white-space: normal;
}
td.is-empty {
  padding: 14px 10px;
  border-bottom: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
.is-fit {
  width: 1px;
}
tbody tr:last-child td {
  border-bottom: 0;
}
tr.is-clickable {
  cursor: pointer;
  transition: background-color 120ms ease;
}
tr.is-clickable:hover {
  background: hsl(240 4% 9%);
}
tr.is-clickable:focus-visible {
  outline: 2px solid hsl(var(--tac-amber) / 0.5);
  outline-offset: -2px;
}
tr.is-hot td {
  background: hsl(36 100% 50% / 0.045);
}
tr.is-wait td {
  background: hsl(0 82% 62% / 0.05);
}
</style>
