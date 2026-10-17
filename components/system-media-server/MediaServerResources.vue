<script setup lang="ts">
import CpuChart from "~/components/charts/CpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
</script>

<template>
  <ManageSection
    :label="$t('pages.system_media_server.resources')"
    :hint="$t('pages.system_media_server.resources_hint')"
  >
    <FadeSwap>
      <div
        v-if="!getServiceStats"
        key="loading"
        class="grid gap-3 lg:grid-cols-2"
        aria-busy="true"
      >
        <Skeleton v-for="i in 2" :key="i" class="h-[13.5rem] rounded-lg" />
      </div>

      <div v-else-if="hasSeries" key="charts" class="grid gap-3 lg:grid-cols-2">
        <div
          class="grid min-w-0 gap-2.5 rounded-lg border border-border bg-card/20 px-4 pb-3 pt-3.5"
        >
          <div class="flex flex-wrap items-baseline gap-x-3">
            <span class="text-[13px] font-semibold">
              {{ $t("pages.system_media_server.cpu") }}
            </span>
            <span
              v-if="cpuCores != null"
              class="ml-auto text-[13px] tabular-nums text-muted-foreground"
            >
              {{
                $t("pages.system_media_server.cores_now", {
                  cores: cpuCores,
                })
              }}
            </span>
          </div>
          <div class="h-40">
            <CpuChart
              v-if="mediaServer.cpu?.length"
              :metrics="mediaServer.cpu"
            />
          </div>
        </div>

        <div
          class="grid min-w-0 gap-2.5 rounded-lg border border-border bg-card/20 px-4 pb-3 pt-3.5"
        >
          <div class="flex flex-wrap items-baseline gap-x-3">
            <span class="text-[13px] font-semibold">
              {{ $t("pages.system_media_server.memory") }}
            </span>
            <span
              v-if="memoryNow"
              class="ml-auto text-[13px] tabular-nums text-muted-foreground"
            >
              {{ memoryNow }}
            </span>
          </div>
          <div class="h-40">
            <MemoryChart
              v-if="mediaServer.memory?.length"
              :metrics="mediaServer.memory"
            />
          </div>
        </div>
      </div>

      <!-- No pod metrics is not an error worth a red box: the metrics server
           may simply not be scraping, which is a cluster setting, not a call
           problem. -->
      <p
        v-else
        key="none"
        class="rounded-lg border border-dashed border-border px-4 py-3.5 text-[13px] text-muted-foreground"
      >
        {{ $t("pages.system_media_server.no_resources") }}
      </p>
    </FadeSwap>
  </ManageSection>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { formatBytes } from "~/utilities/formatResourceUsage";

// What the media server pod is costing the box, next to what it is carrying.
//
// Deliberately the same CpuChart/MemoryChart the node and service views use
// rather than a second style of graph for one page -- an admin comparing this
// against System -> Metrics should not have to translate between two visual
// languages. The only difference is the filter: one pod, not all of them.
export default {
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
    // Cores in use at the newest sample; `used` is nanocores.
    cpuCores(): string | null {
      const last = this.mediaServer?.cpu?.at(-1);
      const used = Number(last?.used);
      if (!Number.isFinite(used)) {
        return null;
      }
      return (used / 1_000_000_000).toFixed(2);
    },
    memoryNow(): string {
      const used = Number(this.mediaServer?.memory?.at(-1)?.used);
      return Number.isFinite(used) && used > 0 ? formatBytes(used) : "";
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
