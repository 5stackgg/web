<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { HeightSwap } from "~/components/ui/transitions";
import NodeSpark from "~/components/game-server-nodes/NodeSpark.vue";
import TweenNumber from "~/components/game-server-nodes/TweenNumber.vue";
import NodeMetricCharts, {
  type ChartSpec,
  type ChartTone,
} from "~/components/game-server-nodes/NodeMetricCharts.vue";
import {
  isOffline,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  METRIC_RANGES,
  cpuSeries,
  formatGb,
  gapBands,
  gpuSeries,
  inWindow,
  latest,
  memorySeries,
  memoryTotalGb,
  nearestTime,
  networkInSeries,
  networkOutSeries,
  networkSeries,
  niceCeil,
  rangeMinutes,
  sampleInterval,
  valueAt,
  vramSeries,
  vramTotalGb,
  type GapBand,
  type MetricRangeKey,
  type StatPoint,
} from "~/components/game-server-nodes/nodeMetrics";
import {
  clockLabel,
  durationLabel,
  timeLabel,
} from "~/components/game-server-nodes/nodeFormat";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// Live: tiles with sparklines over the last few minutes; a longer range grows
// them in place into charts with axes. Both share one crosshair time, read out
// in the header. Percent tiles are scaled to their max (memory and VRAM to the
// total) with a dashed line marking it. Disk follows in its own block
// (InspectorDisk).
const props = defineProps<{
  node: NodeLike;
  stats: any;
  range: MetricRangeKey;
}>();

const emit = defineEmits<{ "update:range": [range: MetricRangeKey] }>();

const { t } = useI18n();

const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 15_000);
});
onBeforeUnmount(() => clock && clearInterval(clock));
watch(
  () => props.stats,
  () => (now.value = Date.now()),
);

const inSetup = computed(() => props.node.status === "Setup");
const offline = computed(() => isOffline(props.node));
const grown = computed(() => props.range !== "live");

const cpu = computed(() => cpuSeries(props.stats));
const memory = computed(() => memorySeries(props.stats));
const memTotal = computed(() => memoryTotalGb(props.stats));
const netIn = computed(() => networkInSeries(props.stats));
const netOut = computed(() => networkOutSeries(props.stats));
const network = computed(() => networkSeries(props.stats));
const gpu = computed(() => (props.node.gpu ? gpuSeries(props.stats) : []));
const vram = computed(() => (props.node.gpu ? vramSeries(props.stats) : []));
const vramTotal = computed(() =>
  props.node.gpu ? vramTotalGb(props.stats) : null,
);
const interval = computed(() =>
  sampleInterval(cpu.value.length ? cpu.value : memory.value),
);

const ofTotal = (total: number | null) =>
  total ? t(`${INSPECTOR}.of_total`, { total: formatGb(total) }) : "";

const liveFrom = computed(() => now.value - rangeMinutes("live") * 60_000);
const tile = (points: Array<StatPoint>) =>
  inWindow(points, liveFrom.value, now.value);

type Tile = {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  suffix: string;
  points: Array<StatPoint>;
  max: number;
  ceiling: boolean;
  tone: "cpu" | "mem" | "net" | "gpu";
};

const percentTile = (
  key: string,
  label: string,
  series: Array<StatPoint>,
  tone: Tile["tone"],
  unit = "",
): Tile => ({
  key,
  label,
  unit,
  value: latest(series),
  suffix: "%",
  points: tile(series),
  max: 100,
  ceiling: true,
  tone,
});

const tiles = computed<Array<Tile>>(() => {
  const list = [
    percentTile("cpu", t("pages.system_metrics.cpu_short"), cpu.value, "cpu"),
    percentTile(
      "mem",
      t("pages.system_metrics.memory_short"),
      memory.value,
      "mem",
      ofTotal(memTotal.value),
    ),
  ];
  if (props.node.gpu) {
    list.push(percentTile("gpu", "GPU", gpu.value, "gpu"));
    if (vramTotal.value) {
      list.push(
        percentTile(
          "vram",
          t("pages.gpu_nodes.col.vram"),
          vram.value,
          "gpu",
          ofTotal(vramTotal.value),
        ),
      );
    }
  }
  const netPoints = tile(network.value);
  list.push({
    key: "net",
    label: t("pages.system_metrics.network_short"),
    unit: "",
    value: latest(network.value),
    suffix: " Mbps",
    points: netPoints,
    max: niceCeil(Math.max(5, ...netPoints.map((point) => point.v ?? 0))),
    ceiling: false,
    tone: "net",
  });
  return list;
});

