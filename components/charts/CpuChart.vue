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
      default: "%",
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
            max: 100,
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
        animation: {
          numbers: { duration: 0 },
          colors: {
            type: "color",
            duration: 1000,
            from: "transparent",
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
    calculateCpuUsagePercentage(
      cpuTimeNano: number,
      elapsedTimeSeconds: number,
      numCPUs: number,
    ) {
      // Convert nanoseconds to seconds
      const cpuTimeSeconds = cpuTimeNano / 1_000_000_000;

      // Calculate CPU usage percentage
      const cpuUsagePercentage =
        (cpuTimeSeconds / (elapsedTimeSeconds * numCPUs)) * 100;

      return cpuUsagePercentage;
    },
  },
  computed: {
    chartData() {
      const color = "#ef4444";

      const datasets = [
        {
          label: "Usage",
          fill: true,
          borderColor: this.hex2rgba(color),
          backgroundColor: this.hex2rgba(color, 0.2),
          data: this.metrics.map((metric: any) => {
            return this.calculateCpuUsagePercentage(
              metric.used,
              10,
              metric.total,
            ).toFixed(2);
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
