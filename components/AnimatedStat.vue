<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  value: string | number | null | undefined;
}>();

// Split into characters so each digit flips on its own (split-flap board).
// Only characters that actually change re-key, so unchanged digits stay put;
// all changed digits flip together (no left-to-right cascade) — like an old
// flip clock rolling to the next value.
const chars = computed(() => {
  const s =
    props.value === null || props.value === undefined
      ? ""
      : String(props.value);
  return [...s];
});
</script>

<template>
  <span class="flip-stat">
    <span
      v-for="(ch, i) in chars"
      :key="i + '|' + ch"
      class="flip-stat__char"
      >{{ ch === " " ? " " : ch }}</span
    >
  </span>
</template>

<style scoped>
.flip-stat {
  display: inline-flex;
  perspective: 360px;
  white-space: pre;
}

/* Hinges at the top edge so the leaf falls in from the top and settles flat —
   a split-flap / stock-ticker flip. */
/* No `will-change` here on purpose: these pages mount 100+ AnimatedStats, and a
   permanent hint would pin a compositor layer per character at idle. The flip is
   a one-shot transform/opacity animation, which the compositor promotes on its
   own while it runs — so the hint costs memory without buying smoothness. */
.flip-stat__char {
  display: inline-block;
  transform-origin: top center;
  backface-visibility: hidden;
  animation: flip-char 440ms cubic-bezier(0.2, 0.78, 0.32, 1) both;
}

@keyframes flip-char {
  0% {
    transform: rotateX(-90deg);
    opacity: 0;
  }
  55% {
    transform: rotateX(0deg);
    opacity: 1;
  }
  100% {
    transform: rotateX(0deg);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flip-stat__char {
    animation: none;
  }
}
</style>
