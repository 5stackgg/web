<script setup lang="ts">
import { computed } from "vue";
import {
  lineSegments,
  type StatPoint,
} from "~/components/game-server-nodes/nodeMetrics";

// A live tile's sparkline over a time window. Missing samples break the line.
// Optional marks draw dashed threshold lines (System Metrics' problem rows).
const props = withDefaults(
  defineProps<{
    points: Array<StatPoint>;
    from: number;
    to: number;
    max?: number;
    tone?: "cpu" | "mem" | "net" | "gpu" | "disk";
    marks?: Array<{ value: number; tone: "warn" | "bad" }>;
  }>(),
  { max: 100, tone: "cpu", marks: () => [] },
);

const H = 30;
const W = 200;

const paths = computed(() => {
  const span = Math.max(1, props.to - props.from);
  const top = Math.max(props.max, 1);
  const x = (t: number) => ((t - props.from) / span) * W;
  const y = (v: number) => H - 1 - (Math.min(v, top) / top) * (H - 2);
  return lineSegments(props.points).map((run) => {
    const points = run.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
    if (points.length === 1) {
      points.push(`${(x(run[0].t) + 2).toFixed(1)},${y(run[0].v).toFixed(1)}`);
    }
    const first = x(run[0].t).toFixed(1);
    const last = x(run[run.length - 1].t).toFixed(1);
    return {
      line: `M${points.join("L")}`,
      area: `M${first},${H}L${points.join("L")}L${points.length > 1 ? last : first},${H}Z`,
    };
  });
});

const markLines = computed(() => {
  const top = Math.max(props.max, 1);
  return props.marks
    .filter((mark) => mark.value < top)
    .map((mark) => ({
      ...mark,
      y: (H - 1 - (mark.value / top) * (H - 2)).toFixed(1),
    }));
});
</script>

<template>
  <svg
    class="gsn-spark block h-[30px] w-full"
    :data-tone="tone"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <line
      v-for="mark of markLines"
      :key="mark.value"
      class="gsn-spark-mark"
      :data-mark="mark.tone"
      x1="0"
      :x2="W"
      :y1="mark.y"
      :y2="mark.y"
      stroke-dasharray="3 3"
      vector-effect="non-scaling-stroke"
    />
    <template v-for="(path, index) of paths" :key="index">
      <path class="gsn-spark-area" :d="path.area" />
      <path
        class="gsn-spark-line"
        :d="path.line"
        vector-effect="non-scaling-stroke"
      />
    </template>
  </svg>
</template>

<style scoped>
.gsn-spark {
  --tone: var(--tac-amber);
}
.gsn-spark[data-tone="mem"] {
  --tone: var(--tac-blue);
}
.gsn-spark[data-tone="net"] {
  --tone: var(--success);
}
.gsn-spark[data-tone="gpu"] {
  --tone: 330 75% 70%;
}
.gsn-spark[data-tone="disk"] {
  --tone: 265 70% 75%;
}
.gsn-spark-mark {
  stroke: hsl(var(--tac-amber) / 0.55);
  stroke-width: 1;
}
.gsn-spark-mark[data-mark="bad"] {
  stroke: hsl(var(--destructive) / 0.55);
}
.gsn-spark-line {
  fill: none;
  stroke: hsl(var(--tone));
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.gsn-spark-area {
  fill: hsl(var(--tone) / 0.12);
}
</style>
