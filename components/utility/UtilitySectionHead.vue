<script setup lang="ts">
// A heading over a run of rows that is not a utility type: "On Mirage",
// "Lineups for this spot", "Steps". Set like the type headings, minus the
// swatch and the filter.
defineProps<{
  label: string;
  count?: number | string | null;
}>();
</script>

<template>
  <div class="flex h-8 items-center gap-2 px-1">
    <span
      class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-foreground"
    >
      {{ label }}
    </span>
    <span
      v-if="count !== null && count !== undefined"
      class="font-mono text-[0.66rem] tabular-nums text-muted-foreground"
    >
      {{ count }}
    </span>
    <span aria-hidden="true" class="h-px flex-1 bg-border" />
    <slot />
  </div>
</template>
