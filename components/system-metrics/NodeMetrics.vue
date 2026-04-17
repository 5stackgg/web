<script lang="ts" setup>
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import NetworkChart from "~/components/charts/NetworkChart.vue";
import DiskChart from "~/components/charts/DiskChart.vue";
import { Card } from "@/components/ui/card";
import Empty from "@/components/ui/empty/Empty.vue";
import {
  Activity,
  BarChart3,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
} from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <div class="my-2">
    <!-- Metrics Charts -->
    <PageTransition v-if="metricsData && showCharts">
      <div class="rounded-2xl border border-border/60 bg-muted/10 p-4 sm:p-5">
        <div
          class="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div class="space-y-1">
            <div
              class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
            >
              <Activity class="h-3.5 w-3.5" />
              Live performance timeline
            </div>
            <h3 class="text-base font-semibold">
              {{ $t("system_metrics.node_telemetry") }}
            </h3>
            <p class="max-w-2xl text-xs text-muted-foreground">
              CPU and memory stay front and center, with network and disk
              history grouped underneath for deeper inspection.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:min-w-[32rem]">
            <div
              class="rounded-xl border border-border/50 bg-background/50 px-3 py-2.5"
            >
              <div
                class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                <Cpu class="h-3.5 w-3.5" />
                CPU
              </div>
              <div class="mt-2 text-lg font-semibold tabular-nums">
                {{ latestCpuUsage }}%
              </div>
            </div>
            <div
              class="rounded-xl border border-border/50 bg-background/50 px-3 py-2.5"
            >
              <div
                class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                <MemoryStick class="h-3.5 w-3.5" />
                Memory
              </div>
              <div
                class="mt-2 text-[13px] font-medium tabular-nums leading-snug"
              >
                {{ memoryUsageDisplay }}
              </div>
            </div>
            <div
              class="rounded-xl border border-border/50 bg-background/50 px-3 py-2.5"
            >
              <div
                class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                <Network class="h-3.5 w-3.5" />
                Network
              </div>
              <div class="mt-2 text-lg font-semibold tabular-nums">
                {{ networkUsageDisplay }}
              </div>
            </div>
            <div
              class="rounded-xl border border-border/50 bg-background/50 px-3 py-2.5"
            >
              <div
                class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                <HardDrive class="h-3.5 w-3.5" />
                Disk
              </div>
              <div
                class="mt-2 text-[13px] font-medium tabular-nums leading-snug"
              >
                {{ diskUsageDisplay }}
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <PageTransition :delay="0" class="xl:col-span-6">
            <Card
              class="rounded-2xl border border-border/60 bg-background/40 p-4"
            >
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h4 class="text-sm font-semibold">
                    {{ $t("pages.system_metrics.cpu_usage") }}
                  </h4>
                  <p class="text-xs text-muted-foreground">
                    Processor pressure over the last polling window.
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-xl font-semibold tabular-nums">
                    {{ latestCpuUsage }}%
                  </div>
                  <div
                    class="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    current
                  </div>
                </div>
              </div>
              <div class="h-[320px]">
                <CpuChart :metrics="metricsData.cpu" />
              </div>
            </Card>
          </PageTransition>

          <PageTransition :delay="100" class="xl:col-span-6">
            <Card
              class="rounded-2xl border border-border/60 bg-background/40 p-4"
            >
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h4 class="text-sm font-semibold">
                    {{ $t("pages.system_metrics.memory_usage") }}
                  </h4>
                  <p class="text-xs text-muted-foreground">
                    Working set usage compared against installed capacity.
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-[13px] font-semibold tabular-nums">
                    {{ memoryUsageDisplay }}
                  </div>
                  <div
                    class="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    {{ latestMemoryUsage }}% used
                  </div>
                </div>
              </div>
              <div class="h-[320px]">
                <MemoryChart :metrics="metricsData.memory" />
              </div>
            </Card>
          </PageTransition>

          <PageTransition :delay="200" class="xl:col-span-6">
            <Card
              class="rounded-2xl border border-border/60 bg-background/40 p-4"
            >
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h4 class="text-sm font-semibold">
                    {{ $t("pages.system_metrics.network") }}
                  </h4>
                  <p class="text-xs text-muted-foreground">
                    Combined receive and transmit throughput across interfaces.
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-xl font-semibold tabular-nums">
                    {{ networkUsageDisplay }}
                  </div>
                  <div
                    class="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    current
                  </div>
                </div>
              </div>
              <div class="h-[240px]">
                <NetworkChart :metrics="metricsData.network" />
              </div>
            </Card>
          </PageTransition>

          <PageTransition :delay="300" class="xl:col-span-6">
            <Card
              class="rounded-2xl border border-border/60 bg-background/40 p-4"
            >
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h4 class="text-sm font-semibold">
                    {{ $t("game_server.disks_label") }}
                  </h4>
                  <p class="text-xs text-muted-foreground">
                    Highest-utilization disk view with underlying timeline.
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-[13px] font-semibold tabular-nums">
                    {{ diskUsageDisplay }}
                  </div>
                  <div
                    class="text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    {{ latestDiskUsage }}% used
                  </div>
                </div>
              </div>
              <div class="h-[240px]">
                <DiskChart :metrics="metricsData.disks" />
              </div>
            </Card>
          </PageTransition>
        </div>
      </div>
    </PageTransition>

    <!-- Empty State -->
    <PageTransition v-else>
      <Empty class="my-8 rounded-2xl border border-border/60 bg-muted/10 py-8">
        <div class="flex flex-col items-center gap-4">
          <div class="rounded-full bg-muted p-4">
            <BarChart3 class="h-8 w-8 text-muted-foreground" />
          </div>
          <div class="space-y-1">
            <h3 class="font-semibold text-lg">
              {{ $t("system_metrics.no_metrics_available") }}
            </h3>
            <p class="text-sm text-muted-foreground max-w-md">
              {{
                metricsData === null
                  ? $t("system_metrics.loading_metrics")
                  : $t("system_metrics.no_metrics_description")
              }}
            </p>
          </div>
        </div>
      </Empty>
    </PageTransition>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { formatUsedOverTotalBytes } from "~/utilities/formatResourceUsage";
