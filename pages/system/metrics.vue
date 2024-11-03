<script setup lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import MemoryChart from "~/components/charts/MemoryChart";
import CpuChart from "~/components/charts/CpuChart.vue";
</script>

<template>
  <div>
    <div v-for="node in getNodeStats" :key="node.node" class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <h3 class="text-lg font-semibold">Node: {{ node.node }}</h3>
        <div class="h-px flex-1 bg-gray-200"></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <Card class="p-4 rounded-lg border border-gray-200">
          <h4 class="text-sm font-medium mb-2">CPU Usage</h4>
          <div class="h-[350px]">
            <CpuChart :metrics="node.cpu" />
          </div>
        </Card>
        <Card class="p-4 rounded-lg border border-gray-200">
          <h4 class="text-sm font-medium mb-2">Memory Usage</h4>
          <div class="h-[350px]">
            <MemoryChart :metrics="node.memory" />
          </div>
        </Card>
      </div>
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
                available: true,
              },
            ],
            memory: [
              {},
              {
                time: true,
                total: true,
                used: true,
                available: true,
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