const chartFrom = computed(
  () => now.value - rangeMinutes(props.range) * 60_000,
);
const win = (points: Array<StatPoint>) =>
  inWindow(points, chartFrom.value, now.value);

const stats = (points: Array<StatPoint>) => {
  const values = points
    .map((point) => point.v)
    .filter((value): value is number => value != null);
  return values.length
    ? {
        avg: values.reduce((sum, value) => sum + value, 0) / values.length,
        max: Math.max(...values),
      }
    : null;
};

const percent = (value: number | null) =>
  value == null ? "—" : `${Math.round(value)}%`;
const mbps = (value: number | null) =>
  value == null
    ? "—"
    : value < 10
      ? value.toFixed(1)
      : String(Math.round(value));
const avgPeak = (points: Array<StatPoint>) => {
  const summary = stats(points);
  return summary
    ? t(`${INSPECTOR}.chart.avg_peak`, {
        avg: Math.round(summary.avg),
        peak: Math.round(summary.max),
      })
    : "";
};

// Memory and VRAM: percent of the total, the axis topped by the total itself.
const capacityChart = (
  key: string,
  label: string,
  points: Array<StatPoint>,
  total: number | null,
  tone: ChartTone,
): ChartSpec => {
  const gb = (value: number) => formatGb(((total ?? 0) * value) / 100);
  const peak = stats(points)?.max;
  return {
    key,
    label,
    unit: ofTotal(total),
    height: 44,
    max: 100,
    lines: [{ points, tone, area: true }],
    tick: (value) => (!total ? `${value}%` : value ? gb(value) : "0"),
    read: ([value]) =>
      value == null
        ? "—"
        : total
          ? `${gb(value)} (${Math.round(value)}%)`
          : percent(value),
    summary:
      peak != null && total
        ? t(`${INSPECTOR}.chart.peak`, { peak: gb(peak) })
        : "",
  };
};

// The same order as the tiles, so each grows in place.
const charts = computed<Array<ChartSpec>>(() => {
  const cpuPoints = win(cpu.value);
  const inPoints = win(netIn.value);
  const outPoints = win(netOut.value);
  const netPeak = Math.max(
    stats(inPoints)?.max ?? 0,
    stats(outPoints)?.max ?? 0,
  );
  const list: Array<ChartSpec> = [
    {
      key: "cpu",
      label: t("pages.system_metrics.cpu_short"),
      height: 58,
      max: 100,
      lines: [{ points: cpuPoints, tone: "cpu", area: true }],
      tick: (value) => `${value}%`,
      read: ([value]) => percent(value),
      summary: avgPeak(cpuPoints),
    },
    capacityChart(
      "mem",
      t("pages.system_metrics.memory_short"),
      win(memory.value),
      memTotal.value,
      "mem",
    ),
  ];
  if (props.node.gpu) {
    const gpuPoints = win(gpu.value);
    list.push({
      key: "gpu",
      label: "GPU",
      height: 44,
      max: 100,
      lines: [{ points: gpuPoints, tone: "gpu", area: true }],
      tick: (value) => `${value}%`,
      read: ([value]) => percent(value),
      summary: avgPeak(gpuPoints),
    });
    if (vramTotal.value) {
      list.push(
        capacityChart(
          "vram",
          t("pages.gpu_nodes.col.vram"),
          win(vram.value),
          vramTotal.value,
          "gpu",
        ),
      );
    }
  }
  list.push({
    key: "net",
    label: t("pages.system_metrics.network_short"),
    unit: "Mbps",
    legend: [
      { tone: "rx", label: t(`${INSPECTOR}.chart.in`) },
      { tone: "tx", label: t(`${INSPECTOR}.chart.out`) },
    ],
    height: 50,
    max: niceCeil(Math.max(5, netPeak) * 1.08),
    lines: [
      { points: inPoints, tone: "rx", area: true },
      { points: outPoints, tone: "tx", area: false },
    ],
    tick: (value) =>
      value >= 1000
        ? `${+(value / 1000).toFixed(1)}k`
        : String(+value.toFixed(1)),
    read: ([rx, tx]) =>
      rx == null
        ? "—"
        : t(`${INSPECTOR}.chart.in_out`, { in: mbps(rx), out: mbps(tx) }),
    summary: netPeak
      ? t(`${INSPECTOR}.chart.peak`, { peak: mbps(netPeak) })
      : "",
  });
  return list;
});

