<script setup lang="ts">
import { computed } from "vue";

// A fill bar that glides (scaleX) when its value moves. Notches mark
// thresholds on the track, for the disk. With a metric, the fill takes that
// metric's chart colour and only critical overrides it, in red.
const props = withDefaults(
  defineProps<{
    value: number | null | undefined;
    tone?: "ok" | "warn" | "bad" | "info" | "amber";
    metric?: "cpu" | "mem" | "disk" | "gpu";
    thin?: boolean;
    notches?: Array<number>;
  }>(),
  { tone: "ok", thin: false, notches: () => [] },
);

const scale = computed(() =>
  Math.min(1, Math.max(0, (props.value ?? 0) / 100)).toFixed(3),
);
</script>

<template>
  <span class="gsn-meter" :data-thin="thin" aria-hidden="true">
    <i
      class="gsn-meter-fill"
      :data-tone="tone"
      :data-metric="metric"
      :style="{ transform: `scaleX(${scale})` }"
    />
    <i
      v-for="notch of notches"
      :key="notch"
      class="gsn-meter-notch"
      :style="{ left: `${notch}%` }"
    />
  </span>
</template>

<style scoped>
.gsn-meter {
  position: relative;
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: hsl(240 4% 14%);
}
.gsn-meter[data-thin="true"] {
  height: 4px;
}
.gsn-meter-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: hsl(var(--success));
  transform-origin: left;
  transition:
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 300ms ease;
}
.gsn-meter-fill[data-tone="warn"] {
  background: hsl(var(--warning));
}
.gsn-meter-fill[data-tone="amber"] {
  background: hsl(var(--tac-amber));
}
.gsn-meter-fill[data-tone="bad"] {
  background: hsl(var(--destructive));
}
.gsn-meter-fill[data-tone="info"] {
  background: hsl(var(--info));
}
.gsn-meter-fill[data-metric="cpu"] {
  background: hsl(var(--tac-amber));
}
.gsn-meter-fill[data-metric="mem"] {
  background: hsl(var(--tac-blue));
}
.gsn-meter-fill[data-metric="disk"] {
  background: hsl(265 70% 75%);
}
.gsn-meter-fill[data-metric="gpu"] {
  background: hsl(330 75% 70%);
}
.gsn-meter-fill[data-metric][data-tone="bad"] {
  background: hsl(var(--destructive));
}
.gsn-meter-notch {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: hsl(240 6% 7%);
}
@media (prefers-reduced-motion: reduce) {
  .gsn-meter-fill {
    transition: none;
  }
}
</style>
