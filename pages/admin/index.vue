<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { CircleCheck } from "lucide-vue-next";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import { FadeSwap, Fold, PageTransition } from "~/components/ui/transitions";
import ManageSection from "~/components/common/ManageSection.vue";
import LiveStamp from "~/components/admin/LiveStamp.vue";
import NodeStatsPoller from "~/components/system-metrics/NodeStatsPoller.vue";
import GpuSteamAccounts from "~/components/gpu-nodes/GpuSteamAccounts.vue";
import AttentionList from "~/components/admin-home/AttentionList.vue";
import AreaCard from "~/components/admin-home/AreaCard.vue";
import { useAdminHome } from "~/components/admin-home/useAdminHome";
import {
  AREA_LABEL_KEYS,
  needCount,
  type AreaKey,
  type Signal,
} from "~/components/admin-home/adminSignals";

definePageMeta({ middleware: "admin" });

const { t } = useI18n();

const {
  ready,
  signals,
  cards,
  updatedAt,
  statNodeIds,
  onNodeStats,
  accounts,
  accountsLoaded,
  gpuNodes,
  gpuHealth,
} = useAdminHome();

const need = computed(() => needCount(signals.value));

const breakdown = computed(() => {
  const critical = signals.value.filter(
    (signal) => signal.severity === "danger",
  ).length;
  const warnings = signals.value.filter(
    (signal) => signal.severity === "warning",
  ).length;
  return [
    critical &&
      t(
        "pages.system_metrics.attention.critical_count",
        { count: critical },
        critical,
      ),
    warnings &&
      t(
        "pages.system_metrics.attention.warning_count",
        { count: warnings },
        warnings,
      ),
  ]
    .filter(Boolean)
    .join(" · ");
});

const areaLabel = (area: AreaKey) => t(AREA_LABEL_KEYS[area]);

// The Steam pool rows fix the pool in place: the GPU page's own sheet, opened
// on its add form.
const accountsOpen = ref(false);
function onAction(signal: Signal) {
  if (signal.action === "steam_accounts") {
    accountsOpen.value = true;
  }
}
</script>

<template>
  <div class="grid max-w-[960px] gap-8">
    <h1 class="sr-only">{{ $t("pages.admin_home.title") }}</h1>

    <!-- System Metrics' reads, one poll per online node, started once the
         page has settled. Render nothing. -->
    <NodeStatsPoller
      v-for="id in statNodeIds"
      :key="id"
      :node-id="id"
      @stats="onNodeStats"
    />

    <PageTransition>
      <div class="grid gap-4">
        <div class="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
          <!-- The verdict waits for every area, metrics and the database
               included, so it never says "All clear" about something it
               hasn't read. -->
          <FadeSwap class="min-w-0" aria-live="polite">
            <Skeleton
              v-if="!ready"
              key="loading"
              class="h-5 w-56 rounded-md"
              aria-busy="true"
            />
            <div
              v-else-if="need"
              key="need"
              class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            >
              <span class="text-[15px] font-semibold tabular-nums">
                {{ $t("pages.admin_home.need_you", { count: need }, need) }}
              </span>
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ breakdown }}
              </span>
            </div>
            <div
              v-else
              key="clear"
              class="flex flex-wrap items-center gap-x-2 gap-y-0.5"
            >
              <CircleCheck class="size-4 shrink-0 text-success" />
              <span class="text-[15px] font-semibold">
                {{ $t("pages.admin_home.all_clear") }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ $t("pages.admin_home.all_clear_line") }}
              </span>
            </div>
          </FadeSwap>
          <span class="grow" />
          <LiveStamp
            :at="updatedAt"
            live
            clock
            :tip="$t('pages.admin_home.live_hint')"
          />
        </div>

        <FadeSwap>
          <Skeleton
            v-if="!ready"
            key="loading"
            class="h-[8.5rem] w-full rounded-lg"
          />
          <div v-else key="list">
            <!-- Folds shut with the last problem instead of vanishing. -->
            <Fold :open="signals.length > 0">
              <AttentionList
                :signals="signals"
                :area-label="areaLabel"
                @action="onAction"
              />
            </Fold>
          </div>
        </FadeSwap>
      </div>
    </PageTransition>

    <PageTransition :step="1">
      <ManageSection :label="$t('pages.admin_home.everything_else')">
        <div
          class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2.5"
        >
          <AreaCard v-for="card in cards" :key="card.area" :card="card" />
        </div>
      </ManageSection>
    </PageTransition>

    <GpuSteamAccounts
      v-model:open="accountsOpen"
      focus-add
      :accounts="accounts"
      :nodes="gpuNodes"
      :health="gpuHealth"
      :loaded="accountsLoaded"
    />
  </div>
</template>