const bands = computed(() =>
  gapBands(win(cpu.value), chartFrom.value, now.value, interval.value),
);

const bandLabel = (band: GapBand) =>
  band.open
    ? t(`${INSPECTOR}.status.offline_since`, { time: clockLabel(band.from) })
    : t(`${INSPECTOR}.offline_for`, {
        duration: durationLabel(band.to - band.from),
      });

// One crosshair time for the tiles (snapped to a sample) and the charts.
const hoverT = ref<number | null>(null);
watch(grown, () => (hoverT.value = null));

const tileTimes = computed(() =>
  tile(cpu.value.length ? cpu.value : memory.value)
    .filter((point) => point.v != null)
    .map((point) => point.t),
);

function onTileHover(time: number | null) {
  hoverT.value = time == null ? null : nearestTime(tileTimes.value, time);
}

const tileReadout = (item: Tile) => {
  const point =
    hoverT.value == null
      ? null
      : valueAt(item.points, hoverT.value, interval.value);
  return point ? `${Math.round(point.v)}${item.suffix}` : "—";
};

// What the range covers, from its real window: "Last 10 minutes".
const windowLabel = computed(() => {
  const minutes = rangeMinutes(props.range);
  return minutes % 60 === 0
    ? t(`${INSPECTOR}.window_hours`, { count: minutes / 60 }, minutes / 60)
    : t(`${INSPECTOR}.window_minutes`, { count: minutes }, minutes);
});

const timeText = computed(() => {
  if (hoverT.value == null) {
    if (!offline.value) {
      return windowLabel.value;
    }
    return grown.value && props.node.offline_at
      ? t(`${INSPECTOR}.last_report`, {
          time: clockLabel(props.node.offline_at),
        })
      : "";
  }
  const band = bands.value.find(
    (entry) => hoverT.value! >= entry.from && hoverT.value! <= entry.to,
  );
  return [timeLabel(hoverT.value, true), band ? bandLabel(band) : ""]
    .filter(Boolean)
    .join(" · ");
});

const cadence = computed(() =>
  t(`${INSPECTOR}.chart.cadence`, {
    seconds: Math.round(interval.value / 1000),
  }),
);

const caption = computed(() => {
  const parts = [cadence.value];
  const first = cpu.value.find((point) => point.v != null)?.t;
  if (first != null && first > chartFrom.value + interval.value * 2) {
    parts.push(t(`${INSPECTOR}.chart.starts`, { time: timeLabel(first) }));
  }
  if (bands.value.length) {
    parts.push(t(`${INSPECTOR}.chart.gaps`));
  }
  return parts.join(" ");
});

// The range seg's indicator slides under the picked option.
const seg = ref<HTMLElement | null>(null);
const indicator = ref<HTMLElement | null>(null);
function placeIndicator(glide: boolean) {
  const box = seg.value;
  const bar = indicator.value;
  const on = box?.querySelector<HTMLElement>('button[aria-pressed="true"]');
  if (!box || !bar || !on) {
    return;
  }
  const snap =
    !glide || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (snap) {
    bar.style.transition = "none";
  }
  bar.style.width = `${on.offsetWidth}px`;
  bar.style.transform = `translateX(${on.offsetLeft}px)`;
  bar.style.opacity = "1";
  if (snap) {
    void bar.offsetWidth;
    bar.style.transition = "";
  }
}
onMounted(() => nextTick(() => placeIndicator(false)));
watch(
  () => props.range,
  () => nextTick(() => placeIndicator(true)),
);

const pick = (range: MetricRangeKey) => {
  if (range !== props.range) {
    emit("update:range", range);
  }
};

const rangeLabel = (key: MetricRangeKey) =>
  key === "live" ? t("common.live") : t(`${INSPECTOR}.range.${key}`);
</script>

