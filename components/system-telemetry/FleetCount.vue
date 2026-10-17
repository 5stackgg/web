<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

// A fleet count that glides to its next value (the minute poll, or the fleet
// toggle) instead of snapping, so the eye can follow what moved. Grouped
// digits, unlike TweenNumber: these run into the millions.
const props = defineProps<{ value: number | null | undefined }>();

const shown = ref(props.value ?? 0);
let frame = 0;

watch(
  () => props.value,
  (next) => {
    cancelAnimationFrame(frame);
    const to = next ?? 0;
    const from = shown.value;
    if (
      from === to ||
      document.hidden ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      shown.value = to;
      return;
    }
    const start = performance.now();
    const step = () => {
      const p = Math.min(1, Math.max(0, (performance.now() - start) / 600));
      const eased = 1 - Math.pow(1 - p, 3);
      shown.value = Math.round(from + (to - from) * eased);
      if (p < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
  },
);

onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <span>{{ shown.toLocaleString() }}</span>
</template>
