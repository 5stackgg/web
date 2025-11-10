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
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || !meta.data) return;

      // Get eloChanges array from dataset
      const eloChanges = dataset.eloChanges || [];

      meta.data.forEach((point: any, index: number) => {
        if (index >= eloChanges.length) return;

        const eloChange = eloChanges[index];
        if (eloChange === null || eloChange === undefined || eloChange === 0)
          return;

        const x = point.x;
        const y = point.y;

        // Determine symbol, color, and format the number
        const symbol = eloChange > 0 ? "+" : "-";
        const color = eloChange > 0 ? "#22c55e" : "#ef4444"; // green or red
        const changeText = `${symbol}${Math.abs(eloChange).toLocaleString()}`;

        // Draw the change text with a subtle background for better readability
        ctx.save();

        // Measure text for background
        ctx.font = "bold 12px Arial";
        const textMetrics = ctx.measureText(changeText);
        const textWidth = textMetrics.width;
        const textHeight = 16;
        const padding = 4;

        // Draw subtle background rectangle
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(
          x + 10 - padding,
          y - textHeight / 2 - padding,
          textWidth + padding * 2,
          textHeight + padding * 2,
        );

        // Draw the change text
        ctx.font = "bold 12px Arial";
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        // Position text to the right of the point
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
  assists?: number | null;
  current_elo?: number | null;
  damage?: number | null;
  damage_percent?: number | null;
  deaths?: number | null;
  elo_change?: number | null;
  expected_score?: number | null;
  kda?: number | null;
  kills?: number | null;
  match_created_at: string;
  match_id?: string | null;
  opponent_team_elo_avg?: number | null;
  performance_multiplier?: number | null;
  player_name?: string | null;
  player_steam_id?: string | null;
  player_team_elo_avg?: number | null;
  team_avg_kda?: number | null;
  updated_elo?: number | null;
}

export default {
  components: {
    Line,
  },
  props: {
    eloHistory: {
      type: Array as () => EloHistoryEntry[],
      required: true,
    },
  },
  computed: {
    chartOptions() {
      const self = this;
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: false,
          },
        },
        scales: {
          y: {
            position: "left" as const,
            beginAtZero: false,
            grid: {
              display: false,
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.7)",
              font: {
                size: 11,
              },
              padding: 8,
              callback: (value: any) => {
                return value.toLocaleString();
              },
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.7)",
              font: {
                size: 11,
              },
              padding: 8,
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              callback: (_tickValue: any, index: number) => {
                const sortedHistory: EloHistoryEntry[] =
                  self.sortedHistory || [];
                if (index >= sortedHistory.length) return "";
                const entry = sortedHistory[index];
                if (!entry?.match_created_at) return "";
                const date = new Date(entry.match_created_at);
                return date.toLocaleDateString(navigator.language, {
                  month: "short",
                  day: "numeric",
                });
              },
            },
            afterFit: (scale: any) => {
              // Add padding on the right side to prevent cutting off the last number
              scale.paddingRight = 60;
            },
          },
        },
        layout: {
          padding: {
            right: 60,
            top: 10,
            bottom: 10,
            left: 10,
          },
        },
      };
    },
    sortedHistory(): EloHistoryEntry[] {
      const history = this.eloHistory as EloHistoryEntry[];
      if (!history || history.length === 0) {
        return [];
      }
      // Sort by match_created_at to ensure chronological order
      return [...history].sort((a: EloHistoryEntry, b: EloHistoryEntry) => {
        const dateA = new Date(a.match_created_at).getTime();
        const dateB = new Date(b.match_created_at).getTime();
        return dateA - dateB;
      });
    },
    chartData() {
      const sortedHistory = this.sortedHistory;
      if (sortedHistory.length === 0) {
        return null;
      }

      const eloColor = this.getEloColor(
        sortedHistory[sortedHistory.length - 1]?.updated_elo ||
          sortedHistory[sortedHistory.length - 1]?.current_elo ||
          0,
      );

      // Store eloChange data in dataset for plugin access
      const eloChanges = sortedHistory.map((entry: EloHistoryEntry) =>
        typeof entry.elo_change === "number" ? entry.elo_change : 0,
      );

      return {
        labels: sortedHistory.map(
          (entry: EloHistoryEntry) => new Date(entry.match_created_at),
        ),
        datasets: [
          {
            label: "ELO",
            fill: false,
            borderColor: eloColor,
            borderWidth: 2.5,
            pointBackgroundColor: eloColor,
            pointBorderColor: "#fff",
            pointBorderWidth: 2.5,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointHoverBorderWidth: 3,
            tension: 0.4,
            data: sortedHistory.map(
              (entry: EloHistoryEntry) =>
                entry.updated_elo || entry.current_elo || 0,
            ),
            eloChanges: eloChanges, // Store elo changes for plugin access
          },
        ],
      };
    },
  },
  mounted() {
    // Store component reference for plugin access
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
      // Store component reference on chart instance for plugin access
      if (chart) {
        (chart as any).$vueComponent = this;
      }
    },
    drawEloChangeSymbols(chart: any) {
      if (!chart || !chart.ctx) return;

      const ctx = chart.ctx;
      const sortedHistory: EloHistoryEntry[] = this.sortedHistory;

      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta || !meta.data) return;

        meta.data.forEach((point: any, index: number) => {
          if (index >= sortedHistory.length) return;

          const entry = sortedHistory[index];
          if (
            !entry ||
            entry.elo_change === null ||
            entry.elo_change === undefined
          )
            return;

          const eloChange =
            typeof entry.elo_change === "number" ? entry.elo_change : 0;
          if (eloChange === 0) return;

          const x = point.x;
          const y = point.y;

          // Determine symbol and color
          const symbol = eloChange > 0 ? "+" : "-";
          const color = eloChange > 0 ? "#22c55e" : "#ef4444"; // green or red

          // Draw the symbol
          ctx.save();
          ctx.font = "bold 14px Arial";
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // Position symbol to the right of the point
          ctx.fillText(symbol, x + 12, y);
          ctx.restore();
        });
      });
    },
    hex2rgba(hex: string, alpha: number = 1): string {
      const [r, g, b] = hex.match(/\w\w/g)!.map((x: string) => parseInt(x, 16));
      return `rgba(${r},${g},${b},${alpha})`;
    },
    getEloColor(elo: number): string {
      if (elo >= 30000) return "#EB4B4B";
      if (elo >= 25000) return "#D22CE6";
      if (elo >= 20000) return "#FED700";
      if (elo >= 15000) return "#8846FF";
      if (elo >= 10000) return "#4B69FF";
      if (elo >= 5000) return "#5E98D7";
      return "#B1C3D9";
    },
  },
};
</script>
