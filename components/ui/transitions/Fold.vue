<script setup lang="ts">
// A conditional section that folds its height open and shut in place --
// the app's grid-rows 0fr <-> 1fr idiom packaged for the common form case
// where a toggle or select reveals sub-fields.
//
// The grid cell is deliberately bare: padding, margin or border on it would
// floor the collapse and snap away on unmount. Keep the revealed content's
// own spacing (mt-4, pl-4, border-l-2, ...) on the slotted element -- it
// rides inside the clip and folds with it. A margin-top applied from outside
// by a space-y parent is animated away too.
defineProps<{ open: boolean }>();
</script>

<template>
  <Transition
    enter-active-class="fold-anim"
    enter-from-class="fold-collapsed"
    leave-active-class="fold-anim"
    leave-to-class="fold-collapsed"
  >
    <div v-if="open" class="grid grid-rows-[1fr]">
      <div class="min-h-0 fold-cell">
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fold-anim {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}
/* Clipped only while animating: left on, it would cut focus rings and
   shadows off the revealed fields at rest. */
.fold-anim > .fold-cell {
  overflow: hidden;
}
/* !important: Tailwind's space-y selector outspecifies a scoped class. */
.fold-collapsed {
  grid-template-rows: 0fr;
  margin-top: 0 !important;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .fold-anim {
    transition-duration: 1ms;
  }
}
</style>