export default {
  props: {
    gameServerNode: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      metricsData: null,
    };
  },
  computed: {
    diskWithMaxPercent(): any | null {
      if (!this.metricsData?.disks?.length) {
        return null;
      }
      const last = this.metricsData.disks[this.metricsData.disks.length - 1];
      if (!last?.disks?.length) {
        return null;
      }

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
    showCharts(): boolean {
      if (!this.metricsData) {
        return false;
      }

      const { cpu, memory, network, disks } = this.metricsData;
      if (!cpu || !memory || !network || !disks) {
        return false;
      }

      return (
        cpu.length > 0 ||
        memory.length > 0 ||
        network.length > 0 ||
        disks.length > 0
      );
    },
    latestCpuUsage(): number {
      if (!this.metricsData || !this.metricsData.cpu?.length) {
        return 0;
      }
      const last = this.metricsData.cpu[this.metricsData.cpu.length - 1];
      if (!last || !last.total || !last.used) {
        return 0;
      }
      const coresUsed = last.used / 1_000_000_000;
      const usedPercent = (coresUsed * 100) / last.total;
      return Math.round(Math.min(100, Math.max(0, usedPercent)));
    },
    latestMemoryUsage(): number {
      if (!this.metricsData?.memory?.length) {
        return 0;
      }
      const last = this.metricsData.memory[this.metricsData.memory.length - 1];
      if (!last?.total) {
        return 0;
      }
      const usedPercent = (Number(last.used || 0) / Number(last.total)) * 100;
      return Math.round(Math.min(100, Math.max(0, usedPercent)));
    },
    memoryUsageDisplay(): string {
      if (!this.metricsData?.memory?.length) {
        return "—";
      }
      const last = this.metricsData.memory[this.metricsData.memory.length - 1];
      if (!last?.total) {
        return "—";
      }
      return formatUsedOverTotalBytes(
        Number(last.used || 0),
        Number(last.total),
      );
    },
    latestDiskUsage(): number {
      const disk = this.diskWithMaxPercent;
      if (!disk) {
        return 0;
      }
      let value = Number(disk.usedPercent);
      if (!Number.isFinite(value)) {
        if (disk.size && disk.used) {
          value = (Number(disk.used) / Number(disk.size)) * 100;
        } else {
          value = 0;
        }
      }
      return Math.round(Math.min(100, Math.max(0, value)));
    },
    diskUsageDisplay(): string {
      const disk = this.diskWithMaxPercent;
      if (!disk?.size) {
        return "—";
      }
      return formatUsedOverTotalBytes(
        Number(disk.used || 0),
        Number(disk.size),
      );
    },
    latestNetworkUsage(): number {
      if (!this.metricsData || !this.metricsData.network?.length) {
        return 0;
      }
      const last =
        this.metricsData.network[this.metricsData.network.length - 1];
      if (!last?.nics || !last.nics.length) {
        return 0;
      }
      const totalBytesPerSec = last.nics.reduce(
        (sum: number, nic: any) => sum + (nic.rx || 0) + (nic.tx || 0),
        0,
      );
      const mbPerSec = totalBytesPerSec / 1_000_000;
      return Math.round(Math.max(0, mbPerSec));
    },
    networkUsageDisplay(): string {
      return `${this.latestNetworkUsage} MB/s`;
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
      variables: function () {
        return {
          node: this.gameServerNode.id,
        };
      },
      result: function ({ data }) {
        this.metricsData = data.getNodeStats;
      },
    },
  },
};
</script>
