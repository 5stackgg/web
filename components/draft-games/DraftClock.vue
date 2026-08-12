<script setup lang="ts">
import { computed, toRef } from "vue";
import { useCountdown } from "~/composables/useCountdown";

const props = withDefaults(
  defineProps<{
    deadline?: string;
    total?: number;
    accent?: string;
    pulse?: boolean;
    compact?: boolean;
  }>(),
  {
    total: 30,
    accent: "var(--tac-amber)",
    pulse: false,
    compact: false,
  },
);

const RADIUS = 52;
const CIRC = 2 * Math.PI * RADIUS;

const { remaining, fraction, urgent } = useCountdown(
  toRef(props, "deadline"),
  toRef(props, "total"),
);

const dashOffset = computed(() => CIRC * (1 - fraction.value));
</script>

<template>
  <div
    class="draft-clock relative grid place-items-center"
    :class="{ pulse: pulse }"
    :style="{ '--accent': accent }"
  >
    <svg
      viewBox="0 0 120 120"
      class="-rotate-90"
      :class="compact ? 'h-16 w-16' : 'h-32 w-32'"
    >
      <circle
        cx="60"
        cy="60"
        :r="RADIUS"
        fill="none"
        stroke="hsl(var(--border))"
        stroke-width="4"
      />
      <circle
        v-if="deadline"
        cx="60"
        cy="60"
        :r="RADIUS"
        fill="none"
        :stroke="urgent ? 'hsl(var(--destructive))' : `hsl(${accent})`"
        stroke-width="4"
        stroke-linecap="round"
        :stroke-dasharray="CIRC"
        :stroke-dashoffset="dashOffset"
        :style="{
          filter: `drop-shadow(0 0 6px ${urgent ? 'hsl(var(--destructive) / 0.7)' : `hsl(${accent} / 0.7)`})`,
        }"
      />
    </svg>
    <div class="absolute inset-0 grid place-items-center text-center">
      <div>
        <div
          class="font-mono font-bold tabular-nums leading-none"
          :class="[
            urgent ? 'text-destructive' : 'text-foreground',
            compact ? 'text-base' : 'text-3xl',
          ]"
        >
          <template v-if="deadline">{{ Math.ceil(remaining) }}</template>
          <template v-else>—</template>
        </div>
        <div
          v-if="!compact"
          class="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.28em] text-muted-foreground"
        >
          <slot>SEC</slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draft-clock.pulse::before {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 9999px;
  border: 1px solid hsl(var(--accent) / 0.4);
  animation: clock-pulse 1.6s ease-out infinite;
}
@keyframes clock-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.12);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .draft-clock.pulse::before {
    animation: none;
  }
}
</style>
