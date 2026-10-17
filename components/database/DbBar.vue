<script setup lang="ts">
import { computed } from "vue";

// A share bar with its figure beside it. The figure keeps a fixed width so the
// bars line up down a column however long each number is.
const props = defineProps<{ value: number; label?: string }>();
const scale = computed(() =>
  Math.max(0, Math.min(1, Number.isFinite(props.value) ? props.value : 0)),
);
</script>

<template>
  <span class="inline-flex items-center justify-end gap-2 align-middle">
    <span
      aria-hidden="true"
      class="relative inline-block h-1 w-14 shrink-0 overflow-hidden rounded-full bg-[hsl(240_4%_14%)]"
    >
      <i
        class="db-bar-fill absolute inset-0 rounded-full bg-[hsl(var(--tac-amber))]"
        :style="{ transform: `scaleX(${scale})` }"
      />
    </span>
    <span v-if="label != null" class="min-w-[4.5rem] text-right tabular-nums">{{
      label
    }}</span>
  </span>
</template>

<style scoped>
.db-bar-fill {
  transform-origin: left;
  transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .db-bar-fill {
    transition: none;
  }
}
</style>
