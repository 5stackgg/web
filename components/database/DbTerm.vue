<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

// A cryptic metric name: dotted underline, the meaning on hover.
defineProps<{ tip: string; side?: string }>();
</script>

<template>
  <FiveStackToolTip as-child :side="side || 'top'" :delay-duration="120">
    <template #trigger>
      <span
        class="cursor-help underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px] transition-colors hover:decoration-foreground"
        ><slot
      /></span>
    </template>
    <span class="block max-w-[240px] text-xs leading-snug">{{ tip }}</span>
  </FiveStackToolTip>
</template>
