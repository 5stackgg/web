<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  lineSegments,
  type GapBand,
  type StatPoint,
} from "~/components/game-server-nodes/nodeMetrics";
import { timeLabel } from "~/components/game-server-nodes/nodeFormat";

// Stacked metric charts drawn by time at the measured width, with one
// crosshair shared by every chart. Offline time is a tinted gap; a range
// switch cross-fades the lines (keyed by `rangeKey`), live samples redraw in
// place.
export type ChartTone = "cpu" | "mem" | "rx" | "tx" | "gpu";
export type ChartLine = {
  points: Array<StatPoint>;
  tone: ChartTone;
  area: boolean;
};
export type ChartSpec = {
  key: string;
  label: string;
  unit?: string;
  legend?: Array<{ tone: ChartTone; label: string }>;
  height: number;
  max: number;
  lines: Array<ChartLine>;
  tick: (value: number) => string;
  read: (values: Array<number | null>) => string;
  summary: string;
};

const props = defineProps<{
  charts: Array<ChartSpec>;
  from: number;
  to: number;
  interval: number;
  bands: Array<GapBand>;
  bandLabel: (band: GapBand) => string;
  rangeKey: string;
  label: string;
}>();

const emit = defineEmits<{ hover: [t: number | null] }>();

const PAD_L = 34;
const PAD_R = 8;
const TOP = 6;
const AXIS = 18;

const root = ref<HTMLElement | null>(null);
const width = ref(0);
const hoverT = ref<number | null>(null);

const plotWidth = computed(() => Math.max(10, width.value - PAD_L - PAD_R));
const span = computed(() => Math.max(1, props.to - props.from));
const X = (t: number) =>
  PAD_L + ((t - props.from) / span.value) * plotWidth.value;

// The times the crosshair snaps to: the first chart's first line.
const refTimes = computed(() =>
  (props.charts[0]?.lines[0]?.points ?? [])
    .filter((point) => point.v != null)
    .map((point) => point.t),
);

const valueAt = (points: Array<StatPoint>, t: number | null) => {
  if (t == null) {
    for (let index = points.length - 1; index >= 0; index--) {
      if (points[index].v != null) {
        return points[index];
      }
    }
    return null;
  }
  let best: StatPoint | null = null;
  for (const point of points) {
    if (
      point.v != null &&
      Math.abs(point.t - t) <= props.interval / 2 &&
      (!best || Math.abs(point.t - t) < Math.abs(best.t - t))
    ) {
      best = point;
    }
  }
  return best;
};

const ticksX = computed(() => {
  const minutes = span.value / 60_000;
  const most = Math.max(2, Math.floor(plotWidth.value / 72));
  const step =
    [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440].find(
      (candidate) => minutes / candidate <= most,
    ) ?? 1440;
  const start = new Date(props.from);
  const midnight = new Date(start);
  midnight.setHours(0, 0, 0, 0);
  const into = start.getHours() * 60 + start.getMinutes();
  let t = midnight.getTime() + Math.ceil(into / step) * step * 60_000;
  const out: Array<{ x: number; label: string }> = [];
  for (; t <= props.to; t += step * 60_000) {
    const x = X(t);
    if (x >= PAD_L + 14 && x <= PAD_L + plotWidth.value - 14) {
      out.push({ x, label: timeLabel(t) });
    }
  }
  return out;
});

