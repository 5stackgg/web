<script lang="ts" setup>
// imports only; state is managed in the options API script below
import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { Cpu, MemoryStick, HardDrive, Network } from "lucide-vue-next";
</script>

<template>
  <div
    v-if="metricsData"
    class="mt-2 rounded-2xl border border-border/60 bg-muted/10 p-2.5 sm:p-3"
  >
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div
        class="min-w-0 rounded-xl border border-border/50 bg-background/40 px-3 py-3"
      >
        <div
          class="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          <span class="flex items-center gap-2 min-w-0">
            <Cpu class="h-3.5 w-3.5 shrink-0" />
            {{ $t("pages.system_metrics.cpu_short") }}
          </span>
          <span class="truncate">{{ cpuStateLabel }}</span>
        </div>
        <div class="mt-3 flex items-end justify-between gap-3">
          <div class="text-lg font-semibold tabular-nums">
            {{ latestCpuUsage }}%
          </div>
          <div class="text-[11px] text-muted-foreground">current load</div>
        </div>
        <div class="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            class="h-full rounded-full bg-primary"
            :style="{ width: `${latestCpuUsage}%` }"
          />
        </div>
      </div>

      <div
        class="min-w-0 rounded-xl border border-border/50 bg-background/40 px-3 py-3"
      >
        <div
          class="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          <span class="flex items-center gap-2 min-w-0">
            <MemoryStick class="h-3.5 w-3.5 shrink-0" />
            {{ $t("pages.system_metrics.memory_short") }}
          </span>
          <span class="truncate">{{ latestMemoryUsage }}% used</span>
        </div>
        <div
          class="mt-3 text-[12px] sm:text-[13px] font-medium tabular-nums leading-snug break-words"
        >
          {{ memoryUsageDisplay }}
        </div>
        <div class="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            class="h-full rounded-full bg-primary/80"
            :style="{ width: `${latestMemoryUsage}%` }"
          />
        </div>
      </div>

      <div
        class="min-w-0 rounded-xl border border-border/50 bg-background/40 px-3 py-3"
      >
        <div
          class="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          <span class="flex items-center gap-2 min-w-0">
            <HardDrive class="h-3.5 w-3.5 shrink-0" />
            {{ $t("pages.system_metrics.disk_short") }}
          </span>
          <span class="truncate">{{ diskLabel }}</span>
        </div>
        <div
          class="mt-3 text-[12px] sm:text-[13px] font-medium tabular-nums leading-snug break-words"
        >
          {{ diskUsageDisplay }}
        </div>
        <div class="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            class="h-full rounded-full bg-primary/60"
            :style="{ width: `${latestDiskUsage}%` }"
          />
        </div>
      </div>

      <div
        class="min-w-0 rounded-xl border border-border/50 bg-background/40 px-3 py-3"
      >
        <div
          class="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          <span class="flex items-center gap-2 min-w-0">
            <Network class="h-3.5 w-3.5 shrink-0" />
            {{ $t("pages.system_metrics.network_short") }}
          </span>
          <span class="truncate">aggregate</span>
        </div>
        <div class="mt-3 flex items-end justify-between gap-3">
          <div class="text-lg font-semibold tabular-nums">
            {{ networkUsageDisplay }}
          </div>
          <div class="text-[11px] text-muted-foreground">rx + tx</div>
        </div>
        <div class="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            class="h-full rounded-full bg-primary/40"
            :style="{ width: `${Math.min(latestNetworkUsage, 100)}%` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { formatUsedOverTotalBytes } from "~/utilities/formatResourceUsage";

