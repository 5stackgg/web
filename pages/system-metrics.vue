<script setup lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
</script>

<template>
  <PageTransition :delay="100">
    <Separator :label="$t('pages.system_metrics.services')" class="my-8" />
  </PageTransition>

  <PageTransition :delay="200" class="mt-6">
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
</template>

<script lang="ts">
export default {
  methods: {
    hasServiceMetrics(service: any): boolean {
      return service.cpu.length > 0 || service.memory.length > 0;
    },
  },
  apollo: {
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
