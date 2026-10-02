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
  <div class="rounded-lg border border-border/60 bg-card/40 p-4">
    <Skeleton class="h-10 w-full rounded-none" />
    <div
      v-for="r in rows"
      :key="r"
      class="flex items-center gap-3 border-t border-border/50 px-3 py-4"
    >
      <Skeleton class="h-4 w-32" />
      <div class="ml-auto flex gap-6">
        <Skeleton v-for="c in cols - 1" :key="c" class="h-4 w-10" />
      </div>
    </div>
  </div>
</template>
