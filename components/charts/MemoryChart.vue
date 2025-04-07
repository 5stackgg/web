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
</script>

<template>
  <Line :data="chartData" :options="options" />
</template>

<script lang="ts">
export default {
  components: {
    Line,
  },
  props: {
    metrics: {
      type: Object,
      required: true,
    },
    label: {
      type: String,
      default: "GB",
    },
  },
  data() {
    return {
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.parsed.y} ${this.label}`;
              },
            },
          },
        },
        scales: {
          y: {
            position: "right",
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                return `${value} ${this.label}`;
              },
            },
            max: Math.max(
              ...this.metrics.map((metric) =>
                Math.ceil(
                  this.label === "MB"
                    ? metric.total / (1024 * 1024)
                    : metric.total / (1024 * 1024 * 1024),
                ),
              ),
            ),
          },
          x: {
            ticks: {
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 0,
              callback: (index) => {
                const time = this.labels[index];
                return time
                  .toLocaleTimeString(navigator.language, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  .replace(/AM|PM/, "");
              },
            },
          },
        },
      },
      data: this.chartData,
    };
  },
  methods: {
    hex2rgba(hex, alpha = 1) {
      const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
      return `rgba(${r},${g},${b},${alpha})`;
    },
  },
  computed: {
    chartData() {
      const color = "#3b82f6";

      const datasets = [
        {
          label: this.$t("charts.usage"),
          fill: true,
          borderColor: this.hex2rgba(color),
          backgroundColor: this.hex2rgba(color, 0.2),
          data: this.metrics.map((metric: any) => {
            return Number(
              (
                metric.used /
                (this.label === "MB" ? 1024 * 1024 : 1024 * 1024 * 1024)
              ).toFixed(2),
            );
          }),
        },
      ];

      return {
        labels: this.labels,
        datasets,
      };
    },
    labels() {
      return this.metrics.map((metric: any) => {
        return new Date(metric.time);
      });
    },
  },
};
</script>
