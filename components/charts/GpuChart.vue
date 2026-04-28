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
import {
  CPU_USAGE_CHART_COLORS,
  MEMORY_USAGE_CHART_COLORS,
} from "@/utilities/chartColors";

type GpuDeviceStat = {
  index: number;
  name?: string;
  memory_mb?: number;
  memory_used_mb?: number;
  temperature_c?: number;
  power_w?: number;
  utilization_percent?: number;
};

type GpuStatsEntry = {
  time: string;
  devices: GpuDeviceStat[];
};

export default {
  components: { Line },
  props: {
    metrics: {
      type: Array as () => GpuStatsEntry[],
      required: true,
    },
    mode: {
      type: String as () => "utilization" | "memory",
      default: "utilization",
    },
  },
  data() {
    const usingMemory = this.mode === "memory";
    // Resolve the unit lazily so callbacks pick up the value
    // computed from `metrics` after props arrive. Reading
    // `this.memoryUnit` directly in data() captures it at component
    // construction, before computeds are initialised → undefined.
    const unit = () => (usingMemory ? this.memoryUnit : "%");
    return {
      // Defined once at mount so chart.js isn't reinitialized on every
      // poll. CpuChart / MemoryChart use the same pattern — the result
      // is a stable canvas that resizes with the container instead of
      // collapsing to a sub-region of it.
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index" as const,
            intersect: false,
            filter: (item: any) => {
              const label = String(item?.dataset?.label || "");
              return !label.endsWith(" Total");
            },
            callbacks: {
              label: (context: any) => {
                const value = context.parsed.y;
                if (value === null || value === undefined) {
                  return `${context.dataset.label}: —`;
                }
                return `${context.dataset.label}: ${value} ${unit()}`;
              },
            },
          },
        },
        scales: {
          y: {
            position: "right" as const,
            beginAtZero: true,
            ...(usingMemory ? {} : { max: 100 }),
            ticks: {
              callback: (value: number) => `${value} ${unit()}`,
            },
          },
          x: {
            display: false,
            ticks: {
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 0,
              callback: (index: number) => {
                const time = this.labels[index];
                if (!time) return "";
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
    };
  },
  computed: {
    deviceIndexes(): number[] {
      const seen = new Set<number>();
      for (const entry of this.metrics) {
        for (const device of entry.devices ?? []) {
          if (typeof device.index === "number") seen.add(device.index);
        }
      }
      return Array.from(seen).sort((a, b) => a - b);
    },
    deviceNames(): Record<number, string> {
      const out: Record<number, string> = {};
      for (const entry of this.metrics) {
        for (const device of entry.devices ?? []) {
          if (device.name && out[device.index] === undefined) {
            out[device.index] = device.name;
          }
        }
      }
      return out;
    },
    deviceCapacityMb(): Record<number, number> {
      const out: Record<number, number> = {};
      for (const entry of this.metrics) {
        for (const device of entry.devices ?? []) {
          if (
            typeof device.memory_mb === "number" &&
            out[device.index] === undefined
          ) {
            out[device.index] = device.memory_mb;
          }
        }
      }
      return out;
    },
    memoryUnit(): "MB" | "GB" {
      const max = Math.max(0, ...Object.values(this.deviceCapacityMb));
      return max >= 1024 ? "GB" : "MB";
    },
    memoryDivisor(): number {
      return this.memoryUnit === "GB" ? 1024 : 1;
    },
    labels(): Date[] {
      return this.metrics.map((entry) => new Date(entry.time));
    },
    chartData() {
      const datasets: any[] = [];
      const usingMemory = this.mode === "memory";
      const baseColor = usingMemory
        ? MEMORY_USAGE_CHART_COLORS[0]
        : CPU_USAGE_CHART_COLORS[0];
      const multipleDevices = this.deviceIndexes.length > 1;

      this.deviceIndexes.forEach((idx) => {
        const name = this.deviceNames[idx] ?? `GPU ${idx}`;

        if (usingMemory) {
          datasets.push({
            label: name,
            fill: !multipleDevices,
            borderColor: this.hex2rgba(baseColor),
            backgroundColor: this.hex2rgba(baseColor, 0.2),
            data: this.metrics.map((entry) => {
              const device = (entry.devices ?? []).find((d) => d.index === idx);
              if (device?.memory_used_mb === undefined) return null;
              return Number(
                (device.memory_used_mb / this.memoryDivisor).toFixed(2),
              );
            }),
          });

          const capacity = this.deviceCapacityMb[idx];
          if (capacity) {
            datasets.push({
              label: `${name} Total`,
              fill: false,
              borderColor: this.hex2rgba(baseColor, 0.75),
              backgroundColor: this.hex2rgba(baseColor, 0.2),
              borderDash: [2, 2],
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              spanGaps: true,
              data: this.metrics.map(() =>
                Number((capacity / this.memoryDivisor).toFixed(2)),
              ),
            });
          }
        } else {
          datasets.push({
            label: name,
            fill: !multipleDevices,
            borderColor: this.hex2rgba(baseColor),
            backgroundColor: this.hex2rgba(baseColor, 0.2),
            data: this.metrics.map((entry) => {
              const device = (entry.devices ?? []).find((d) => d.index === idx);
              return device?.utilization_percent ?? null;
            }),
          });
        }
      });

      return { labels: this.labels, datasets };
    },
  },
  methods: {
    hex2rgba(hex: string, alpha = 1) {
      const [r, g, b] = hex.match(/\w\w/g)!.map((x) => parseInt(x, 16));
      return `rgba(${r},${g},${b},${alpha})`;
    },
  },
};
</script>
