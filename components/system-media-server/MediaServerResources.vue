<script setup lang="ts">
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import ServiceCharts from "~/components/system-metrics/ServiceCharts.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
</script>

<template>
  <ManageSection
    :label="$t('pages.system_media_server.resources')"
    :hint="$t('pages.system_media_server.resources_hint')"
  >
    <template v-if="cpuCores != null" #action>
      <span class="text-xs tabular-nums text-muted-foreground">
        {{ $t("pages.system_media_server.cores_now", { cores: cpuCores }) }}
      </span>
    </template>

    <FadeSwap>
      <div v-if="!getServiceStats" key="loading" aria-busy="true">
        <Skeleton class="h-[10.5rem] rounded-lg" />
      </div>

      <ServiceCharts
        v-else-if="hasSeries"
        key="charts"
        :service="mediaServer"
        :now="now"
      />

      <!-- No pod metrics is not an error worth a red box: the metrics server
           may simply not be scraping, which is a cluster setting, not a call
           problem. -->
      <SectionEmpty
        v-else
        key="none"
        :title="$t('pages.system_media_server.no_resources_title')"
        :description="$t('pages.system_media_server.no_resources_hint')"
      />
    </FadeSwap>
  </ManageSection>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";

// What the media server pod is costing the box, next to what it is carrying.
//
// The same charts System -> Metrics opens under a service row, so an admin
// comparing the two never translates between two visual languages. The only
// difference is the filter: one pod, not all of them.
export default {
  data() {
    return {
      now: Date.now(),
    };
  },
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
      if (!last || !Number.isFinite(used)) {
        return null;
      }
      return (used / 1_000_000_000).toFixed(2);
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
      result(this: any) {
        this.now = Date.now();
      },
    },
  },
};
</script>
