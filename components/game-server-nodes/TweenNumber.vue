<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { prefersReducedMotion } from "~/components/game-server-nodes/nodeFormat";

// A live number that glides to its next value instead of jumping. The first
// value shows as is; reduced motion skips the glide.
const props = withDefaults(
  defineProps<{
    value: number | null | undefined;
    decimals?: number;
    suffix?: string;
  }>(),
  { decimals: 0, suffix: "" },
);

const shown = ref<number | null>(props.value ?? null);
let frame = 0;

const ease = (x: number) => 1 - Math.pow(1 - x, 4);

watch(
  () => props.value,
  (to) => {
    cancelAnimationFrame(frame);
    const from = shown.value;
    if (to == null || from == null || prefersReducedMotion()) {
      shown.value = to ?? null;
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 500);
      shown.value = from + (to - from) * ease(progress);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
  },
);

onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <span class="tabular-nums">{{
    shown == null ? "—" : `${shown.toFixed(decimals)}${suffix}`
  }}</span>
</template>
