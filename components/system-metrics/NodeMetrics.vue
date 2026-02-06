<script lang="ts" setup>
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import NetworkChart from "~/components/charts/NetworkChart.vue";
import DiskChart from "~/components/charts/DiskChart.vue";
import { Card } from "@/components/ui/card";
import Empty from "@/components/ui/empty/Empty.vue";
import { BarChart3 } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <div class="my-2">
    <!-- Metrics Charts -->
    <PageTransition v-if="metricsData && showCharts">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <PageTransition :delay="0">
          <Card class="p-4 rounded-lg border border-gray-200">
            <h4 class="text-sm font-medium mb-2">
              {{ $t("pages.system_metrics.cpu_usage") }}
            </h4>
            <div class="h-[350px]">
              <CpuChart :metrics="metricsData.cpu" />
            </div>
          </Card>
        </PageTransition>

        <PageTransition :delay="100">
          <Card class="p-4 rounded-lg border border-gray-200">
            <h4 class="text-sm font-medium mb-2">
              {{ $t("pages.system_metrics.memory_usage") }}
            </h4>
            <div class="h-[350px]">
              <MemoryChart :metrics="metricsData.memory" />
            </div>
          </Card>
        </PageTransition>

        <PageTransition :delay="200">
          <Card class="p-4 rounded-lg border border-gray-200">
            <h4 class="text-sm font-medium mb-2">
              {{ $t("pages.system_metrics.network") }}
            </h4>
            <div class="h-[350px]">
              <NetworkChart :metrics="metricsData.network" />
            </div>
          </Card>
        </PageTransition>

        <PageTransition :delay="300">
          <Card class="p-4 rounded-lg border border-gray-200">
            <h4 class="text-sm font-medium mb-2">Disks</h4>
            <div class="h-[350px]">
              <DiskChart :metrics="metricsData.disks" />
            </div>
          </Card>
        </PageTransition>
      </div>
    </PageTransition>

    <!-- Empty State -->
    <PageTransition v-else>
      <Empty class="my-8">
        <div class="flex flex-col items-center gap-4">
          <div class="rounded-full bg-muted p-4">
            <BarChart3 class="h-8 w-8 text-muted-foreground" />
          </div>
          <div class="space-y-1">
            <h3 class="font-semibold text-lg">No Metrics Available</h3>
            <p class="text-sm text-muted-foreground max-w-md">
              {{
                metricsData === null
                  ? "Loading metrics data..."
                  : "No metrics data available for this node yet. Metrics will appear once the node starts reporting data."
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
