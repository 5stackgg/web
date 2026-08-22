<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Info, Users } from "lucide-vue-next";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  utilityLineupsQuery,
  utilityPracticePlanQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import {
  humanizeUtilityToken,
  utilityPlanReasonKey,
  utilityPlanReasonTone,
} from "~/utilities/utilityDisplay";
import { readUtilityPracticePlan } from "~/types/utility";
import type {
  UtilityLineup,
  UtilityPlanOrder,
  UtilityPracticePlanEntryView,
  UtilityPracticePlanOutput,
  UtilityPracticePlanView,
} from "~/types/utility";

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

const PUBLIC_SOURCE = "public";
const PRIVATE_SOURCE = "private";

/**
 * The one order worth fetching. The server's other two sort the same set by
 * difficulty, which is a question nobody opening "what to learn next" is
 * asking -- and on a map with a dozen lineups all three returned the same
 * handful anyway. Priority stays because it decides *which* lineups get
 * ranked at all; how they are ordered on screen is popularity, below.
 */
const PLAN_ORDER: UtilityPlanOrder = "priority";

const side = ref<string>(ANY_SIDE);
const source = ref<string>(PUBLIC_SOURCE);
const plan = ref<UtilityPracticePlanView | null>(null);
const lineupsById = ref<Record<string, UtilityLineup>>({});
const loading = ref(true);

const sideOptions = computed(() => [
  { key: ANY_SIDE, label: t("common.any") },
  { key: "CT", label: t("pages.utility.sides.CT") },
  { key: "TERRORIST", label: t("pages.utility.sides.TERRORIST") },
]);

/**
 * Which half of the library an entry came out of. A lineup the plan ranked but
 * this viewer cannot resolve belongs to neither -- it is not something you can
 * go and learn -- so it stays out of both counts and both lists.
 */
function entrySource(entry: UtilityPracticePlanEntryView) {
  const lineup = lineupsById.value[entry.lineupId];
  if (!lineup) {
    return null;
  }
  return lineup.visibility === "Public" ? PUBLIC_SOURCE : PRIVATE_SOURCE;
}

const sourceCounts = computed(() => {
  const counts: Record<string, number> = {
    [PUBLIC_SOURCE]: 0,
    [PRIVATE_SOURCE]: 0,
  };
  for (const entry of plan.value?.entries ?? []) {
    const key = entrySource(entry);
    if (key) {
      counts[key] += 1;
    }
  }
  return counts;
});

/**
 * Ordered by how many players throw it on this map. The server's priority
 * score decides which lineups are worth ranking; what puts one above another
 * on screen is how many people actually run it, which is the only ordering a
 * reader can check against the map in front of them.
 */
const visibleEntries = computed(() =>
  (plan.value?.entries ?? [])
    .filter((entry) => entrySource(entry) === source.value)
    .sort((a, b) => b.metaThrowers - a.metaThrowers),
);

const busiest = computed(() =>
  Math.max(0, ...visibleEntries.value.map((entry) => entry.metaThrowers)),
);

const sourceOptions = computed(() => [
  {
    key: PUBLIC_SOURCE,
    label: t("pages.utility.visibility.Public"),
    count: sourceCounts.value[PUBLIC_SOURCE],
  },
  {
    key: PRIVATE_SOURCE,
    label: t("pages.utility.visibility.Private"),
    count: sourceCounts.value[PRIVATE_SOURCE],
  },
]);

let loadGen = 0;

