<script lang="ts" setup>
// imports only; state is managed in the options API script below
import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
</script>

<template>
  <div v-if="metricsData" class="grid grid-cols-3 gap-3 text-xs mt-2">
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">
          {{ $t("pages.system_metrics.cpu_usage") }}
        </span>
        <span>{{ latestCpuUsage }}%</span>
      </div>
      <div class="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          class="h-full rounded-full bg-primary"
          :style="{ width: `${latestCpuUsage}%` }"
        />
      </div>
    </div>

    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground"> Disks </span>
        <span>{{ latestDiskUsage }}%</span>
      </div>
      <div class="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          class="h-full rounded-full bg-primary/60"
          :style="{ width: `${latestDiskUsage}%` }"
        />
      </div>
    </div>

    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">
          {{ $t("pages.system_metrics.network") }}
        </span>
        <span>{{ latestNetworkUsage }} Mbps</span>
      </div>
      <div class="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          class="h-full rounded-full bg-primary/40"
          :style="{ width: `${Math.min(latestNetworkUsage, 100)}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    nodeId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      metricsData: null as any | null,
    };
  },
  computed: {
    latestCpuUsage(): number {
      if (!this.metricsData?.cpu?.length) return 0;
      const last = this.metricsData.cpu[this.metricsData.cpu.length - 1];
      if (!last || !last.total || !last.used) return 0;
      const coresUsed = last.used / 1_000_000_000;
      const usedPercent = (coresUsed * 100) / last.total;
      return Math.round(Math.min(100, Math.max(0, usedPercent)));
    },
    latestDiskUsage(): number {
      if (!this.metricsData?.disks?.length) return 0;
      const last = this.metricsData.disks[this.metricsData.disks.length - 1];
      if (!last?.disks?.length) return 0;
      const maxUsed = last.disks.reduce((max: number, disk: any) => {
        let value = Number(disk.usedPercent);
        if (!Number.isFinite(value)) {
          if (disk.size && disk.used) {
            value = (Number(disk.used) / Number(disk.size)) * 100;
          } else {
            value = 0;
          }
        }
        return Math.max(max, value);
      }, 0);
      return Math.round(Math.min(100, Math.max(0, maxUsed)));
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
      },
    },
  },
};
</script>
