<script lang="ts" setup>
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line, Bar } from "vue-chartjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Filler,
);
</script>

<template>
  <Bar v-if="type === 'bar'" :data="chartData" :options="options" />
  <Line v-else :data="chartData" :options="options" />
</template>

<script lang="ts">
export default {
  components: {
    Line,
    Bar,
  },
  props: {
    type: {
      type: String,
      default: "line",
    },
    // Strips the axes, grid and hover for use behind a headline number. The
    // full-size chart on the same page carries the readable values.
    spark: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    labels: {
      type: Array,
      required: true,
    },
    values: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: this.spark ? { padding: 1 } : undefined,
        interaction: {
          mode: "index" as const,
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: !this.spark,
            mode: "index" as const,
            intersect: false,
            callbacks: {
              label: (context) => {
                return ` ${context.parsed.y.toLocaleString()} ${this.label}`;
              },
            },
          },
        },
        scales: {
          y: {
            display: !this.spark,
            position: "right" as const,
            beginAtZero: true,
            border: {
              display: false,
            },
            grid: {
              color: "rgba(127,127,127,0.12)",
            },
            ticks: {
              precision: 0,
              maxTicksLimit: 5,
            },
          },
          x: {
            display: !this.spark,
            border: {
              display: false,
            },
            grid: {
              display: false,
            },
            ticks: {
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 0,
            },
          },
        },
      },
    };
  },
  methods: {
    hex2rgba(hex: string, alpha = 1) {
      const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
      return `rgba(${r},${g},${b},${alpha})`;
    },
  },
  computed: {
    chartData() {
      return {
        labels: this.labels,
        datasets: [
          {
            label: this.label,
            fill: this.type !== "bar",
            tension: 0.25,
            borderWidth: this.spark ? 1.5 : 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderRadius: this.type === "bar" ? 4 : 0,
            borderColor: this.hex2rgba(this.color),
            backgroundColor:
              this.type === "bar"
                ? this.hex2rgba(this.color, 0.75)
                : this.hex2rgba(this.color, 0.18),
            data: this.values,
          },
        ],
      };
    },
  },
};
</script>
