<script lang="ts" setup>
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "vue-chartjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

ChartJS.register({
  id: "eloChangeSymbols",
  afterDatasetsDraw: (chart: any) => {
    const ctx = chart.ctx;

    chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
      // Only annotate the focused series — multi-line readouts get unreadable otherwise.
      if (!dataset.focus) return;

      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || !meta.data) return;

      const eloChanges = dataset.eloChanges || [];

      meta.data.forEach((point: any, index: number) => {
        if (index >= eloChanges.length) return;

        const eloChange = eloChanges[index];
        if (eloChange === null || eloChange === undefined || eloChange === 0)
          return;

        const x = point.x;
        const y = point.y;

        const symbol = eloChange > 0 ? "+" : "-";
        const color = eloChange > 0 ? "#22c55e" : "#ef4444";
        const changeText = `${symbol}${Math.abs(eloChange).toLocaleString()}`;

        ctx.save();

        ctx.font = "bold 12px Arial";
        const textMetrics = ctx.measureText(changeText);
        const textWidth = textMetrics.width;
        const textHeight = 16;
        const padding = 4;

        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(
          x + 10 - padding,
          y - textHeight / 2 - padding,
          textWidth + padding * 2,
          textHeight + padding * 2,
        );

        ctx.font = "bold 12px Arial";
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(changeText, x + 12, y);
        ctx.restore();
      });
    });
  },
});
</script>

<template>
  <Line
    :data="chartData"
    :options="chartOptions"
    v-if="chartData"
    @chart:render="onChartRender"
  />
</template>

<script lang="ts">
interface EloHistoryEntry {
  current_elo?: number | null;
  elo_change?: number | null;
  match_created_at: string;
  match_id?: string | null;
  updated_elo?: number | null;
  [key: string]: unknown;
}

interface EloSeries {
  key: string;
  label: string;
  history: EloHistoryEntry[];
  focus?: boolean;
}

