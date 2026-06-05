<script setup lang="ts">
// Crossfades between mutually-exclusive states (loading skeleton ↔ empty ↔
// content) with NO vertical motion. The leaving node is pulled out of flow
// (absolute) so the entering node owns the container height from frame one —
// pair with matched-height skeletons and the load reads as a clean dissolve
// instead of a jump. Each branch in the slot must carry a stable :key.
</script>

<template>
  <div class="relative">
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out motion-reduce:!duration-0"
      leave-active-class="absolute inset-0 w-full transition-opacity duration-200 ease-in motion-reduce:!duration-0"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <slot />
    </Transition>
  </div>
</template>
