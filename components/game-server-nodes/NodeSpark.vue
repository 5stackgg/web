<script setup lang="ts">
import { computed } from "vue";
import {
  lineSegments,
  valueAt,
  type StatPoint,
} from "~/components/game-server-nodes/nodeMetrics";

// A live tile's sparkline over a time window. Missing samples break the line.
// Optional marks draw dashed threshold lines (System Metrics' problem rows);
// `ceiling` draws the max itself, so the line's height reads as how full it
// is. Given a `crosshair` time (null included) it follows the pointer, emits
// the time under it, and draws the crosshair and that moment's sample; the
// parent picks the time so several sparks share one.
const props = withDefaults(
  defineProps<{
    points: Array<StatPoint>;
    from: number;
    to: number;
    max?: number;
    tone?: "cpu" | "mem" | "net" | "gpu" | "disk";
    marks?: Array<{ value: number; tone: "warn" | "bad" }>;
    ceiling?: boolean;
    crosshair?: number | null;
  }>(),
  { max: 100, tone: "cpu", marks: () => [], ceiling: false },
);

const emit = defineEmits<{ hover: [t: number | null] }>();

const H = 30;
const W = 200;

const span = computed(() => Math.max(1, props.to - props.from));
const top = computed(() => Math.max(props.max, 1));
const x = (t: number) => ((t - props.from) / span.value) * W;
const y = (v: number) => H - 1 - (Math.min(v, top.value) / top.value) * (H - 2);

const paths = computed(() =>
  lineSegments(props.points).map((run) => {
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
  }),
);

const markLines = computed(() =>
  props.marks
    .filter((mark) => mark.value < top.value)
    .map((mark) => ({ ...mark, y: y(mark.value).toFixed(1) })),
);

const ceilingY = computed(() => y(top.value));

const tracking = computed(() => props.crosshair !== undefined);

// In percent of the box: the svg stretches, so the dot is drawn over it.
const cross = computed(() => {
  const t = props.crosshair;
  if (t == null || t < props.from || t > props.to) {
    return null;
  }
  const point = valueAt(props.points, t);
  return {
    x: (x(t) / W) * 100,
    dot: point
      ? { x: (x(point.t) / W) * 100, y: (y(point.v) / H) * 100 }
      : null,
  };
});

function onMove(event: PointerEvent) {
  if (!tracking.value) {
    return;
  }
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (!box.width) {
    return;
  }
  const ratio = Math.min(
    1,
    Math.max(0, (event.clientX - box.left) / box.width),
  );
  emit("hover", props.from + ratio * span.value);
}

function onLeave() {
  if (tracking.value) {
    emit("hover", null);
  }
}
</script>

<template>
  <div
    class="gsn-spark relative h-[30px] w-full"
    :data-tone="tone"
    :data-track="tracking"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <svg
      class="block h-full w-full"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        v-if="ceiling"
        class="gsn-spark-max"
        x1="0"
        :x2="W"
        :y1="ceilingY"
        :y2="ceilingY"
        stroke-dasharray="3 3"
        vector-effect="non-scaling-stroke"
      />
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
    <template v-if="cross">
      <span
        class="gsn-spark-cross"
        :style="{ left: `${cross.x}%` }"
        aria-hidden="true"
      ></span>
      <span
        v-if="cross.dot"
        class="gsn-spark-dot"
        :style="{ left: `${cross.dot.x}%`, top: `${cross.dot.y}%` }"
        aria-hidden="true"
      ></span>
    </template>
  </div>
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
.gsn-spark[data-track="true"] {
  cursor: crosshair;
  touch-action: pan-y;
}
.gsn-spark-max {
  stroke: hsl(var(--tone) / 0.4);
  stroke-width: 1;
}
.gsn-spark-mark {
  stroke: hsl(var(--warning) / 0.55);
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
.gsn-spark-cross {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  margin-left: -0.5px;
  background: hsl(240 5% 72% / 0.45);
  pointer-events: none;
}
.gsn-spark-dot {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: hsl(var(--tone));
  box-shadow: 0 0 0 2px hsl(240 6% 7%);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
</style>
