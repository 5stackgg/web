<script setup lang="ts">
import { Newspaper } from "lucide-vue-next";

/**
 * A post's cover. Covers are 16:9 posters that carry their own title type, so
 * they are always shown whole: never cropped, never under other text. A card
 * that wants the hover zoom puts `group/news` on itself.
 */
withDefaults(
  defineProps<{
    src?: string | null;
    alt?: string;
    eager?: boolean;
    rounded?: boolean;
  }>(),
  { src: null, alt: "", eager: false, rounded: true },
);
</script>

<template>
  <span
    class="relative block aspect-video w-full overflow-hidden bg-[hsl(240_10%_2%)] shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.07)]"
    :class="rounded && 'rounded-lg'"
  >
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      referrerpolicy="no-referrer"
      width="1280"
      height="720"
      class="absolute inset-0 h-full w-full object-contain transition-transform [transition-duration:600ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover/news:scale-[1.03] motion-reduce:transition-none"
    />
    <span
      v-else
      class="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_120%_at_20%_0%,hsl(var(--tac-amber)/0.14),transparent_60%)]"
    >
      <Newspaper class="h-8 w-8 text-muted-foreground/40" />
    </span>
  </span>
</template>
