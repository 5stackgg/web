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
} from "~/components/game-server-nodes/NodeMetricCharts.vue";
import {
  isOffline,
  isReachable,
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
  networkInSeries,
  networkOutSeries,
  networkSeries,
  niceCeil,
  rangeMinutes,
  sampleInterval,
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
// them in place into charts with axes and one crosshair. Disk follows in its
// own block (InspectorDisk).
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
const reachable = computed(() => isReachable(props.node));
const grown = computed(() => props.range !== "live");

const cpu = computed(() => cpuSeries(props.stats));
const memory = computed(() => memorySeries(props.stats));
const memTotal = computed(() => memoryTotalGb(props.stats));
const netIn = computed(() => networkInSeries(props.stats));
const netOut = computed(() => networkOutSeries(props.stats));
const network = computed(() => networkSeries(props.stats));
const gpu = computed(() => (props.node.gpu ? gpuSeries(props.stats) : []));
const interval = computed(() =>
  sampleInterval(cpu.value.length ? cpu.value : memory.value),
);

const liveFrom = computed(() => now.value - rangeMinutes("live") * 60_000);
const tile = (points: Array<StatPoint>) =>
  inWindow(points, liveFrom.value, now.value);

const tiles = computed(() => {
  const list = [
    {
      key: "cpu",
      label: t("pages.system_metrics.cpu_short"),
      unit: "",
      value: latest(cpu.value),
      suffix: "%",
      points: tile(cpu.value),
      max: 100,
      tone: "cpu" as const,
    },
    {
      key: "mem",
      label: t("pages.system_metrics.memory_short"),
      unit: memTotal.value
        ? t(`${INSPECTOR}.of_total`, { total: formatGb(memTotal.value) })
        : "",
      value: latest(memory.value),
      suffix: "%",
      points: tile(memory.value),
      max: 100,
      tone: "mem" as const,
    },
    {
      key: "net",
      label: t("pages.system_metrics.network_short"),
      unit: "",
      value: latest(network.value),
      suffix: " Mbps",
      points: tile(network.value),
      max: niceCeil(
        Math.max(5, ...tile(network.value).map((point) => point.v ?? 0)),
      ),
      tone: "net" as const,
    },
  ];
  if (props.node.gpu) {
    list.push({
      key: "gpu",
      label: "GPU",
      unit: "",
      value: latest(gpu.value),
      suffix: "%",
      points: tile(gpu.value),
      max: 100,
      tone: "gpu" as any,
    });
  }
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

const charts = computed<Array<ChartSpec>>(() => {
  const cpuPoints = win(cpu.value);
  const memPoints = win(memory.value);
  const inPoints = win(netIn.value);
  const outPoints = win(netOut.value);
  const total = memTotal.value;
  const netPeak = Math.max(
    stats(inPoints)?.max ?? 0,
    stats(outPoints)?.max ?? 0,
  );
  const memPeak = stats(memPoints)?.max;
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
    {
      key: "mem",
      label: t("pages.system_metrics.memory_short"),
      unit: total ? t(`${INSPECTOR}.of_total`, { total: formatGb(total) }) : "",
      height: 44,
      max: 100,
      lines: [{ points: memPoints, tone: "mem", area: true }],
      tick: (value) => `${value}%`,
      read: ([value]) =>
        value == null
          ? "—"
          : total
            ? `${formatGb((value * total) / 100)} (${Math.round(value)}%)`
            : percent(value),
      summary:
        memPeak != null && total
          ? t(`${INSPECTOR}.chart.peak`, {
              peak: formatGb((memPeak * total) / 100),
            })
          : "",
    },
    {
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
    },
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
  }
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

const hoverT = ref<number | null>(null);
watch(grown, () => (hoverT.value = null));

const timeText = computed(() => {
  if (hoverT.value == null) {
    if (reachable.value) {
      return t(`${INSPECTOR}.now`);
    }
    return offline.value && props.node.offline_at
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

const caption = computed(() => {
  const parts = [t(`${INSPECTOR}.chart.caption`)];
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
        v-if="grown && !inSetup"
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
          <div
            v-else
            class="gsn-tiles grid gap-3.5"
            :class="tiles.length > 3 ? 'grid-cols-2' : 'grid-cols-3'"
          >
            <div
              v-for="item of tiles"
              :key="item.key"
              class="grid min-w-0 gap-0.5"
            >
              <span class="truncate text-[11.5px] text-muted-foreground"
                >{{ item.label
                }}<span v-if="item.unit" class="ml-1 text-muted-foreground/60">
                  {{ item.unit }}</span
                ></span
              >
              <span class="mb-1 whitespace-nowrap text-[15px] font-semibold">
                <TweenNumber
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
              />
            </div>
          </div>
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
/* Two to a row in the wide panel's narrower column. */
@container (max-width: 340px) {
  .gsn-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .gsn-seg-ind {
    transition: none;
  }
}
</style>
