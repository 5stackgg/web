<script setup lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import Separator from "@/components/ui/separator/Separator.vue";
</script>

<template>
  <div>
    <div v-for="node in getNodeStats" :key="node.node" class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <h3 class="text-lg font-semibold">
          {{ $t("pages.system_metrics.node") }}: {{ node.node }}
        </h3>
        <div class="h-px flex-1 bg-gray-200"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card class="p-4 rounded-lg border border-gray-200">
          <h4 class="text-sm font-medium mb-2">
            {{ $t("pages.system_metrics.cpu_usage") }}
          </h4>
          <div class="h-[350px]">
            <CpuChart :metrics="node.cpu" />
          </div>
        </Card>
        <Card class="p-4 rounded-lg border border-gray-200">
          <h4 class="text-sm font-medium mb-2">
            {{ $t("pages.system_metrics.memory_usage") }}
          </h4>
          <div class="h-[350px]">
            <MemoryChart :metrics="node.memory" />
          </div>
        </Card>
      </div>
    </div>

    <Separator :label="$t('pages.system_metrics.services')" class="my-8" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <template
        v-for="service in getServiceStats"
        :key="`${service.node}-${service.name}`"
      >
        <Card class="p-4 rounded-lg border border-gray-200">
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
        </Card>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  apollo: {
    getNodeStats: {
      query: generateQuery({
        getNodeStats: [
          {},
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
          },
        ],
      }),
      pollInterval: 10000,
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
      pollInterval: 10000,
    },
  },
};
</script>
