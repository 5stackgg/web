<script setup lang="ts">
/**
 * The placeholder every utility panel uses while it is genuinely waiting.
 *
 * One block per row, sized to what actually lands there, rather than a card
 * built out of five little bars: a card of bars is five things pulsing out of
 * phase in a 400px column, which is the noise this page had too much of. A
 * single shape at the right height says the same thing -- "a row is coming,
 * this tall" -- and the list does not jump when the real row replaces it.
 */
import { Skeleton } from "~/components/ui/skeleton";

const HEIGHTS = {
  card: "h-[9.25rem]",
  row: "h-[3.6rem]",
  block: "h-20",
} as const;

withDefaults(
  defineProps<{
    count?: number;
    shape?: keyof typeof HEIGHTS;
  }>(),
  { count: 3, shape: "card" },
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <Skeleton
      v-for="i in count"
      :key="i"
      class="w-full rounded-md bg-primary/[0.07]"
      :class="HEIGHTS[shape]"
    />
  </div>
</template>
