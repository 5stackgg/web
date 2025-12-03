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
import { MEMORY_USAGE_CHART_COLORS } from "@/utilities/chartColors";
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
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            filter: (item: any) => {
              const label = String(item?.dataset?.label || "");
              const totalLabel = `${this.$t("charts.usage")} Total`;
              return label !== totalLabel;
            },
            callbacks: {
              label: (context: any) => {
                const usedVal = Number(context.parsed.y || 0);
                const val = usedVal.toLocaleString();

                let percent = "";
                try {
                  const dataIndex = context.dataIndex;
                  const totalLabel = `${this.$t("charts.usage")} Total`;
                  const datasets = context?.chart?.data?.datasets || [];
                  const totalDs: any = datasets.find(
                    (ds: any) => String(ds?.label || "") === totalLabel,
                  );
                  const totalVal = Number(
                    Array.isArray(totalDs?.data)
                      ? totalDs.data[dataIndex]
                      : NaN,
                  );
                  if (Number.isFinite(totalVal) && totalVal > 0) {
                    const p = (usedVal / totalVal) * 100;
                    percent = ` (${p.toFixed(1)}%)`;
                  }
                } catch {}

                return `${this.$t("charts.usage")}: ${val} ${
                  this.label
                }${percent}`;
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
      const label = this.$t("charts.usage");
      const color = MEMORY_USAGE_CHART_COLORS.at(0);

      const divisor = this.label === "MB" ? 1024 * 1024 : 1024 * 1024 * 1024;

      const usageDataset = {
        label,
        fill: true,
        borderColor: this.hex2rgba(color),
        backgroundColor: this.hex2rgba(color, 0.2),
        data: this.metrics.map((metric: any) => {
          return Number((metric.used / divisor).toFixed(2));
        }),
      };

      let totalConstValue = 0;
      if (this.metrics.length > 0) {
        const last = this.metrics[this.metrics.length - 1] as any;
        totalConstValue = Number((last.total / divisor).toFixed(2));
      }

      const totalDataset = {
        label: `${label} Total`,
        fill: false,
        borderColor: this.hex2rgba(color, 0.75),
        backgroundColor: this.hex2rgba("#9ca3af", 0.2),
        borderDash: [2, 2],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        spanGaps: true,
        data: this.metrics.map(() => totalConstValue),
      };

      const datasets = [usageDataset, totalDataset];

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
