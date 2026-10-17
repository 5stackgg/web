<script setup lang="ts">
import { computed } from "vue";

// A 30-minute line for a problem row or a service: 1.5px stroke, a 10% wash
// under it, dashed threshold lines. Gaps (nulls) break the line rather than
// being drawn as zero.
const props = withDefaults(
  defineProps<{
    values: Array<number | null>;
    max?: number | null;
    refs?: Array<{ value: number; severity: "critical" | "warning" }>;
    height?: number;
    label?: string;
  }>(),
  { max: 100, refs: () => [], height: 32, label: "" },
);

const W = 120;
const PAD = 2;

const top = computed(() => {
  if (props.max) {
    return props.max;
  }
  const peak = Math.max(
    0,
    ...props.values.filter((v): v is number => v != null),
  );
  return peak > 0 ? peak * 1.15 : 1;
});

const y = (v: number) =>
  PAD +
  (props.height - PAD * 2) * (1 - Math.min(1, Math.max(0, v / top.value)));

const paths = computed(() => {
  const n = props.values.length;
  if (n < 2) {
    return { line: "", area: "" };
  }
  const x = (i: number) => (i / (n - 1)) * W;
  let line = "";
  let area = "";
  let run: Array<[number, number]> = [];
  const flush = () => {
    if (run.length > 1) {
      const d = run
        .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
        .join("L");
      line += `M${d}`;
      area += `M${d}L${run[run.length - 1][0].toFixed(1)},${props.height}L${run[0][0].toFixed(1)},${props.height}Z`;
    }
    run = [];
  };
  props.values.forEach((v, i) => {
    if (v == null) {
      flush();
      return;
    }
    run.push([x(i), y(v)]);
  });
  flush();
  return { line, area };
});

const refLines = computed(() =>
  props.refs
    .filter((ref) => ref.value < top.value)
    .map((ref) => ({ ...ref, y: y(ref.value) })),
);
</script>

<template>
  <svg
    :viewBox="`0 0 ${W} ${height}`"
    preserveAspectRatio="none"
    class="block w-full overflow-visible"
    :style="{ height: `${height}px` }"
    role="img"
    :aria-label="label"
  >
    <line
      v-for="ref in refLines"
      :key="ref.value"
      x1="0"
      :x2="W"
      :y1="ref.y"
      :y2="ref.y"
      stroke-dasharray="3 3"
      vector-effect="non-scaling-stroke"
      :class="
        ref.severity === 'critical'
          ? 'stroke-destructive/60'
          : 'stroke-[hsl(var(--tac-amber)/0.6)]'
      "
    />
    <path :d="paths.area" class="fill-[#3987e5]/10" />
    <path
      :d="paths.line"
      fill="none"
      stroke="#3987e5"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
