<script setup lang="ts">
import type { TooltipProviderProps } from "reka-ui"
import { TooltipProvider } from "reka-ui"

// App-wide defaults: 500ms so buttons aren't twitchy, skip-delay for instant
// chaining between adjacent triggers, and close-on-leave to avoid stuck tooltips.
const props = withDefaults(defineProps<TooltipProviderProps>(), {
  delayDuration: 500,
  skipDelayDuration: 300,
  disableHoverableContent: true,
})
</script>

<template>
  <TooltipProvider v-bind="props">
    <slot />
  </TooltipProvider>
</template>