<template>
  <section class="grid gap-2.5 p-4">
    <h3
      class="flex min-h-7 min-w-0 items-center gap-2 text-[13px] font-semibold"
    >
      <span>{{ t("common.live") }}</span>
      <span
        v-if="!inSetup"
        class="min-w-0 truncate text-xs font-normal tabular-nums text-muted-foreground"
        >{{ timeText }}</span
      >
      <span class="grow"></span>
      <span
        v-if="!inSetup"
        ref="seg"
        class="gsn-seg"
        role="group"
        :aria-label="t(`${INSPECTOR}.range_label`)"
      >
        <span ref="indicator" class="gsn-seg-ind" aria-hidden="true"></span>
        <button
          v-for="option of METRIC_RANGES"
          :key="option.key"
          type="button"
          :aria-pressed="range === option.key"
          @click="pick(option.key)"
        >
          {{ rangeLabel(option.key) }}
        </button>
      </span>
    </h3>

    <p v-if="inSetup" class="text-xs text-muted-foreground">
      {{ t("pages.game_server_nodes.metrics.setup") }}
    </p>

    <template v-else>
      <HeightSwap>
        <div v-if="!grown" key="live">
          <p v-if="offline" class="text-xs text-muted-foreground">
            {{
              t(`${INSPECTOR}.live_offline`, {
                time: clockLabel(node.offline_at),
              })
            }}
          </p>
          <template v-else>
            <div
              class="gsn-tiles grid gap-3.5"
              :class="tiles.length > 3 ? 'grid-cols-2' : 'grid-cols-3'"
            >
              <div
                v-for="(item, index) of tiles"
                :key="item.key"
                class="grid min-w-0 gap-0.5"
                :data-wide="
                  tiles.length % 2 === 1 && index === tiles.length - 1
                "
              >
                <span class="truncate text-[11.5px] text-muted-foreground"
                  >{{ item.label
                  }}<span
                    v-if="item.unit"
                    class="ml-1 text-muted-foreground/60"
                  >
                    {{ item.unit }}</span
                  ></span
                >
                <span
                  class="mb-1 whitespace-nowrap text-[15px] font-semibold tabular-nums"
                >
                  <template v-if="hoverT != null">{{
                    tileReadout(item)
                  }}</template>
                  <TweenNumber
                    v-else
                    :value="item.value == null ? null : Math.round(item.value)"
                    :suffix="item.suffix"
                  />
                </span>
                <NodeSpark
                  :points="item.points"
                  :from="liveFrom"
                  :to="now"
                  :max="item.max"
                  :tone="item.tone"
                  :ceiling="item.ceiling"
                  :crosshair="hoverT"
                  @hover="onTileHover"
                />
              </div>
            </div>
            <p
              class="mt-2.5 text-[11.5px] leading-snug text-muted-foreground/60"
            >
              {{ cadence }}
            </p>
          </template>
        </div>
        <div v-else key="history" class="grid gap-2">
          <p v-if="offline" class="text-xs text-muted-foreground">
            {{
              t(`${INSPECTOR}.history_offline`, {
                time: clockLabel(node.offline_at),
              })
            }}
          </p>
          <NodeMetricCharts
            :charts="charts"
            :from="chartFrom"
            :to="now"
            :interval="interval"
            :bands="bands"
            :band-label="bandLabel"
            :range-key="range"
            :label="t(`${INSPECTOR}.chart.label`)"
            @hover="(value) => (hoverT = value)"
          />
          <p class="text-[11.5px] leading-snug text-muted-foreground/60">
            {{ caption }}
          </p>
        </div>
      </HeightSwap>
    </template>
  </section>
</template>

<style scoped>
.gsn-seg {
  position: relative;
  display: inline-flex;
  padding: 2px;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  background: hsl(var(--background) / 0.6);
}
.gsn-seg button {
  position: relative;
  z-index: 1;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  transition: color 150ms ease;
}
.gsn-seg button:hover {
  color: hsl(var(--foreground));
}
.gsn-seg button[aria-pressed="true"] {
  color: hsl(var(--foreground));
}
.gsn-seg-ind {
  position: absolute;
  top: 2px;
  left: 0;
  height: 22px;
  border-radius: 4px;
  background: hsl(240 4% 16%);
  opacity: 0;
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
/* Two to a row in the wide panel's narrower column. A last tile left alone
   (network) takes the whole row. */
.gsn-tiles.grid-cols-2 > [data-wide="true"] {
  grid-column: 1 / -1;
}
@container (max-width: 340px) {
  .gsn-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .gsn-tiles > [data-wide="true"] {
    grid-column: 1 / -1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .gsn-seg-ind {
    transition: none;
  }
}
</style>