export default {
  components: {
    Line,
  },
  props: {
    // Multi-series mode: each series is plotted as its own line.
    // The series with `focus: true` is bold + carries +/- labels;
    // everything else is dimmed for context.
    series: {
      type: Array as () => EloSeries[],
      required: false,
      default: null,
    },
    // Single-series fallback (backwards compat).
    eloHistory: {
      type: Array as () => EloHistoryEntry[],
      required: false,
      default: null,
    },
  },
  computed: {
    normalizedSeries(): EloSeries[] {
      if (this.series && this.series.length) {
        return this.series.filter((s) => s.history && s.history.length > 0);
      }
      if (this.eloHistory && this.eloHistory.length) {
        return [
          {
            key: "elo",
            label: this.$t("pages.leaderboard.categories.elo"),
            history: this.eloHistory,
            focus: true,
          },
        ];
      }
      return [];
    },
    // Unified x-axis: every match_created_at across all series, deduped and sorted asc.
    unifiedTimestamps(): string[] {
      const set = new Set<string>();
      for (const s of this.normalizedSeries) {
        for (const entry of s.history) {
          if (entry.match_created_at) set.add(entry.match_created_at);
        }
      }
      return Array.from(set).sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      );
    },
    focusSeries(): EloSeries | null {
      return (
        this.normalizedSeries.find((s) => s.focus) ??
        this.normalizedSeries[0] ??
        null
      );
    },
    chartOptions() {
      const self = this;
      return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "nearest" as const,
          axis: "xy" as const,
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 6,
            usePointStyle: false,
            backgroundColor: "rgba(20, 22, 28, 0.96)",
            borderColor: "hsl(36, 100%, 50%)",
            borderWidth: 1,
            titleColor: "rgba(255, 255, 255, 0.9)",
            titleFont: {
              size: 11,
              weight: "600",
              family: "'Oxanium', sans-serif",
            },
            bodyColor: "rgba(255, 255, 255, 0.85)",
            bodyFont: {
              size: 12,
              family: "'Oxanium', sans-serif",
            },
            padding: 10,
            cornerRadius: 2,
            caretSize: 6,
            filter: (item: any) => {
              // Skip null points — gaps in dimmed series shouldn't surface tooltips.
              return item?.parsed?.y !== null && item?.parsed?.y !== undefined;
            },
            callbacks: {
              title: (items: any[]) => {
                const item = items?.[0];
                if (!item) return "";
                const ts = self.unifiedTimestamps?.[item.dataIndex];
                if (!ts) return "";
                return new Date(ts).toLocaleString(navigator.language, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              },
              labelColor: (item: any) => {
                // Solid tier-color swatch — same for focus and dim, so users
                // can correlate tooltip → line at a glance.
                const ds = item.dataset;
                const color = ds?.borderColor || "rgba(255,255,255,0.5)";
                return {
                  borderColor: color,
                  backgroundColor: color,
                };
              },
              label: (item: any) => {
                const ds = item.dataset;
                const mode = (ds?.label || "").toUpperCase();
                const elo =
                  typeof item.parsed?.y === "number"
                    ? item.parsed.y.toLocaleString()
                    : "—";
                const change = ds?.eloChanges?.[item.dataIndex] ?? 0;
                const changeText =
                  change > 0
                    ? `  ▲ +${Math.abs(change).toLocaleString()}`
                    : change < 0
                      ? `  ▼ -${Math.abs(change).toLocaleString()}`
                      : "";
                return `${mode}   ${elo}${changeText}`;
              },
              labelTextColor: (item: any) => {
                const ds = item.dataset;
                if (!ds) return "rgba(255,255,255,0.85)";
                return ds.focus
                  ? "rgba(255, 255, 255, 0.95)"
                  : "rgba(255, 255, 255, 0.65)";
              },
            },
          },
        },
        scales: {
          y: {
            position: "left" as const,
            beginAtZero: false,
            grid: { display: false },
            ticks: {
              color: "rgba(255, 255, 255, 0.7)",
              font: { size: 11 },
              padding: 8,
              callback: (value: any) => value.toLocaleString(),
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: "rgba(255, 255, 255, 0.7)",
              font: { size: 11 },
              padding: 8,
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              callback: (_tickValue: any, index: number) => {
                const labels: string[] = self.unifiedTimestamps || [];
                if (index >= labels.length) return "";
                const ts = labels[index];
                if (!ts) return "";
                return new Date(ts).toLocaleDateString(navigator.language, {
                  month: "short",
                  day: "numeric",
                });
              },
            },
            afterFit: (scale: any) => {
              scale.paddingRight = 60;
            },
          },
        },
        layout: {
          padding: { right: 60, top: 10, bottom: 10, left: 10 },
        },
      };
    },
    chartData() {
      const labels = this.unifiedTimestamps;
      if (labels.length === 0) return null;

      const datasets = this.normalizedSeries.map((series) => {
        const focus = !!series.focus;

        // Index lookup: timestamp → entry for this series.
        const byTs = new Map<string, EloHistoryEntry>();
        for (const entry of series.history) {
          if (entry.match_created_at) byTs.set(entry.match_created_at, entry);
        }

        const lastEntry =
          [...series.history]
            .sort(
              (a, b) =>
                new Date(a.match_created_at).getTime() -
                new Date(b.match_created_at).getTime(),
            )
            .pop() ?? null;

        const baseColor = this.getEloColor(
          (lastEntry?.updated_elo as number | undefined) ??
            (lastEntry?.current_elo as number | undefined) ??
            0,
        );
        const lineColor = focus ? baseColor : this.hex2rgba(baseColor, 0.32);
        const pointColor = focus ? baseColor : this.hex2rgba(baseColor, 0.4);

        const data = labels.map((ts) => {
          const entry = byTs.get(ts);
          if (!entry) return null;
          return (entry.updated_elo ?? entry.current_elo ?? null) as
            | number
            | null;
        });

        const eloChanges = labels.map((ts) => {
          const entry = byTs.get(ts);
          return typeof entry?.elo_change === "number" ? entry.elo_change : 0;
        });

        return {
          label: series.label,
          fill: false,
          borderColor: lineColor,
          borderWidth: focus ? 2.5 : 1.5,
          borderDash: focus ? [] : [4, 4],
          pointBackgroundColor: pointColor,
          pointBorderColor: focus ? "#fff" : "rgba(255,255,255,0.4)",
          pointBorderWidth: focus ? 2.5 : 1.25,
          pointRadius: focus ? 5 : 2.5,
          pointHoverRadius: focus ? 7 : 4,
          pointHoverBorderWidth: focus ? 3 : 1.5,
          tension: 0.4,
          spanGaps: true,
          data,
          eloChanges,
          focus,
        };
      });

      return {
        labels,
        datasets,
      };
    },
  },
  mounted() {
    this.$nextTick(() => {
      const chartElement = this.$el?.querySelector("canvas");
      if (chartElement) {
        const chart = (chartElement as any).__chartjs__;
        if (chart) {
          (chart as any).$vueComponent = this;
        }
      }
    });
  },
  methods: {
    onChartRender(chart: any) {
      if (chart) {
        (chart as any).$vueComponent = this;
      }
    },
    hex2rgba(hex: string, alpha: number = 1): string {
      const [r, g, b] = hex.match(/\w\w/g)!.map((x: string) => parseInt(x, 16));
      return `rgba(${r},${g},${b},${alpha})`;
    },
    getEloColor(elo: number): string {
      if (elo >= 22000) return "#EB4B4B";
      if (elo >= 17000) return "#D22CE6";
      if (elo >= 13000) return "#FED700";
      if (elo >= 10000) return "#8846FF";
      if (elo >= 7500) return "#4B69FF";
      if (elo >= 6000) return "#5E98D7";
      return "#B1C3D9";
    },
  },
};
</script>
