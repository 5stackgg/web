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
import { DISK_USAGE_CHART_COLORS } from "@/utilities/chartColors";
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

    // Y-axis max: take the FIRST sample's (used + available) per mount
    let maxGb = 0;
    if (metricsArr.length > 0) {
      const first = metricsArr[0];
      const disks = Array.isArray(first?.disks) ? first.disks : [];
      const byMount: Record<string, { used: number; available: number }> =
        {} as any;
      disks.forEach((d: any) => {
        const mount = d?.mountpoint || "unknown";
        const used = Number(d?.used || 0);
        const available = Number(d?.available || 0);
        if (!byMount[mount]) byMount[mount] = { used: 0, available: 0 };
        byMount[mount].used += used;
        byMount[mount].available += available;
      });
      Object.values(byMount).forEach(({ used, available }) => {
        // values are in 1024-byte blocks → GiB = blocks / 1,048,576
        const totalGb = (used + available) / 1_048_576;
        if (totalGb > maxGb) maxGb = totalGb;
      });
    }
    const yMax = Math.ceil(Math.max(maxGb, 1) * 1.2);

    return {
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: {
              usePointStyle: true,
              boxWidth: 10,
              boxHeight: 6,
              padding: 8,
              // Show only OS and Demos (hide Total and other mounts)
              filter: (item: any, data: any) => {
                const ds = data?.datasets?.[item.datasetIndex];
                const label = String(ds?.label || "");
                if (/ Total$/.test(label)) return false;
                const base = label.replace(/\s+(Used|Available)$/i, "");
                return base === "OS" || base === "Demos";
              },
            },
          },
          tooltip: {
            // Hide "Total" datasets from tooltip as well
            filter: (item: any) => {
              const label = String(item?.dataset?.label || "");
              return !/ Total$/.test(label);
            },
            callbacks: {
              label: (context: any) => {
                const usedGiB = Number(context.parsed.y || 0);
                const val = usedGiB.toLocaleString();

                const raw = String(context.dataset.label || "");
                const base = raw.replace(/\s+(Used|Available)$/i, "");

                // Append percent of Total
                let percent = "";
                try {
                  const dataIndex = context.dataIndex;
                  const expectedTotalLabel = `${base} Total`;
                  const datasets = context?.chart?.data?.datasets || [];
                  const totalDs: any = datasets.find(
                    (ds: any) => String(ds?.label || "") === expectedTotalLabel,
                  );
                  const totalGiBVal = Number(
                    Array.isArray(totalDs?.data)
                      ? totalDs.data[dataIndex]
                      : NaN,
                  );
                  if (Number.isFinite(totalGiBVal) && totalGiBVal > 0) {
                    const p = (usedGiB / totalGiBVal) * 100;
                    percent = ` (${p.toFixed(1)}%)`;
                  }
                } catch {}

                return `${base}: ${val} GiB${percent}`;
              },
            },
          },
        },
        scales: {
          y: {
            position: "right",
            beginAtZero: true,
            ticks: {
              callback: (value: any) => `${Number(value).toLocaleString()} GiB`,
            },
            max: yMax,
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
      const match = hex.match(/\w\w/g);
      if (!match) return `rgba(59,130,246,${alpha})`;
      const [r, g, b] = match.map((x: string) => parseInt(x, 16));
      return `rgba(${r},${g},${b},${alpha})`;
    },
    formatMountName(mount: string) {
      if (mount === "/") return "OS";
      if (mount === "/demos") return "Demos";
      return mount;
    },
  },
  computed: {
    chartData() {
      const metricsArr: any[] = Array.isArray(this.metrics)
        ? (this.metrics as any[])
        : [];

      // Collect all mount points across all ticks
      const mountSet = new Set<string>();
      metricsArr.forEach((point: any) => {
        const disks = Array.isArray(point.disks) ? point.disks : [];
        disks.forEach((d: any) => {
          const mount = d?.mountpoint || "unknown";
          mountSet.add(mount);
        });
      });
      const mounts = Array.from(mountSet).sort();

      const colorForIndex = (i: number) =>
        DISK_USAGE_CHART_COLORS[i % DISK_USAGE_CHART_COLORS.length];

      const toGb = (bytes: number) => Number((bytes / 1_048_576).toFixed(2));

      const datasets = mounts.flatMap((mount, idx) => {
        const color = colorForIndex(idx);

        let totalBytesForMount = 0;
        if (metricsArr.length > 0) {
          const lastPoint = metricsArr[metricsArr.length - 1];
          const disks = Array.isArray(lastPoint?.disks) ? lastPoint.disks : [];

          totalBytesForMount = disks
            .filter((d: any) => (d?.mountpoint || "unknown") === mount)
            .reduce((sum: number, d: any) => sum + Number(d?.size || 0), 0);
        }

        const totalConstGb = toGb(totalBytesForMount);
        const label = this.formatMountName(mount);
        const used = {
          label,
          fill: true,
          borderColor: this.hex2rgba(color, 1),
          backgroundColor: this.hex2rgba(color, 0.15),
          pointRadius: 0,
          tension: 0.3,
          data: metricsArr.map((point: any) => {
            const disks = Array.isArray(point.disks) ? point.disks : [];
            const totalUsedBytes = disks
              .filter((d: any) => (d?.mountpoint || "unknown") === mount)
              .reduce((sum: number, d: any) => sum + Number(d?.used || 0), 0);
            return toGb(totalUsedBytes);
          }),
          spanGaps: true,
        } as any;
        const total = {
          label: `${label} Total`,
          fill: false,
          borderColor: this.hex2rgba(color, 0.75),
          backgroundColor: this.hex2rgba("#9ca3af", 0.2),
          borderDash: idx % 2 === 0 ? [2, 2] : [6, 3],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          data: metricsArr.map(() => totalConstGb),
          spanGaps: true,
        } as any;
        return [used, total];
      });

      return {
        labels: this.labels,
        datasets,
      };
    },
    labels() {
      return (Array.isArray(this.metrics) ? this.metrics : []).map(
        (metric: any) => new Date(metric.time),
      );
    },
  },
};
</script>
