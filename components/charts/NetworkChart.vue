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
import { NETWORK_USAGE_CHART_COLORS } from "@/utilities/chartColors";
export default {
  components: {
    Line,
  },
  props: {
    metrics: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    const metricsArr: any[] = Array.isArray(this.metrics)
      ? (this.metrics as any[])
      : [];
    // Compute y-axis max in Mbps across all NICs and both directions
    let maxMbps = 0;
    metricsArr.forEach((metric: any) => {
      const nics = Array.isArray(metric.nics) ? metric.nics : [];
      nics.forEach((nic: any) => {
        // Convert bytes to megabits per second for scale parity with datasets
        const rxMbps = ((nic.rx || 0) * 8) / 1_000_000;
        const txMbps = ((nic.tx || 0) * 8) / 1_000_000;
        if (rxMbps > maxMbps) {
          maxMbps = rxMbps;
        }
        if (txMbps > maxMbps) {
          maxMbps = txMbps;
        }
      });
    });
    const maxThroughput = Math.ceil(Math.max(maxMbps, 1) * 1.2);

    return {
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              usePointStyle: true,
              boxWidth: 10,
              boxHeight: 6,
              padding: 8,
            },
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (context: any) => {
                const val = Number(context.parsed.y || 0).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 2 },
                );

                const raw = String(context.dataset.label || "");

                const isDownload =
                  raw.endsWith("↓") || /\(Download\)$/i.test(raw);
                const isUpload = raw.endsWith("↑") || /\(Upload\)$/i.test(raw);

                const name = raw
                  .replace(/\s*[↓↑]$/, "")
                  .replace(/\s*\((Download|Upload)\)$/i, "");

                const dir = isDownload ? "Download" : isUpload ? "Upload" : "";

                const label = dir ? `${name} (${dir})` : raw;

                return `${label}: ${val} Mbps`;
              },
            },
          },
        },
        scales: {
          y: {
            position: "right",
            beginAtZero: true,
            ticks: {
              callback: (value: any) => {
                return `${Number(value).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })} Mbps`;
              },
            },
            max: maxThroughput,
          },
          x: {
            display: false,
            ticks: {
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 0,
              callback: (index: number) => {
                const time = (this as any).labels[index];
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
      } as any,
      data: this.chartData,
    };
  },
  methods: {
    hex2rgba(hex: string, alpha: number = 1) {
      const [r, g, b] = hex.match(/\w\w/g)!.map((x: string) => parseInt(x, 16));
      return `rgba(${r},${g},${b},${alpha})`;
    },
  },
  computed: {
    chartData() {
      const metricsArr: any[] = Array.isArray(this.metrics)
        ? (this.metrics as any[])
        : [];

      // Collect all nic names across all ticks
      const nicNameSet = new Set<string>();
      metricsArr.forEach((metric: any) => {
        const nics = Array.isArray(metric.nics) ? metric.nics : [];
        nics.forEach((nic: any) => {
          const name = nic?.name || "unknown";
          nicNameSet.add(name);
        });
      });
      const nicNames = Array.from(nicNameSet).sort((a, b) => {
        if (a === "tailscale0" && b !== "tailscale0") return -1;
        if (b === "tailscale0" && a !== "tailscale0") return 1;
        return a.localeCompare(b);
      });

      const colorForIndex = (i: number) =>
        NETWORK_USAGE_CHART_COLORS[i % NETWORK_USAGE_CHART_COLORS.length];

      const datasets = nicNames.flatMap((name, idx) => {
        const color = colorForIndex(idx);
        const download = {
          label: `${name} ↓`,
          fill: false,
          borderColor: this.hex2rgba(color),
          backgroundColor: this.hex2rgba(color, 0.15),
          data: metricsArr.map((metric: any) => {
            const nics = Array.isArray(metric.nics) ? metric.nics : [];
            const totalRxBytes = nics
              .filter((n: any) => (n?.name || "unknown") === name)
              .reduce((sum: number, n: any) => sum + (n?.rx || 0), 0);
            const mbps = (totalRxBytes * 8) / 1_000_000;
            return Number(mbps.toFixed(2));
          }),
          spanGaps: true,
        } as any;
        const upload = {
          label: `${name} ↑`,
          fill: false,
          borderColor: this.hex2rgba(color, 1),
          backgroundColor: this.hex2rgba(color, 0.15),
          borderDash: [6, 4],
          data: metricsArr.map((metric: any) => {
            const nics = Array.isArray(metric.nics) ? metric.nics : [];
            const totalTxBytes = nics
              .filter((n: any) => (n?.name || "unknown") === name)
              .reduce((sum: number, n: any) => sum + (n?.tx || 0), 0);
            const mbps = (totalTxBytes * 8) / 1_000_000;
            return Number(mbps.toFixed(2));
          }),
          spanGaps: true,
        } as any;
        return [download, upload];
      });

      return {
        labels: this.labels,
        datasets,
      };
    },
    labels() {
      return (Array.isArray(this.metrics) ? this.metrics : []).map(
        (metric: any) => {
          return new Date(metric.time);
        },
      );
    },
  },
};
</script>
