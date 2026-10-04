<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// Lays a one-row stat table out as a vertical label/value list for narrow
// screens: header cells fill the first grid column, the row's cells the
// second, paired by position. The table inside is the real one — same cells,
// same tooltips — so the list can't drift from the table it mirrors.
const root = ref<HTMLElement | null>(null);
const rows = ref(0);
let observer: MutationObserver | null = null;

function measure() {
  rows.value =
    root.value?.querySelectorAll("thead tr:last-child > th").length ?? 0;
}

onMounted(() => {
  measure();
  observer = new MutationObserver(measure);
  if (root.value) {
    observer.observe(root.value, { childList: true, subtree: true });
  }
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="root" class="stacked-table" :style="{ '--stacked-rows': rows }">
    <slot />
  </div>
</template>

<style scoped>
.stacked-table :deep(table) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: repeat(var(--stacked-rows, 1), auto);
  grid-auto-flow: column;
  width: 100%;
  min-width: 0;
}
.stacked-table :deep(:is(thead, tbody, tr)) {
  display: contents;
}
.stacked-table :deep(thead tr:not(:last-child)) {
  display: none;
}
.stacked-table :deep(:is(th, td)) {
  display: flex;
  align-items: center;
  height: auto;
  min-height: 2rem;
  padding: 0.25rem 0.75rem;
  border-top: 1px solid hsl(var(--border) / 0.4);
  background: transparent;
  white-space: nowrap;
}
.stacked-table :deep(:is(th, td):nth-child(1)) {
  border-top-color: transparent;
}
.stacked-table :deep(th) {
  font-weight: 400;
  text-align: left;
}
.stacked-table :deep(td) {
  justify-content: flex-end;
  text-align: right;
}
.stacked-table :deep([data-sort-icons]) {
  display: none;
}
</style>
