<script lang="ts" setup>
import GpuMetrics from "~/components/system-metrics/GpuMetrics.vue";
import { Microchip, MemoryStick } from "lucide-vue-next";
</script>

<template>
  <div v-if="metricsData?.gpu?.length">
    <div
      v-if="showLabel"
      class="mb-2 flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
    >
      <span class="truncate">{{ nodeLabel || nodeId }}</span>
    </div>

    <div v-if="showQuickStats" class="grid gap-3 sm:grid-cols-2">
      <div>
        <div
          class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span class="flex items-center gap-1.5">
            <Microchip class="h-3 w-3" />
            GPU
          </span>
          <span
            class="font-bold tabular-nums"
            :class="{
              'text-destructive': utilStatus === 'critical',
              'text-[hsl(var(--tac-amber))]': utilStatus === 'warning',
              'text-foreground': utilStatus === 'normal',
            }"
          >
            {{ String(latestUtilization).padStart(2, "0") }}%
          </span>
        </div>
        <div class="mt-2 flex h-2 gap-[2px]">
          <span
            v-for="i in 10"
            :key="`gpu-util-${i}`"
            class="flex-1"
            :class="
              i > Math.ceil(latestUtilization / 10)
                ? 'bg-border/30'
                : latestUtilization >= 85
                  ? 'bg-destructive'
                  : latestUtilization >= 70
                    ? 'bg-[hsl(var(--tac-amber))]'
                    : 'bg-emerald-500/90'
            "
          />
        </div>
      </div>

      <div>
        <div
          class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span class="flex items-center gap-1.5">
            <MemoryStick class="h-3 w-3" />
            VRAM
          </span>
          <span class="font-bold tabular-nums text-foreground">
            {{ String(latestMemoryPercent).padStart(2, "0") }}%
          </span>
        </div>
        <div class="mt-2 flex h-2 gap-[2px]">
          <span
            v-for="i in 10"
            :key="`gpu-mem-${i}`"
            class="flex-1"
            :class="
              i > Math.ceil(latestMemoryPercent / 10)
                ? 'bg-border/30'
                : latestMemoryPercent >= 85
                  ? 'bg-destructive/90'
                  : 'bg-[hsl(var(--tac-amber)/0.7)]'
            "
          />
        </div>
        <div
          class="mt-1.5 truncate font-mono text-[10px] tabular-nums text-muted-foreground"
        >
          {{ memoryUsageLabel }}
        </div>
      </div>
    </div>

    <div v-if="showCharts" :class="showQuickStats ? 'mt-4' : ''">
      <GpuMetrics :metrics="metricsData.gpu" :compact-charts="compactCharts" />
    </div>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

export default {
  components: { GpuMetrics },
  props: {
    nodeId: {
      type: String,
      required: true,
    },
    nodeLabel: {
      type: String,
      default: "",
    },
    compactCharts: {
      type: Boolean,
      default: false,
    },
    showLabel: {
      type: Boolean,
      default: true,
    },
    showQuickStats: {
      type: Boolean,
      default: false,
    },
    showCharts: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      metricsData: { gpu: [] } as any,
    };
  },
  computed: {
    latestSnapshot(): any | null {
      const list = this.metricsData?.gpu ?? [];
      if (!list.length) return null;
      const last = list[list.length - 1];
      if (!last?.devices?.length) return null;
      return last;
    },
    latestUtilization(): number {
      const snapshot = this.latestSnapshot;
      if (!snapshot) return 0;
      const values = snapshot.devices
        .map((d: any) => d.utilization_percent)
        .filter((v: any) => typeof v === "number");
      if (!values.length) return 0;
      return Math.round(
        values.reduce((sum: number, v: number) => sum + v, 0) / values.length,
      );
    },
    memoryTotals(): { used: number; total: number } {
      const snapshot = this.latestSnapshot;
      if (!snapshot) return { used: 0, total: 0 };
      let used = 0;
      let total = 0;
      for (const d of snapshot.devices as any[]) {
        if (typeof d.memory_mb === "number") total += d.memory_mb;
        if (typeof d.memory_used_mb === "number") used += d.memory_used_mb;
      }
      return { used, total };
    },
    latestMemoryPercent(): number {
      const { used, total } = this.memoryTotals;
      if (!total) return 0;
      return Math.round(Math.min(100, Math.max(0, (used / total) * 100)));
    },
    memoryUsageLabel(): string {
      const { used, total } = this.memoryTotals;
      if (!total) return "—";
      if (total >= 1024) {
        return `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} GB`;
      }
      return `${used} / ${total} MB`;
    },
    utilStatus(): "normal" | "warning" | "critical" {
      if (this.latestUtilization >= 90) return "critical";
      if (this.latestUtilization >= 75) return "warning";
      return "normal";
    },
  },
  apollo: {
    getNodeStats: {
      query: generateQuery({
        getNodeStats: [
          { node: $("node", "String!") },
          {
            node: true,
            gpu: [
              {},
              {
                time: true,
                devices: {
                  index: true,
                  name: true,
                  memory_mb: true,
                  memory_used_mb: true,
                  temperature_c: true,
                  power_w: true,
                  utilization_percent: true,
                },
              },
            ],
          },
        ],
      }),
      pollInterval: 15 * 1000,
      variables(this: any) {
        return { node: this.nodeId };
      },
      result(this: any, { data }: any) {
        this.metricsData = data?.getNodeStats ?? { gpu: [] };
      },
    },
  },
};
</script>
