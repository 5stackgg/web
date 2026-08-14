<script lang="ts">
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import { Cpu, MemoryStick } from "lucide-vue-next";

// What the media server pod is costing the box, next to what it is carrying.
//
// Deliberately the same CpuChart/MemoryChart the node and service views use
// rather than a second style of graph for one page -- an admin comparing this
// against System -> Metrics should not have to translate between two visual
// languages. The only difference is the filter: one pod, not all of them.
export default {
  components: { CpuChart, MemoryChart, Cpu, MemoryStick },
  computed: {
    // The deployment is named `mediamtx`; a pod carries a generated suffix, so
    // this matches on the prefix rather than equality.
    mediaServer(): any | null {
      return (
        (this.getServiceStats as Array<any> | undefined)?.find((service) =>
          String(service?.name ?? "").startsWith("mediamtx"),
        ) ?? null
      );
    },
    hasSeries(): boolean {
      return (
        !!this.mediaServer?.cpu?.length || !!this.mediaServer?.memory?.length
      );
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
            cpu: [{}, { time: true, total: true, used: true, window: true }],
            memory: [{}, { time: true, total: true, used: true }],
          },
        ],
      }),
      pollInterval: 30 * 1000,
    },
  },
};
</script>

<template>
  <div v-if="hasSeries" class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-lg border border-border/60 bg-muted/10 p-3">
      <div
        class="mb-2 flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
      >
        <Cpu class="h-3 w-3" />
        {{ $t("pages.system_media_server.cpu") }}
      </div>
      <div class="h-40">
        <CpuChart v-if="mediaServer.cpu?.length" :metrics="mediaServer.cpu" />
      </div>
    </div>

    <div class="rounded-lg border border-border/60 bg-muted/10 p-3">
      <div
        class="mb-2 flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
      >
        <MemoryStick class="h-3 w-3" />
        {{ $t("pages.system_media_server.memory") }}
      </div>
      <div class="h-40">
        <MemoryChart
          v-if="mediaServer.memory?.length"
          :metrics="mediaServer.memory"
        />
      </div>
    </div>
  </div>

  <!-- No pod metrics is not an error worth a red box: the metrics server may
       simply not be scraping, which is a cluster setting, not a call problem. -->
  <p v-else class="text-xs text-muted-foreground/70">
    {{ $t("pages.system_media_server.no_resources") }}
  </p>
</template>
