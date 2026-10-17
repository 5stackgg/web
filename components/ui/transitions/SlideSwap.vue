<script setup lang="ts">
import { ref, watch } from "vue";

// Pans between sibling views the way the tab strip above them moved: picking a
// tab to the right slides the old view out to the left and brings the new one
// in from the right, and the other way round going back. Both views move as
// one strip on the tab indicator's clock (AnimatedFilters' 240ms glide), and
// only transform runs, so the pan keeps its rate while the new view mounts.
//
// The slot renders one keyed element per view (v-if / v-else with :key). The
// container takes the taller view's height while both are on screen; wrap it
// in HeightGlide where the views differ a lot in height.
const props = defineProps<{
  // The active view's position in its tab order.
  index: number;
}>();

const direction = ref<"next" | "prev">("next");

// Pre-flush, so the transition renders with the direction of this change.
watch(
  () => props.index,
  (next, previous) => {
    direction.value = next >= previous ? "next" : "prev";
  },
  { flush: "pre" },
);
</script>

<template>
  <div class="slide-swap">
    <Transition :name="`slide-swap-${direction}`">
      <slot />
    </Transition>
  </div>
</template>

<style>
.slide-swap {
  display: grid;
  /* clip, not hidden: hidden makes this a scroll container and steals the
     parent's vertical scroll. */
  overflow-x: clip;
}
.slide-swap > * {
  grid-area: 1 / 1;
  min-width: 0;
}
.slide-swap-next-enter-active,
.slide-swap-next-leave-active,
.slide-swap-prev-enter-active,
.slide-swap-prev-leave-active {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-swap-next-leave-active,
.slide-swap-prev-leave-active {
  pointer-events: none;
}
.slide-swap-next-enter-from,
.slide-swap-prev-leave-to {
  transform: translateX(100%);
}
.slide-swap-next-leave-to,
.slide-swap-prev-enter-from {
  transform: translateX(-100%);
}
@media (prefers-reduced-motion: reduce) {
  .slide-swap-next-enter-active,
  .slide-swap-next-leave-active,
  .slide-swap-prev-enter-active,
  .slide-swap-prev-leave-active {
    transition: none;
  }
}
</style>
