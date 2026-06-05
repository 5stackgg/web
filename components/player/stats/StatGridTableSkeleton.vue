<script setup lang="ts">
// Matched-height placeholder for the "summary stat cards + sortable table"
// layout the career panels share. Reserves the real content's vertical space
// so data swapping in (via FadeSwap) doesn't reflow the page.
import { Skeleton } from "~/components/ui/skeleton";

withDefaults(
  defineProps<{ cards?: number; rows?: number; cols?: number }>(),
  { cards: 4, rows: 6, cols: 5 },
);
</script>

<template>
  <div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Skeleton v-for="i in cards" :key="i" class="h-[6.5rem] rounded-lg" />
    </div>
    <div
      class="mt-6 overflow-hidden rounded-lg border border-border/60 bg-card/40"
    >
      <Skeleton class="h-10 w-full rounded-none" />
      <div
        v-for="r in rows"
        :key="r"
        class="flex items-center gap-3 border-t border-border/50 px-4 py-3"
      >
        <Skeleton class="h-3 w-28" />
        <div class="ml-auto flex gap-3">
          <Skeleton v-for="c in cols - 1" :key="c" class="h-3 w-10" />
        </div>
      </div>
    </div>
  </div>
</template>
