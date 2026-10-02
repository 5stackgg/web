<script lang="ts" setup>
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  type Plugin,
} from "chart.js";
import { Line } from "vue-chartjs";
import { useI18n } from "vue-i18n";
import type { SeasonLine } from "~/utilities/seasonPace";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const props = defineProps<{
  current: SeasonLine | null;
  previous: SeasonLine | null;
  currentLabel: string;
  previousLabel: string;
}>();

const { t } = useI18n();

const AMBER = "hsl(33, 94%, 58%)";
const GHOST = "rgba(255, 255, 255, 0.35)";

const length = computed(() =>
  Math.max(
    props.current?.ratings.length ?? 0,
    props.previous?.ratings.length ?? 0,
  ),
);

const radius = computed(() => {
  if (length.value <= 30) return 3;
  if (length.value <= 80) return 2;
  return 1;
});

const chartData = computed(() => {
  const prev = props.previous;
  const cur = props.current;
  const r = radius.value;
  const curLast = (cur?.ratings.length ?? 0) - 1;
  const datasets: any[] = [];
  if (prev) {
    datasets.push({
      label: props.previousLabel,
      data: prev.ratings,
      borderColor: GHOST,
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: prev.ratings.map((_, i) =>
        i === prev.peakIndex ? 4.5 : r * 0.6,
      ),
      pointBackgroundColor: prev.ratings.map((_, i) =>
        i === prev.peakIndex ? AMBER : GHOST,
      ),
      pointBorderColor: prev.ratings.map((_, i) =>
        i === prev.peakIndex ? AMBER : GHOST,
      ),
      tension: 0.3,
    });
  }
  if (cur) {
    datasets.push({
      label: props.currentLabel,
      data: cur.ratings,
      borderColor: "#fff",
      borderWidth: 2.5,
      pointRadius: cur.ratings.map((_, i) => (i === curLast ? 4.5 : r)),
      pointBackgroundColor: "#fff",
      pointBorderColor: "#fff",
      tension: 0.3,
    });
  }
  return {
    labels: Array.from({ length: length.value }, (_, i) => String(i)),
    datasets,
  };
});

// Names the previous season's peak and the latest rating right on the line,
// so the target and where you stand read without hovering.
const markers: Plugin<"line"> = {
  id: "seasonPaceMarkers",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const draw = (
      point: { x: number; y: number } | undefined,
      text: string,
      color: string,
      above: boolean,
    ) => {
      if (!point) return;
      ctx.save();
      ctx.font = "600 11px Oxanium, sans-serif";
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      const width = ctx.measureText(text).width;
      let x = point.x;
      let y = above ? point.y - 12 : point.y;
      if (above) {
        ctx.textAlign = "center";
        x = Math.min(
          Math.max(x, chartArea.left + width / 2),
          chartArea.right - width / 2,
        );
        if (y < chartArea.top + 6) y = point.y + 14;
      } else {
        const fitsRight = x + 8 + width <= chartArea.right + 12;
        ctx.textAlign = fitsRight ? "left" : "right";
        x = fitsRight ? x + 8 : x - 8;
        y = point.y - (fitsRight ? 0 : 12);
      }
      ctx.fillText(text, x, y);
      ctx.restore();
    };

    if (props.previous) {
      draw(
        chart.getDatasetMeta(0).data[props.previous.peakIndex],
        t("pages.players.detail.season_pace.peak_marker", {
          season: props.previousLabel,
          elo: props.previous.peak.toLocaleString(),
        }),
        AMBER,
        true,
      );
    }

    if (props.current) {
      const curMeta = chart.getDatasetMeta(props.previous ? 1 : 0);
      const last = props.current.ratings.length - 1;
      draw(
        curMeta.data[last],
        props.current.ratings[last].toLocaleString(),
        "rgba(255, 255, 255, 0.95)",
        false,
      );
    }
  },
};

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index" as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(20, 22, 28, 0.96)",
      borderColor: "#fbbf24",
      borderWidth: 1,
      titleColor: "rgba(255, 255, 255, 0.9)",
      titleFont: { size: 11, weight: 600, family: "'Oxanium', sans-serif" },
      bodyColor: "rgba(255, 255, 255, 0.85)",
      bodyFont: { size: 12, family: "'Oxanium', sans-serif" },
      padding: 10,
      cornerRadius: 2,
      boxWidth: 8,
      boxHeight: 8,
      boxPadding: 6,
      callbacks: {
        title: (items: any[]) => {
          const index = items?.[0]?.dataIndex ?? 0;
          return index === 0
            ? t("pages.players.detail.season_pace.start")
            : t("pages.players.detail.season_pace.match", { n: index });
        },
        label: (item: any) =>
          `${item.dataset.label}   ${Number(item.parsed.y).toLocaleString()}`,
        labelColor: (item: any) => ({
          borderColor: item.dataset.borderColor,
          backgroundColor: item.dataset.borderColor,
        }),
      },
    },
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: { color: "rgba(255,255,255,0.05)" },
      ticks: {
        color: "rgba(255, 255, 255, 0.6)",
        font: { size: 11 },
        padding: 8,
        maxTicksLimit: 6,
        callback: (value: any) => Number(value).toLocaleString(),
      },
    },
    x: {
      grid: { display: false },
      ticks: {
        color: "rgba(255, 255, 255, 0.6)",
        font: { size: 11 },
        autoSkip: true,
        maxTicksLimit: 8,
        maxRotation: 0,
        callback: (_value: any, index: number) =>
          index === 0 ? t("pages.players.detail.season_pace.start") : index,
      },
    },
  },
  layout: { padding: { top: 20, right: 40, bottom: 4, left: 4 } },
}));

const chartKey = computed(
  () =>
    `${props.previous?.ratings.length ?? 0}:${props.current?.ratings.length ?? 0}`,
);
</script>

<template>
  <div class="h-full w-full">
    <Line
      :key="chartKey"
      :data="chartData"
      :options="chartOptions"
      :plugins="[markers]"
    />
  </div>
</template>
