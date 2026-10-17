<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import NodeMetricCharts, {
  type ChartSpec,
} from "~/components/game-server-nodes/NodeMetricCharts.vue";
import {
  gapBands,
  inWindow,
  niceCeil,
  sampleInterval,
  type GapBand,
  type StatPoint,
} from "~/components/game-server-nodes/nodeMetrics";
import {
  clockLabel,
  durationLabel,
  timeLabel,
} from "~/components/game-server-nodes/nodeFormat";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import {
  last,
  serviceCpuPoints,
  serviceMemoryPoints,
  type ServiceStat,
} from "~/components/system-metrics/metricRules";

// A service's last hour in the Game Server Nodes chart style: CPU and memory
// stacked under one crosshair, by time, with breaks where it stopped
// reporting.
const props = defineProps<{
  service: ServiceStat;
  now: number;
}>();

const { t } = useI18n();

const WINDOW_MS = 60 * 60_000;
const GB = 1024 ** 3;
const MB = 1024 ** 2;

const cpu = computed(() => serviceCpuPoints(props.service));
const memory = computed(() => serviceMemoryPoints(props.service));

const to = computed(() =>
  Math.max(props.now, cpu.value.at(-1)?.t ?? 0, memory.value.at(-1)?.t ?? 0),
);
const from = computed(() => to.value - WINDOW_MS);
const interval = computed(() =>
  sampleInterval(cpu.value.length ? cpu.value : memory.value),
);
const win = (points: Array<StatPoint>) =>
  inWindow(points, from.value, to.value);

const values = (points: Array<StatPoint>) =>
  points
    .map((point) => point.v)
    .filter((value): value is number => value != null);

const pct = (value: number | null) =>
  value == null
    ? "—"
    : value < 10
      ? value.toFixed(1)
      : String(Math.round(value));

const charts = computed<Array<ChartSpec>>(() => {
  const cpuPoints = win(cpu.value);
  const cpuValues = values(cpuPoints);
  const cpuPeak = cpuValues.length ? Math.max(...cpuValues) : 0;
  const cpuAvg = cpuValues.length
    ? cpuValues.reduce((sum, value) => sum + value, 0) / cpuValues.length
    : null;

  const bytes = win(memory.value);
  const memPeakBytes = Math.max(0, ...values(bytes));
  const unit = memPeakBytes >= GB ? GB : MB;
  const unitLabel = unit === GB ? "GB" : "MB";
  const memPoints = bytes.map((point) => ({
    t: point.t,
    v: point.v == null ? null : point.v / unit,
  }));
  const amount = (value: number) =>
    unit === GB ? value.toFixed(1) : String(Math.round(value));
  const capacity = Number(last(props.service.memory)?.total) || null;

  return [
    {
      key: "cpu",
      label: t("pages.system_metrics.cpu_short"),
      unit: t("pages.system_metrics.services_table.of_node"),
      height: 58,
      // Most services sit far below the node's capacity: the axis follows
      // the peak so their line is readable, never past 100%.
      max: Math.min(100, niceCeil(Math.max(5, cpuPeak * 1.15))),
      lines: [{ points: cpuPoints, tone: "cpu", area: true }],
      tick: (value) => `${+value.toFixed(1)}%`,
      read: ([value]) => (value == null ? "—" : `${pct(value)}%`),
      summary:
        cpuAvg == null
          ? ""
          : t(`${INSPECTOR}.chart.avg_peak`, {
              avg: pct(cpuAvg),
              peak: pct(cpuPeak),
            }),
    },
    {
      key: "mem",
      label: t("pages.system_metrics.memory_short"),
      unit: unitLabel,
      height: 50,
      max: niceCeil(
        Math.max(unit === GB ? 0.5 : 16, (memPeakBytes / unit) * 1.08),
      ),
      lines: [{ points: memPoints, tone: "mem", area: true }],
      tick: (value) => String(+value.toFixed(2)),
      read: ([value]) =>
        value == null
          ? "—"
          : capacity
            ? `${amount(value)} ${unitLabel} (${pct((value * unit * 100) / capacity)}%)`
            : `${amount(value)} ${unitLabel}`,
      summary: memPeakBytes
        ? t(`${INSPECTOR}.chart.peak`, {
            peak: `${amount(memPeakBytes / unit)} ${unitLabel}`,
          })
        : "",
    },
  ];
});

const bands = computed(() =>
  gapBands(
    win(cpu.value.length ? cpu.value : memory.value),
    from.value,
    to.value,
    interval.value,
  ),
);

const bandLabel = (band: GapBand) =>
  band.open
    ? t(`${INSPECTOR}.status.offline_since`, { time: clockLabel(band.from) })
    : t(`${INSPECTOR}.offline_for`, {
        duration: durationLabel(band.to - band.from),
      });

const hoverT = ref<number | null>(null);

const timeText = computed(() => {
  if (hoverT.value == null) {
    return t(`${INSPECTOR}.now`);
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
  const first = (cpu.value.length ? cpu.value : memory.value).find(
    (point) => point.v != null,
  )?.t;
  if (first != null && first > from.value + interval.value * 2) {
    parts.push(t(`${INSPECTOR}.chart.starts`, { time: timeLabel(first) }));
  }
  if (bands.value.length) {
    parts.push(t(`${INSPECTOR}.chart.gaps`));
  }
  return parts.join(" ");
});
</script>

<template>
  <div class="grid gap-2">
    <span class="text-xs tabular-nums text-muted-foreground">{{
      timeText
    }}</span>
    <NodeMetricCharts
      :charts="charts"
      :from="from"
      :to="to"
      :interval="interval"
      :bands="bands"
      :band-label="bandLabel"
      range-key="1h"
      :label="t(`${INSPECTOR}.chart.label`)"
      @hover="(value) => (hoverT = value)"
    />
    <p class="text-[11.5px] leading-snug text-muted-foreground/60">
      {{ caption }}
    </p>
  </div>
</template>
