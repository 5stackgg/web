<script setup lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import NodeMetrics from "@/components/system-metrics/NodeMetrics.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageTransition>
      <template
        v-for="gameServerNode in gameServerNodes"
        :key="gameServerNode.id"
      >
        <div class="flex items-center gap-2 mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            {{ $t("pages.system_metrics.node") }}:
            <template v-if="gameServerNode?.label">
              <span>{{ gameServerNode?.label }}</span>
              <span class="text-gray-500">({{ gameServerNode.id }})</span>
            </template>
            <template v-else>
              <span>{{ gameServerNode.id }}</span>
            </template>
          </h3>
          <div class="h-px flex-1 bg-gray-200"></div>
        </div>
        <NodeMetrics :game-server-node="gameServerNode" />
      </template>
    </PageTransition>

    <PageTransition :delay="100">
      <Separator :label="$t('pages.system_metrics.services')" class="my-8" />
    </PageTransition>

    <PageTransition :delay="200">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <template
          v-for="service in getServiceStats"
          :key="`${service.node}-${service.name}`"
        >
          <template v-if="hasServiceMetrics(service)">
            <AnimatedCard
              variant="gradient"
              class="p-4 rounded-lg border border-gray-200"
            >
              <div class="flex items-center gap-2 mb-4">
                <div class="text-lg font-semibold">
                  {{ service.name }}
                  <div class="text-xs text-gray-500">{{ service.node }}</div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <h4 class="text-sm font-medium mb-2">
                    {{ $t("pages.system_metrics.cpu_usage") }}
                  </h4>
                  <div class="h-[350px]">
                    <CpuChart :metrics="service.cpu" />
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-medium mb-2">
                    {{ $t("pages.system_metrics.memory_usage") }}
                  </h4>
                  <div class="h-[350px]">
                    <MemoryChart :metrics="service.memory" label="MB" />
                  </div>
                </div>
              </div>
            </AnimatedCard>
          </template>
        </template>
      </div>
    </PageTransition>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  data() {
    return {
      gameServerNodes: [],
    };
  },
  methods: {
    hasServiceMetrics(service: any): boolean {
      return service.cpu.length > 0 || service.memory.length > 0;
    },
  },
  apollo: {
    $subscribe: {
      game_server_nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {},
            {
              id: true,
              label: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.gameServerNodes = data.game_server_nodes;
        },
      },
    },
    getServiceStats: {
      query: generateQuery({
        getServiceStats: [
          {},
          {
            node: true,
            name: true,
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
          },
        ],
      }),
      pollInterval: 30 * 1000,
    },
  },
};
</script>
