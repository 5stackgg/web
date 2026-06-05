<script setup lang="ts">
// Matched-height placeholder for a sortable stats table (header + rows).
// Reserves the real table's vertical space so data swapping in (via FadeSwap)
// doesn't reflow the page.
import { Skeleton } from "~/components/ui/skeleton";

withDefaults(defineProps<{ rows?: number; cols?: number }>(), {
  rows: 8,
  cols: 5,
});
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border/60 bg-card/40">
    <Skeleton class="h-10 w-full rounded-none" />
    <div
      v-for="r in rows"
      :key="r"
      class="flex items-center gap-3 border-t border-border/50 px-4 py-3"
    >
      <Skeleton class="h-3.5 w-32" />
      <div class="ml-auto flex gap-6">
        <Skeleton v-for="c in cols - 1" :key="c" class="h-3.5 w-10" />
      </div>
    </div>
  </div>
</template>