export default {
  props: {
    nodeId: {
      type: String,
      required: true,
    },
  },
  emits: ["update-latest-metrics"],
  data() {
    return {
      metricsData: null as any | null,
    };
  },
  computed: {
    cpuStateLabel(): string {
      if (this.latestCpuUsage >= 90) return "critical";
      if (this.latestCpuUsage >= 75) return "elevated";
      return "stable";
    },
    diskWithMaxPercent(): any | null {
      if (!this.metricsData?.disks?.length) return null;
      const last = this.metricsData.disks[this.metricsData.disks.length - 1];
      if (!last?.disks?.length) return null;
      let best: any = null;
      let bestPct = -1;
      for (const disk of last.disks) {
        let value = Number(disk.usedPercent);
        if (!Number.isFinite(value)) {
          if (disk.size && disk.used) {
            value = (Number(disk.used) / Number(disk.size)) * 100;
          } else {
            value = 0;
          }
        }
        if (value > bestPct) {
          bestPct = value;
          best = disk;
        }
      }
      return best;
    },
    memoryUsageDisplay(): string {
      if (!this.metricsData?.memory?.length) return "—";
      const last = this.metricsData.memory[this.metricsData.memory.length - 1];
      if (!last || !last.total) return "—";
      return formatUsedOverTotalBytes(
        Number(last.used || 0),
        Number(last.total),
      );
    },
    diskUsageDisplay(): string {
      const d = this.diskWithMaxPercent;
      if (!d || !Number(d.size)) return "—";
      return formatUsedOverTotalBytes(Number(d.used || 0), Number(d.size));
    },
    diskLabel(): string {
      const d = this.diskWithMaxPercent;
      if (!d) return "no disk data";
      return d.mountpoint || d.filesystem || "disk usage";
    },
    latestCpuUsage(): number {
      if (!this.metricsData?.cpu?.length) return 0;
      const last = this.metricsData.cpu[this.metricsData.cpu.length - 1];
      if (!last || !last.total || !last.used) return 0;
      const coresUsed = last.used / 1_000_000_000;
      const usedPercent = (coresUsed * 100) / last.total;
      return Math.round(Math.min(100, Math.max(0, usedPercent)));
    },
    latestMemoryUsage(): number {
      if (!this.metricsData?.memory?.length) return 0;
      const last = this.metricsData.memory[this.metricsData.memory.length - 1];
      if (!last || !last.total) return 0;
      const usedPercent = (last.used / last.total) * 100;
      return Math.round(Math.min(100, Math.max(0, usedPercent)));
    },
    latestDiskUsage(): number {
      const d = this.diskWithMaxPercent;
      if (!d) return 0;
      let value = Number(d.usedPercent);
      if (!Number.isFinite(value)) {
        if (d.size && d.used) {
          value = (Number(d.used) / Number(d.size)) * 100;
        } else {
          value = 0;
        }
      }
      return Math.round(Math.min(100, Math.max(0, value)));
    },
    latestNetworkUsage(): number {
      if (!this.metricsData?.network?.length) return 0;
      const last =
        this.metricsData.network[this.metricsData.network.length - 1];
      if (!last?.nics?.length) return 0;
      const totalBitsPerSec = last.nics.reduce(
        (sum: number, nic: any) => sum + ((nic.rx || 0) + (nic.tx || 0)) * 8,
        0,
      );
      const mbps = totalBitsPerSec / 1_000_000;
      return Number(Math.max(0, mbps).toFixed(1));
    },
    networkUsageDisplay(): string {
      return `${this.latestNetworkUsage} Mbps`;
    },
  },
  apollo: {
    getNodeStats: {
      query: generateQuery({
        getNodeStats: [
          {
            node: $("node", "String!"),
          },
          {
            node: true,
            cpu: [
              {},
              {
                time: true,
                total: true,
                used: true,
                window: true,
              },
            ],
            memory: [
              {},
              {
                time: true,
                total: true,
                used: true,
              },
            ],
            disks: [
              {},
              {
                time: true,
                disks: {
                  filesystem: true,
                  size: true,
                  used: true,
                  available: true,
                  usedPercent: true,
                  mountpoint: true,
                },
              },
            ],
            network: [
              {},
              {
                time: true,
                nics: {
                  name: true,
                  rx: true,
                  tx: true,
                },
              },
            ],
          },
        ],
      }),
      pollInterval: 30 * 1000,
      variables(this: any) {
        return {
          node: this.nodeId,
        };
      },
      result(this: any, { data }: any) {
        this.metricsData = data.getNodeStats;
        if (this.metricsData) {
          this.$emit("update-latest-metrics", {
            nodeId: this.nodeId,
            cpu: this.latestCpuUsage,
            memory: this.latestMemoryUsage,
          });
        }
      },
    },
  },
};
</script>
