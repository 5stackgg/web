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
import { dateLocale } from "~/utilities/dateLocale";

// Below this chart width the x axis keeps fewer ticks and day labels
// (YYYY-MM-DD) shorten to "Aug 12", so they never run into each other.
const NARROW = 480;

function shortDay(label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  return new Date(`${label}T00:00:00`).toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  });
}

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
      narrow: false,
    };
  },
  mounted() {
    const width = (this.$el as HTMLElement | null)?.parentElement?.clientWidth;
    if (width) this.narrow = width < NARROW;
  },
  computed: {
    options() {
      const narrow = this.narrow;
      return {
        responsive: true,
        maintainAspectRatio: false,
        onResize: (_chart: unknown, size: { width: number }) => {
          this.narrow = size.width < NARROW;
        },
        interaction: {
          mode: "index" as const,
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
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
            border: {
              display: false,
            },
            grid: {
              display: false,
            },
            ticks: {
              autoSkip: true,
              maxTicksLimit: narrow ? 4 : 8,
              autoSkipPadding: narrow ? 12 : 3,
              maxRotation: 0,
              callback(this: any, value: number) {
                const label = this.getLabelForValue(value);
                return narrow ? shortDay(label) : label;
              },
            },
          },
        },
      };
    },
    chartData() {
      return {
        labels: this.labels,
        datasets: [
          {
            label: this.label,
            fill: this.type !== "bar",
            tension: 0.25,
            borderWidth: 2,
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
  methods: {
    hex2rgba(hex: string, alpha = 1) {
      const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
      return `rgba(${r},${g},${b},${alpha})`;
    },
  },
};
</script>
