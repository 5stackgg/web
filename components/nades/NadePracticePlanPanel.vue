<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Info, Trophy, Users } from "lucide-vue-next";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import NadeDifficultyChip from "~/components/nades/NadeDifficultyChip.vue";
import NadeLineupCard from "~/components/nades/NadeLineupCard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  nadeLineupsQuery,
  nadePracticePlanQuery,
} from "~/graphql/nadesGraphql";
import { order_by } from "~/generated/zeus";
import {
  humanizeNadeToken,
  nadePlanReasonKey,
  nadePlanReasonTone,
} from "~/utilities/nadeDisplay";
import { NADE_PLAN_ORDERS, readNadePracticePlan } from "~/types/nade";
import type {
  NadeLineup,
  NadePracticePlanEntryView,
  NadePracticePlanOutput,
  NadePracticePlanView,
} from "~/types/nade";

const props = defineProps<{
  mapName: string;
}>();

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "hover", id: string | null): void;
}>();

const { t } = useI18n();

const ANY_SIDE = "any";
const PLAN_LIMIT = 12;

const side = ref<string>(ANY_SIDE);
const order = ref<string>("priority");
const plan = ref<NadePracticePlanView | null>(null);
const lineupsById = ref<Record<string, NadeLineup>>({});
const loading = ref(true);

const sideOptions = computed(() => [
  { key: ANY_SIDE, label: t("common.any") },
  { key: "CT", label: t("pages.nades.sides.CT") },
  { key: "TERRORIST", label: t("pages.nades.sides.TERRORIST") },
]);

// The plan's three orders, and the whole list of what may be sent — an order
// the server does not know is an error, not a fallback to the default.
const orderOptions = computed(() =>
  NADE_PLAN_ORDERS.map((key) => ({
    key,
    label: t(`pages.nades.plan.orders.${key}`),
    desc: t(`pages.nades.plan.order_notes.${key}`),
  })),
);

// The picker can only produce these three, but the guard is the contract: the
// server rejects an order it does not know rather than falling back, so a
// stale value out of any future persistence must never reach it.
const planOrder = computed(() =>
  (NADE_PLAN_ORDERS as readonly string[]).includes(order.value)
    ? order.value
    : "priority",
);

let loadGen = 0;

