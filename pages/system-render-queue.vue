<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import RenderQueuePanel from "~/components/clips/RenderQueuePanel.vue";
import UtilityRenderQueuePanel from "~/components/utility/UtilityRenderQueuePanel.vue";
import { useUtilityRendersInFlight } from "~/composables/useUtilityRendersInFlight";
import { useRenderQueueStatusStore } from "~/stores/RenderQueueStatusStore";

definePageMeta({
  middleware: "admin",
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

type Tab = "highlights" | "utility";

// In the address, so a refresh or a shared link lands on the same queue.
const tab = computed<Tab>({
  get: () => (route.query.tab === "utility" ? "utility" : "highlights"),
  set: (value) => {
    void router.replace({
      query: {
        ...route.query,
        tab: value === "highlights" ? undefined : value,
      },
    });
  },
});

const clipQueue = useRenderQueueStatusStore();
const utilityRenders = useUtilityRendersInFlight();

onMounted(() => clipQueue.subscribeToInFlight());

const tabs = computed(() => [
  {
    key: "highlights",
    label: t("pages.render_queue.tabs.highlights"),
    count: clipQueue.inFlightCount,
  },
  {
    key: "utility",
    label: t("pages.render_queue.tabs.utility"),
    count: utilityRenders.count.value,
  },
]);
</script>

<template>
  <div class="relative space-y-6">
    <PageTransition>
      <AnimatedFilters v-model="tab" square :options="tabs" />
    </PageTransition>

    <PageTransition :delay="60">
      <HeightSwap>
        <RenderQueuePanel v-if="tab === 'highlights'" key="highlights" />
        <UtilityRenderQueuePanel v-else key="utility" />
      </HeightSwap>
    </PageTransition>
  </div>
</template>
