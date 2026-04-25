<script lang="ts" setup>
import { Microchip } from "lucide-vue-next";
import { Card } from "@/components/ui/card";
import GpuChart from "~/components/charts/GpuChart.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <div v-if="hasMetrics" class="grid grid-cols-1 gap-4" :class="gridClass">
    <PageTransition :delay="0" :class="columnClass">
      <Card class="rounded-2xl border border-border/60 bg-background/40 p-4">
        <div class="mb-3 flex h-9 items-center justify-between gap-3">
          <h4 class="flex items-center gap-2 text-sm font-semibold">
            <Microchip class="h-4 w-4" />
            GPU usage
          </h4>
          <div class="text-right text-xl font-semibold tabular-nums">
            {{ latestUtilization }}%
          </div>
        </div>
        <div :class="chartHeightClass">
          <GpuChart :metrics="metrics" mode="utilization" />
        </div>
      </Card>
    </PageTransition>

    <PageTransition :delay="100" :class="columnClass">
      <Card class="rounded-2xl border border-border/60 bg-background/40 p-4">
        <div class="mb-3 flex h-9 items-center justify-between gap-3">
          <h4 class="flex items-center gap-2 text-sm font-semibold">
            <Microchip class="h-4 w-4" />
            GPU VRAM Usage
          </h4>
          <div class="text-right text-[13px] font-semibold tabular-nums">
            {{ memoryDisplay }}
          </div>
        </div>
        <div :class="chartHeightClass">
          <GpuChart :metrics="metrics" mode="memory" />
        </div>
      </Card>
    </PageTransition>
  </div>
</template>

<script lang="ts">
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
  props: {
    metrics: {
      type: Array as () => GpuStatsEntry[],
      default: () => [],
    },
    compactCharts: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    latestSnapshot(): GpuStatsEntry | null {
      if (!this.metrics?.length) return null;
      const last = this.metrics[this.metrics.length - 1];
      if (!last?.devices?.length) return null;
      return last;
    },
    hasMetrics(): boolean {
      return Boolean(this.latestSnapshot);
    },
    latestDevices(): GpuDeviceStat[] {
      return this.latestSnapshot?.devices ?? [];
    },
    latestUtilization(): number {
      const values = this.latestDevices
        .map((d) => d.utilization_percent)
        .filter((v): v is number => typeof v === "number");
      if (!values.length) return 0;
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    },
    memoryTotals(): { used: number; total: number } {
      let used = 0;
      let total = 0;
      for (const d of this.latestDevices) {
        if (typeof d.memory_mb === "number") total += d.memory_mb;
        if (typeof d.memory_used_mb === "number") used += d.memory_used_mb;
      }
      return { used, total };
    },
    memoryDisplay(): string {
      const { used, total } = this.memoryTotals;
      if (!total) return "—";
      if (total >= 1024) {
        return `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} GB`;
      }
      return `${used} / ${total} MB`;
    },
    gridClass(): string {
      return this.compactCharts ? "xl:grid-cols-4" : "xl:grid-cols-12";
    },
    columnClass(): string {
      return this.compactCharts ? "" : "xl:col-span-6";
    },
    chartHeightClass(): string {
      return this.compactCharts ? "h-[220px]" : "h-[320px]";
    },
  },
};
</script>
