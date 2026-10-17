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
  <Bar
    v-if="type === 'bar'"
    :data="chartData"
    :options="options"
    :plugins="plugins"
  />
  <Line v-else :data="chartData" :options="options" :plugins="plugins" />
</template>

<script lang="ts">
import { dateLocale } from "~/utilities/dateLocale";

// Below this chart width the x axis keeps fewer ticks and day labels
// (YYYY-MM-DD) shorten to "Aug 12", so they never run into each other.
const NARROW = 480;

// The Game Server Nodes chart look (NodeMetricCharts): hairline grid, 10px
// muted axis text, a 1.5px line over a 10% wash, a crosshair with a ringed
// dot. Canvas can't read CSS variables, so the same colours as values.
const GRID = "rgb(38, 38, 41)"; // hsl(240 4% 15.5%)
const AXIS_TEXT = "rgb(113, 113, 122)"; // hsl(240 4% 46%)
const CROSSHAIR = "rgba(180, 180, 187, 0.45)"; // hsl(240 5% 72% / 0.45)
const SURFACE = "rgb(17, 17, 19)"; // hsl(240 6% 7%)

// The "Ink" tooltip (ui/tooltip/TooltipContent).
const INK = {
  background: "#0c0c0f",
  border: "rgba(255, 255, 255, 0.09)",
  text: "rgb(250, 250, 250)",
  muted: "rgb(161, 161, 170)",
};

function shortDay(label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  return new Date(`${label}T00:00:00`).toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  });
}

function longLabel(label: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return new Date(`${label}T00:00:00`).toLocaleDateString(dateLocale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  if (/^\d{4}-\d{2}$/.test(label)) {
    return new Date(`${label}-01T00:00:00`).toLocaleDateString(dateLocale(), {
      month: "long",
      year: "numeric",
    });
  }
  return label;
}

// A vertical hairline at the hovered day, under the dot.
const crosshair = {
  id: "fleetCrosshair",
  afterDatasetsDraw(chart: any) {
    if (chart.config.type !== "line") return;
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    if (!active.length) return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, chartArea.top);
    ctx.lineTo(Math.round(x) + 0.5, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = CROSSHAIR;
    ctx.stroke();
    ctx.restore();
  },
};

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
      font: "",
    };
  },
  mounted() {
    const el = this.$el as HTMLElement | null;
    const width = el?.parentElement?.clientWidth;
    if (width) this.narrow = width < NARROW;
    if (el) this.font = getComputedStyle(el).fontFamily;
  },
  computed: {
    plugins() {
      return [crosshair];
    },
    options() {
      const narrow = this.narrow;
      const family = this.font || undefined;
      const tick = { size: 10, family };
      return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 240 },
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
            backgroundColor: INK.background,
            borderColor: INK.border,
            borderWidth: 1,
            cornerRadius: 6,
            caretSize: 6,
            caretPadding: 6,
            padding: { x: 10, y: 6 },
            displayColors: false,
            titleColor: INK.muted,
            titleFont: { size: 12, weight: "normal" as const, family },
            titleMarginBottom: 2,
            bodyColor: INK.text,
            bodyFont: { size: 12, weight: "bold" as const, family },
            callbacks: {
              title: (items: Array<{ label: string }>) =>
                items.length ? longLabel(items[0].label) : "",
              label: (context: { parsed: { y: number } }) =>
                `${context.parsed.y.toLocaleString()} ${this.label}`,
            },
          },
        },
        scales: {
          y: {
            position: "left" as const,
            beginAtZero: true,
            border: {
              display: false,
            },
            grid: {
              color: GRID,
              lineWidth: 1,
              drawTicks: false,
            },
            ticks: {
              precision: 0,
              maxTicksLimit: 3,
              padding: 6,
              color: AXIS_TEXT,
              font: tick,
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
              color: AXIS_TEXT,
              font: tick,
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
      const line = this.hex2rgba(this.color);
      // Bars read as columns of the same wash, capped with the line.
      const dataset =
        this.type === "bar"
          ? {
              borderWidth: { top: 1.5, right: 0, bottom: 0, left: 0 },
              borderSkipped: false,
              borderRadius: 2,
              borderColor: line,
              backgroundColor: this.hex2rgba(this.color, 0.3),
              hoverBackgroundColor: this.hex2rgba(this.color, 0.5),
            }
          : {
              fill: true,
              tension: 0,
              borderWidth: 1.5,
              borderJoinStyle: "round" as const,
              borderCapStyle: "round" as const,
              pointRadius: 0,
              pointHoverRadius: 3.5,
              pointHoverBorderWidth: 2,
              pointHoverBorderColor: SURFACE,
              pointHoverBackgroundColor: line,
              borderColor: line,
              backgroundColor: this.hex2rgba(this.color, 0.1),
            };
      return {
        labels: this.labels,
        datasets: [{ label: this.label, data: this.values, ...dataset }],
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