async function load() {
  const gen = ++loadGen;
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const { data } = await client.query({
      query: utilityPracticePlanQuery,
      variables: {
        map_name: props.mapName,
        side: side.value === ANY_SIDE ? null : side.value,
        limit: PLAN_LIMIT,
        order: PLAN_ORDER,
      },
      fetchPolicy: "no-cache",
    });
    if (gen !== loadGen) {
      return;
    }
    const view = readUtilityPracticePlan(
      (data as any)?.utilityPracticePlan as UtilityPracticePlanOutput | undefined,
    );
    plan.value = view;
    lineupsById.value = {};
    const ids = [...new Set(view.entries.map((entry) => entry.lineupId))];
    if (!ids.length) {
      return;
    }
    const { data: lineupRows } = await client.query({
      query: utilityLineupsQuery,
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
    const byId: Record<string, UtilityLineup> = {};
    for (const lineup of ((lineupRows as any)?.utility_lineups ??
      []) as UtilityLineup[]) {
      byId[lineup.id] = lineup;
    }
    lineupsById.value = byId;
  } catch (error) {
    if (gen === loadGen) {
      console.error("[utility] practice plan load error:", error);
      plan.value = null;
      lineupsById.value = {};
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => [props.mapName, side.value], () => void load(), {
  immediate: true,
});

function reasonLabel(entry: UtilityPracticePlanEntryView) {
  const key = utilityPlanReasonKey(entry.reason);
  if (key) {
    return t(`pages.utility.plan.reasons.${key}`);
  }
  return humanizeUtilityToken(entry.reason) || t("pages.utility.plan.reasons.other");
}

function reasonNote(entry: UtilityPracticePlanEntryView) {
  const key = utilityPlanReasonKey(entry.reason);
  return key ? t(`pages.utility.plan.reason_notes.${key}`) : "";
}


// Padded, because the rail is a column of them and "1" beside "10" is a ragged
// edge where the whole point is a queue you read straight down.
function rankLabel(index: number) {
  return String(index + 1).padStart(2, "0");
}

// The sample behind the rate, kept off the row. Two hundred throws and four
// throws print the same percentage, and only one of them means anything.
function everyoneHint(entry: UtilityPracticePlanEntryView) {
  const parts = [t("pages.utility.plan.everyone")];
  if (entry.globalPlayers) {
    parts.push(
      t("pages.utility.plan.global_players", { count: entry.globalPlayers }),
    );
  }
  if (entry.globalAttempts) {
    parts.push(
      t("pages.utility.plan.global_attempts", { count: entry.globalAttempts }),
    );
  }
  return parts.join(" \u00b7 ");
}

// Only when the chip has not already said it: "Never thrown" is both a reason
// the plan ranked something and the state of your record, and on the entries
// where it is both, printing it twice is the noise this row was trimmed of.
function showNeverThrown(entry: UtilityPracticePlanEntryView) {
  return (
    !entry.attempts && utilityPlanReasonKey(entry.reason) !== "never_attempted"
  );
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- The side picker is three short words, so it rides beside the heading
         rather than spending a row of a 400px column on its own. -->
    <div class="flex items-center justify-between gap-2">
      <span
        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.plan.title") }}
      </span>
      <AnimatedFilters v-model="side" :options="sideOptions" square />
    </div>

    <div class="flex flex-col gap-1.5">
      <!-- Full width and equal halves: which library you are learning out of is
           the panel's mode switch, not one filter among several. -->
      <AnimatedFilters v-model="source" :options="sourceOptions" square block />
      <p class="text-xs leading-relaxed text-muted-foreground">
        {{ $t("pages.utility.plan.description") }}
      </p>
    </div>

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
          {{ $t("pages.utility.plan.not_analysed") }}
        </div>
        <p class="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">
          {{ plan.message || $t("pages.utility.plan.not_analysed_description") }}
        </p>
      </div>
    </div>

    <Empty v-else-if="!plan">
      <EmptyTitle>{{ $t("pages.utility.plan.failed") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.utility.plan.failed_description") }}
      </EmptyDescription>
    </Empty>

    <Empty v-else-if="!visibleEntries.length">
      <EmptyTitle>{{ $t("pages.utility.plan.empty") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.utility.plan.empty_description") }}
      </EmptyDescription>
    </Empty>

    <!-- A numbered rail instead of a rank pill. The line is what makes this a
         queue rather than a list, and it also binds the reason above each card
         to the card -- loose chips between two bordered boxes belong to
         neither, which is what made the old layout unreadable. -->
    <div v-else class="flex flex-col">
      <div
        v-for="(entry, index) of visibleEntries"
        :key="entry.lineupId"
        class="flex gap-1.5"
      >
        <!-- Exactly wide enough for two digits: every pixel here comes off the
             card, and the spec line inside it is already the thing that wraps
             first in a 400px column. -->
        <div class="flex w-4 shrink-0 flex-col items-center pt-[3px]">
          <span
            class="font-mono text-[0.68rem] font-bold leading-none tabular-nums text-muted-foreground/40"
          >
            {{ rankLabel(index) }}
          </span>
          <span
            v-if="index < visibleEntries.length - 1"
            aria-hidden="true"
            class="mt-1.5 w-px flex-1 bg-border/60"
          />
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-1.5 pb-3">
          <!-- Only what the plan knows and the card does not. The grade, your
               record and the throw count are all on the card below; printing
               them here as well is what turned one entry into three rows of
               identical monospace. -->
          <div class="flex items-center gap-2">
            <span
              class="rounded-sm border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase leading-none tracking-[0.12em]"
              :class="utilityPlanReasonTone(entry.reason)"
              :title="reasonNote(entry)"
            >
              {{ reasonLabel(entry) }}
            </span>
            <!-- The other half of your own hit rate. Null landing rate means
                 the grade is unmeasured, and no rate is printed rather than a
                 zero -- so an entry you have never thrown says that instead. -->
            <span
              v-if="entry.globalLandingRate !== null"
              class="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[0.58rem] uppercase tracking-[0.1em] tabular-nums text-muted-foreground"
              :title="everyoneHint(entry)"
            >
              <Users class="h-3 w-3" />
              {{
                $t("pages.utility.plan.global_landing_rate", {
                  percent: entry.globalLandingRate,
                })
              }}
            </span>
            <span
              v-else-if="showNeverThrown(entry)"
              class="ml-auto shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground/60"
            >
              {{ $t("pages.utility.plan.never_thrown") }}
            </span>
          </div>

          <UtilityLineupCard
            v-if="lineupsById[entry.lineupId]"
            :lineup="lineupsById[entry.lineupId]"
            :meta-throwers="entry.metaThrowers || null"
            :meta-busiest="busiest"
            @select="(id) => emit('select', id)"
            @hover="(id) => emit('hover', id)"
          />
          <p
            v-else
            class="rounded-md border border-border bg-card/40 p-3 text-xs text-muted-foreground [backdrop-filter:blur(6px)]"
          >
            {{ $t("pages.utility.plan.unavailable") }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