async function load() {
  const gen = ++loadGen;
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const { data } = await client.query({
      query: nadePracticePlanQuery,
      variables: {
        map_name: props.mapName,
        side: side.value === ANY_SIDE ? null : side.value,
        limit: PLAN_LIMIT,
        order: planOrder.value,
      },
      fetchPolicy: "no-cache",
    });
    if (gen !== loadGen) {
      return;
    }
    const view = readNadePracticePlan(
      (data as any)?.nadePracticePlan as NadePracticePlanOutput | undefined,
    );
    plan.value = view;
    lineupsById.value = {};
    const ids = [...new Set(view.entries.map((entry) => entry.lineupId))];
    if (!ids.length) {
      return;
    }
    const { data: lineupRows } = await client.query({
      query: nadeLineupsQuery,
      variables: {
        where: { id: { _in: ids } },
        order_by: [{ created_at: order_by.desc }],
        limit: ids.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    const byId: Record<string, NadeLineup> = {};
    for (const lineup of ((lineupRows as any)?.nade_lineups ??
      []) as NadeLineup[]) {
      byId[lineup.id] = lineup;
    }
    lineupsById.value = byId;
  } catch (error) {
    if (gen === loadGen) {
      console.error("[nades] practice plan load error:", error);
      plan.value = null;
      lineupsById.value = {};
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => [props.mapName, side.value, order.value], () => void load(), {
  immediate: true,
});

function reasonLabel(entry: NadePracticePlanEntryView) {
  const key = nadePlanReasonKey(entry.reason);
  if (key) {
    return t(`pages.nades.plan.reasons.${key}`);
  }
  return humanizeNadeToken(entry.reason) || t("pages.nades.plan.reasons.other");
}

function reasonNote(entry: NadePracticePlanEntryView) {
  const key = nadePlanReasonKey(entry.reason);
  return key ? t(`pages.nades.plan.reason_notes.${key}`) : "";
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span
        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.nades.plan.title") }}
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <AnimatedFilters v-model="order" :options="orderOptions" square />
        <AnimatedFilters v-model="side" :options="sideOptions" square />
      </div>
    </div>

    <p class="text-xs leading-relaxed text-muted-foreground">
      {{ $t("pages.nades.plan.description") }}
    </p>

    <template v-if="loading">
      <Skeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-md" />
    </template>

    <!-- Never a zero and never an empty list: an unanalysed plan is the server
         saying it could not rank anything, which is a different sentence from
         "you have nothing left to learn". -->
    <div
      v-else-if="plan && !plan.analysed"
      class="flex items-start gap-2 rounded-md border border-border bg-foreground/5 p-3"
    >
      <Info class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div class="min-w-0 text-xs leading-relaxed">
        <div class="font-semibold">
          {{ $t("pages.nades.plan.not_analysed") }}
        </div>
        <p class="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">
          {{ plan.message || $t("pages.nades.plan.not_analysed_description") }}
        </p>
      </div>
    </div>

    <Empty v-else-if="!plan">
      <EmptyTitle>{{ $t("pages.nades.plan.failed") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.nades.plan.failed_description") }}
      </EmptyDescription>
    </Empty>

    <Empty v-else-if="!plan.entries.length">
      <EmptyTitle>{{ $t("pages.nades.plan.empty") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.nades.plan.empty_description") }}
      </EmptyDescription>
    </Empty>

    <template v-else>
      <div
        v-for="(entry, index) of plan.entries"
        :key="entry.lineupId"
        class="flex flex-col gap-1.5"
      >
        <div class="flex flex-wrap items-center gap-1.5">
          <span
            class="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[0.58rem] tabular-nums text-muted-foreground"
          >
            {{ $t("pages.nades.plan.rank", { rank: index + 1 }) }}
          </span>
          <span
            class="rounded-sm border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em]"
            :class="nadePlanReasonTone(entry.reason)"
            :title="reasonNote(entry)"
          >
            {{ reasonLabel(entry) }}
          </span>
          <!-- The plan answers "what next"; the grade answers "how long". Off
               the entry rather than the lineup row, so it still shows on a row
               whose lineup did not come back in the follow-up fetch. -->
          <NadeDifficultyChip :difficulty="entry.difficulty" compact />
          <span
            v-if="entry.metaThrowers"
            class="inline-flex items-center gap-1 font-mono text-[0.58rem] tabular-nums text-muted-foreground"
            :title="$t('pages.nades.meta.throwers_hint')"
          >
            <Users class="h-3 w-3" />
            {{ $t("pages.nades.meta.throwers", { count: entry.metaThrowers }) }}
          </span>
          <span
            v-if="entry.mastered"
            class="inline-flex items-center gap-1 rounded-sm border border-success/40 bg-success/10 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-success"
          >
            <Trophy class="h-3 w-3" />
            {{ $t("pages.nades.progress.mastered") }}
          </span>
          <span
            class="ml-auto font-mono text-[0.58rem] tabular-nums text-muted-foreground"
          >
            <template v-if="entry.attempts > 0">
              {{
                $t("pages.nades.plan.your_record", {
                  successes: entry.successes,
                  attempts: entry.attempts,
                })
              }}
              <template v-if="entry.hitRate !== null">
                · {{ $t("pages.nades.progress.hit_rate", { percent: entry.hitRate }) }}
              </template>
            </template>
            <template v-else>
              {{ $t("pages.nades.plan.never_thrown") }}
            </template>
          </span>
        </div>

        <!-- How everyone else does on it. Without this the ranking is a number
             nobody can argue with; with it, "you 1/9, everyone 62%" says what
             the plan is actually claiming. Null landing rate means the grade is
             unmeasured, and no rate is printed rather than a zero. -->
        <div
          v-if="entry.globalPlayers || entry.globalLandingRate !== null"
          class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.58rem] tabular-nums text-muted-foreground"
        >
          <span class="uppercase tracking-[0.14em]">
            {{ $t("pages.nades.plan.everyone") }}
          </span>
          <span v-if="entry.globalLandingRate !== null">
            {{
              $t("pages.nades.plan.global_landing_rate", {
                percent: entry.globalLandingRate,
              })
            }}
          </span>
          <span v-if="entry.globalPlayers">
            {{
              $t("pages.nades.plan.global_players", {
                count: entry.globalPlayers,
              })
            }}
          </span>
          <span v-if="entry.globalAttempts">
            {{
              $t("pages.nades.plan.global_attempts", {
                count: entry.globalAttempts,
              })
            }}
          </span>
        </div>

        <NadeLineupCard
          v-if="lineupsById[entry.lineupId]"
          :lineup="lineupsById[entry.lineupId]"
          @select="(id) => emit('select', id)"
          @hover="(id) => emit('hover', id)"
        />
        <p
          v-else
          class="rounded-md border border-border bg-card/40 p-3 text-xs text-muted-foreground [backdrop-filter:blur(6px)]"
        >
          {{ $t("pages.nades.plan.unavailable") }}
        </p>
      </div>
    </template>
  </div>
</template>