const geometry = computed(() =>
  props.charts.map((chart, index) => {
    const axis = index === props.charts.length - 1;
    const h = chart.height + (axis ? AXIS : 0);
    const ph = chart.height - TOP;
    const max = chart.max || 1;
    const Y = (v: number) =>
      TOP + ph - (Math.min(Math.max(v, 0), max) / max) * ph;
    const ticks = ph < 60 ? [0, max] : [0, max / 2, max];
    const lines = chart.lines.map((line) => {
      let d = "";
      let a = "";
      for (const run of lineSegments(line.points, props.interval)) {
        const pts = run.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`);
        if (pts.length === 1) {
          pts.push(
            `${(X(run[0].t) + 1.5).toFixed(1)},${Y(run[0].v).toFixed(1)}`,
          );
        }
        const x0 = X(run[0].t).toFixed(1);
        const x1 = (
          X(run[run.length - 1].t) + (run.length === 1 ? 1.5 : 0)
        ).toFixed(1);
        const base = (TOP + ph).toFixed(1);
        d += `M${pts.join("L")}`;
        a += `M${x0},${base}L${pts.join("L")}L${x1},${base}Z`;
      }
      return { d, a, tone: line.tone, area: line.area };
    });
    const bands = props.bands
      .map((band) => {
        const x0 = Math.max(PAD_L, X(band.from));
        const x1 = Math.min(PAD_L + plotWidth.value, X(band.to));
        return { band, x: x0, w: Math.max(1.5, x1 - x0) };
      })
      .filter((band) => band.w >= 1.5);
    const values = chart.lines.map((line) =>
      valueAt(line.points, hoverT.value),
    );
    const dots =
      hoverT.value == null
        ? []
        : values
            .map((point, lineIndex) =>
              point
                ? {
                    x: X(point.t),
                    y: Y(point.v as number),
                    tone: chart.lines[lineIndex].tone,
                  }
                : null,
            )
            .filter(Boolean);
    return {
      chart,
      axis,
      h,
      ph,
      Y,
      ticks,
      lines,
      bands,
      dots: dots as Array<{ x: number; y: number; tone: ChartTone }>,
      readout: chart.read(values.map((point) => point?.v ?? null)),
    };
  }),
);

const crossX = computed(() => (hoverT.value == null ? null : X(hoverT.value)));

function setHover(t: number | null) {
  if (t === hoverT.value) {
    return;
  }
  hoverT.value = t;
  emit("hover", t);
}

function onMove(event: PointerEvent) {
  const plot = (event.target as HTMLElement).closest?.(".gsn-hx-plot");
  const times = refTimes.value;
  if (!plot || !times.length) {
    return;
  }
  const x = event.clientX - plot.getBoundingClientRect().left;
  const t = props.from + ((x - PAD_L) / plotWidth.value) * span.value;
  if (t < props.from || t > props.to) {
    setHover(null);
    return;
  }
  let best = times[0];
  for (const time of times) {
    if (Math.abs(time - t) < Math.abs(best - t)) {
      best = time;
    }
  }
  setHover(best);
}

function onKey(event: KeyboardEvent) {
  const times = refTimes.value;
  if (
    !times.length ||
    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const current =
    hoverT.value == null ? times.length - 1 : times.indexOf(hoverT.value);
  const step = event.shiftKey ? 10 : 1;
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? times.length - 1
        : Math.min(
            times.length - 1,
            Math.max(0, current + (event.key === "ArrowLeft" ? -step : step)),
          );
  setHover(times[next]);
}

let observer: ResizeObserver | null = null;
onMounted(() => {
  width.value = root.value?.clientWidth ?? 0;
  if (typeof ResizeObserver !== "undefined" && root.value) {
    observer = new ResizeObserver(() => {
      width.value = root.value?.clientWidth ?? 0;
    });
    observer.observe(root.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div
    ref="root"
    class="gsn-hx"
    tabindex="0"
    role="group"
    :aria-label="label"
    @pointermove="onMove"
    @pointerleave="setHover(null)"
    @keydown="onKey"
    @blur="setHover(null)"
  >
    <div
      v-for="(item, index) of geometry"
      :key="item.chart.key"
      class="grid min-w-0 gap-0.5"
    >
      <div class="gsn-hx-h">
        <span class="min-w-0 truncate"
          >{{ item.chart.label
          }}<span v-if="item.chart.unit" class="ml-1 text-muted-foreground/60">
            {{ item.chart.unit }}</span
          ></span
        >
        <span
          v-for="entry of item.chart.legend ?? []"
          :key="entry.tone"
          class="inline-flex items-center gap-1 whitespace-nowrap"
          ><i class="gsn-hx-key" :data-tone="entry.tone"></i
          >{{ entry.label }}</span
        >
        <span class="grow"></span>
        <span
          class="whitespace-nowrap text-[13px] font-semibold tabular-nums text-foreground"
          >{{ item.readout }}</span
        >
        <span
          v-if="item.chart.summary"
          class="whitespace-nowrap tabular-nums text-muted-foreground/60"
          >{{ item.chart.summary }}</span
        >
      </div>
      <div class="gsn-hx-plot" :style="{ height: `${item.h}px` }">
        <svg
          v-if="width"
          :width="width"
          :height="item.h"
          :viewBox="`0 0 ${width} ${item.h}`"
          aria-hidden="true"
        >
          <template v-for="band of item.bands" :key="band.band.from">
            <rect
              class="gsn-hx-band"
              :x="band.x"
              :y="TOP"
              :width="band.w"
              :height="item.ph"
            />
            <text
              v-if="index === 0 && band.w > 76"
              class="gsn-hx-bandl"
              :x="band.x + 5"
              :y="TOP + 11"
            >
              {{ bandLabel(band.band) }}
            </text>
          </template>
          <template v-for="tick of item.ticks" :key="tick">
            <line
              class="gsn-hx-grid"
              :x1="PAD_L"
              :x2="PAD_L + plotWidth"
              :y1="item.Y(tick)"
              :y2="item.Y(tick)"
            />
            <text
              class="gsn-hx-label"
              :x="PAD_L - 6"
              :y="item.Y(tick) + 3.5"
              text-anchor="end"
            >
              {{ item.chart.tick(tick) }}
            </text>
          </template>
          <Transition name="gsn-hx-fade">
            <g :key="rangeKey">
              <template
                v-for="(line, lineIndex) of item.lines"
                :key="lineIndex"
              >
                <path
                  v-if="line.area && line.a"
                  class="gsn-hx-area"
                  :data-tone="line.tone"
                  :d="line.a"
                />
                <path
                  v-if="line.d"
                  class="gsn-hx-line"
                  :data-tone="line.tone"
                  :d="line.d"
                />
              </template>
            </g>
          </Transition>
          <template v-if="item.axis">
            <text
              v-for="tick of ticksX"
              :key="tick.x"
              class="gsn-hx-label"
              :x="tick.x"
              :y="item.h - 4"
              text-anchor="middle"
            >
              {{ tick.label }}
            </text>
          </template>
          <line
            v-if="crossX != null"
            class="gsn-hx-cross"
            :x1="crossX"
            :x2="crossX"
            :y1="TOP"
            :y2="TOP + item.ph"
          />
          <circle
            v-for="dot of item.dots"
            :key="dot.tone"
            class="gsn-hx-dot"
            :data-tone="dot.tone"
            :cx="dot.x"
            :cy="dot.y"
            r="3.5"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gsn-hx {
  display: grid;
  gap: 8px;
  border-radius: 6px;
}
.gsn-hx:focus {
  outline: none;
}
.gsn-hx:focus-visible {
  outline: 2px solid hsl(var(--tac-amber) / 0.5);
  outline-offset: 6px;
}
.gsn-hx-h {
  display: flex;
  min-width: 0;
  min-height: 18px;
  align-items: baseline;
  gap: 8px;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}
.gsn-hx-key {
  display: inline-block;
  width: 12px;
  height: 2px;
  border-radius: 1px;
  background: hsl(var(--tone));
}
.gsn-hx-plot {
  position: relative;
  touch-action: pan-y;
  cursor: crosshair;
}
.gsn-hx-plot svg {
  display: block;
  overflow: visible;
}
[data-tone="cpu"] {
  --tone: var(--tac-amber);
}
[data-tone="mem"] {
  --tone: var(--tac-blue);
}
[data-tone="rx"] {
  --tone: var(--success);
}
[data-tone="tx"] {
  --tone: 265 70% 75%;
}
[data-tone="gpu"] {
  --tone: 330 75% 70%;
}
.gsn-hx-line {
  fill: none;
  stroke: hsl(var(--tone));
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.gsn-hx-area {
  fill: hsl(var(--tone) / 0.1);
}
.gsn-hx-grid {
  stroke: hsl(240 4% 15.5%);
  stroke-width: 1;
  shape-rendering: crispEdges;
}
.gsn-hx-label,
.gsn-hx-bandl {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  fill: hsl(240 4% 46%);
}
.gsn-hx-bandl {
  fill: hsl(var(--destructive));
}
.gsn-hx-band {
  fill: hsl(var(--destructive) / 0.08);
}
.gsn-hx-cross {
  stroke: hsl(240 5% 72% / 0.45);
  stroke-width: 1;
}
.gsn-hx-dot {
  fill: hsl(var(--tone));
  stroke: hsl(240 6% 7%);
  stroke-width: 2;
}
.gsn-hx-fade-enter-active {
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gsn-hx-fade-leave-active {
  transition: opacity 110ms ease-in;
}
.gsn-hx-fade-enter-from,
.gsn-hx-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .gsn-hx-fade-enter-active,
  .gsn-hx-fade-leave-active {
    transition: none;
  }
}
</style>
