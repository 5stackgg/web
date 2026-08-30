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
import { computed } from "vue";
import { Skeleton } from "~/components/ui/skeleton";

// Class and pixel height together, because `fill` has to reason about the
// height in numbers and a second copy of it drifts.
const SHAPES = {
  card: { class: "h-[9.25rem]", px: 148 },
  row: { class: "h-[3.6rem]", px: 57.6 },
  block: { class: "h-20", px: 80 },
} as const;

// gap-2
const GAP_PX = 8;

const props = withDefaults(
  defineProps<{
    count?: number;
    shape?: keyof typeof SHAPES;
    /**
     * Stand in for content this tall, in px, instead of `count` rows.
     *
     * For a panel that is *replacing* something rather than filling for the
     * first time -- a map switch. A fixed three-card placeholder over a column
     * that held one row grows the page 300px and then drops it again the
     * moment the answer lands, which is two movements to watch for one click.
     * Matching the height that is already there makes the swap into the
     * placeholder invisible and leaves exactly one move: the real answer.
     */
    fill?: number | null;
  }>(),
  { count: 3, shape: "card", fill: null },
);

const rows = computed(() => {
  if (!props.fill) {
    return props.count;
  }
  const step = SHAPES[props.shape].px + GAP_PX;
  return Math.max(1, Math.min(8, Math.round((props.fill + GAP_PX) / step)));
});
</script>

<template>
  <div
    class="flex flex-col gap-2"
    :style="fill ? { minHeight: `${fill}px` } : undefined"
  >
    <Skeleton
      v-for="i in rows"
      :key="i"
      class="w-full rounded-md bg-primary/[0.07]"
      :class="SHAPES[shape].class"
    />
  </div>
</template>
