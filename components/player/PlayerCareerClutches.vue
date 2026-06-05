<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { playerCareerCombatQuery } from "~/graphql/playerCareerCombatGraphql";
import { usePlayerComparison } from "~/composables/usePlayerComparison";
import RadialStat from "~/components/charts/RadialStat.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "~/components/ui/table";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import StatChevron from "~/components/StatChevron.vue";
import {
  statLevelFor,
  statScore,
  type StatTierConfig,
} from "~/utils/statTiers";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import StatGridTableSkeleton from "~/components/player/stats/StatGridTableSkeleton.vue";

const WINDOW_MAPS = 40;

const props = defineProps<{
  steamId: string;
  matchType?: string | string[] | null;
  source?: string | null;
  limit?: number | null;
  since?: string | null;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

function buildMatchesWhere() {
  const where: Record<string, any> = { status: { _eq: "Finished" } };
  if (props.source && props.source !== "all") {
    where.source =
      props.source === "external" ? { _neq: "5stack" } : { _eq: "5stack" };
  }
  if (props.matchType) {
    where.options = {
      type: {
        _in: Array.isArray(props.matchType)
          ? props.matchType
          : [props.matchType],
      },
    };
  }
  if (props.since) {
    where.started_at = { _gte: props.since };
  }
  return where;
}

interface RawClutch {
  match_map_id: string;
  against_count: number;
  outcome: "won" | "lost" | "saved";
}

interface RawMatchMap {
  id: string;
  rounds: Array<{ round: number }>;
}

interface RawMatch {
  id: string;
  match_maps: RawMatchMap[];
  clutches: RawClutch[];
}

const loading = ref(true);
const matches = ref<RawMatch[]>([]);

let loadGen = 0;

async function load() {
  if (!props.steamId) {
    matches.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const gen = ++loadGen;
  try {
    const { data } = await apolloClient.query({
      query: playerCareerCombatQuery,
      variables: {
        steamId: props.steamId,
        matchesWhere: buildMatchesWhere(),
        limit: props.limit ?? WINDOW_MAPS,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    matches.value = ((data as any)?.players_by_pk?.matches ?? []) as RawMatch[];
  } catch {
    if (gen === loadGen) {
      matches.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(
  () => [props.steamId, props.source, props.matchType, props.limit, props.since],
  load,
  { immediate: true },
);

interface ClutchBucket {
  against: number;
  attempts: number;
  won: number;
}

// Clutches come pre-detected and pre-filtered to the player from the backend
// (match.clutches). We only window to the last N played maps and bucket by the
// number of opponents; a clutch counts as won if it was won or saved.
function buildBuckets(matchList: RawMatch[]): ClutchBucket[] {
  const map = new Map<number, ClutchBucket>();
  for (let x = 1; x <= 5; x++) {
    map.set(x, { against: x, attempts: 0, won: 0 });
  }

  const windowedMapIds = new Set<string>();
  let processed = 0;
  for (const match of matchList) {
    for (const mm of match.match_maps) {
      if (processed >= WINDOW_MAPS) {
        break;
      }
      if ((mm.rounds?.length ?? 0) === 0) {
        continue;
      }
      processed++;
      windowedMapIds.add(mm.id);
    }
    if (processed >= WINDOW_MAPS) {
      break;
    }
  }

  for (const match of matchList) {
    for (const c of match.clutches ?? []) {
      if (!windowedMapIds.has(c.match_map_id)) {
        continue;
      }
      const x = Math.min(Math.max(c.against_count, 1), 5);
      const bucket = map.get(x)!;
      bucket.attempts++;
      if (c.outcome === "won" || c.outcome === "saved") {
        bucket.won++;
      }
    }
  }

  return [...map.values()];
}

const buckets = computed<ClutchBucket[]>(() => buildBuckets(matches.value));

const totals = computed(() => {
  let attempts = 0;
  let won = 0;
  for (const bucket of buckets.value) {
    attempts += bucket.attempts;
    won += bucket.won;
  }
  return { attempts, won };
});

const hasData = computed(() => totals.value.attempts > 0);

const overallWinPct = computed<number | null>(() => {
  if (totals.value.attempts <= 0) {
    return null;
  }
  return (totals.value.won / totals.value.attempts) * 100;
});

function winPctOf(bucket: ClutchBucket): number | null {
  if (bucket.attempts <= 0) {
    return null;
  }
  return (bucket.won / bucket.attempts) * 100;
}

const winTier: StatTierConfig = { dir: "high", cuts: [50, 38, 25, 15] };

// Overall clutch totals for an arbitrary player over their own matches — drives
// the comparison overlay.
function computeClutchTotals(matchList: RawMatch[]) {
  let attempts = 0;
  let won = 0;
  for (const b of buildBuckets(matchList)) {
    attempts += b.attempts;
    won += b.won;
  }
  return { attempts, won };
}

const { comparePlayer, compareData } = usePlayerComparison(
  playerCareerCombatQuery,
  (steamId) => ({
    steamId,
    matchesWhere: buildMatchesWhere(),
    limit: props.limit ?? WINDOW_MAPS,
  }),
  (data: any) => (data?.players_by_pk?.matches ?? []) as RawMatch[],
  () => [props.source, props.matchType, props.limit, props.since],
);
const compareTotals = computed(() =>
  computeClutchTotals(compareData.value ?? []),
);
const hasCompare = computed(
  () => !!comparePlayer.value && compareTotals.value.attempts > 0,
);
const compareWinPct = computed<number | null>(() =>
  compareTotals.value.attempts > 0
    ? (compareTotals.value.won / compareTotals.value.attempts) * 100
    : null,
);
const compareBucketsByAgainst = computed(() => {
  const m = new Map<number, ClutchBucket>();
  if (!hasCompare.value) return m;
  for (const b of buildBuckets(compareData.value ?? [])) {
    m.set(b.against, b);
  }
  return m;
});

function fmtPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return Math.round(value) + "%";
}
</script>

<template>
  <div>
    <div :class="[tacticalSectionLabelClasses, 'mb-0']">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("pages.players.detail.career_clutches.section") }}
    </div>
    <div :class="tacticalSectionDescriptionClasses">
      {{
        $t("pages.players.detail.career_clutches.description", {
          count: WINDOW_MAPS,
        })
      }}
    </div>

    <FadeSwap class="mt-3">
      <StatGridTableSkeleton
        v-if="loading && !hasData"
        key="skeleton"
        :cards="3"
        :rows="5"
        :cols="4"
      />

      <Empty v-else-if="!hasData" key="empty" class="min-h-[200px]">
        <EmptyTitle>{{
          $t("pages.players.detail.career_clutches.empty_title")
        }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("pages.players.detail.career_clutches.empty_description") }}
        </EmptyDescription>
      </Empty>

      <div v-else key="content">
      <div
        class="grid grid-cols-1 gap-3 sm:grid-cols-3 items-stretch"
      >
        <div
          class="flex flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/40 py-3 [backdrop-filter:blur(6px)]"
        >
          <RadialStat
            :value="fmtPct(overallWinPct)"
            :label="$t('pages.players.detail.career_clutches.win_label')"
            :score="statScore(overallWinPct, 50, 15)"
            :level="statLevelFor(winTier, overallWinPct)"
          />
          <div
            v-if="hasCompare"
            class="font-mono text-[0.6rem]"
            style="color: #38bdf8"
          >
            {{ $t("pages.players.detail.compare.vs") }}
            {{ fmtPct(compareWinPct) }}
          </div>
        </div>

        <div
          class="flex flex-col justify-center rounded-lg border border-border/60 bg-card/40 px-4 py-3 [backdrop-filter:blur(6px)]"
        >
          <div
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.career_clutches.attempts_label") }}
          </div>
          <div class="font-mono text-2xl font-bold">
            <AnimatedStat :value="totals.attempts" />
          </div>
          <div
            v-if="hasCompare"
            class="font-mono text-[0.6rem]"
            style="color: #38bdf8"
          >
            {{ $t("pages.players.detail.compare.vs") }}
            {{ compareTotals.attempts }}
          </div>
        </div>

        <div
          class="flex flex-col justify-center rounded-lg border border-border/60 bg-card/40 px-4 py-3 [backdrop-filter:blur(6px)]"
        >
          <div
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.career_clutches.won_label") }}
          </div>
          <div class="font-mono text-2xl font-bold">
            <AnimatedStat :value="totals.won" />
          </div>
          <div
            v-if="hasCompare"
            class="font-mono text-[0.6rem]"
            style="color: #38bdf8"
          >
            {{ $t("pages.players.detail.compare.vs") }}
            {{ compareTotals.won }}
          </div>
        </div>
      </div>

      <div class="mt-6">
        <div :class="[tacticalSectionLabelClasses, 'mb-2']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.players.detail.career_clutches.table_section") }}
        </div>
        <div
          class="overflow-x-auto rounded-lg border border-border/60 bg-card/40 [backdrop-filter:blur(6px)]"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {{ $t("pages.players.detail.career_clutches.col_situation") }}
                </TableHead>
                <TableHead class="text-right">
                  {{ $t("pages.players.detail.career_clutches.col_attempts") }}
                </TableHead>
                <TableHead class="text-right">
                  {{ $t("pages.players.detail.career_clutches.col_won") }}
                </TableHead>
                <TableHead class="text-right">
                  {{ $t("pages.players.detail.career_clutches.col_win") }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="bucket of buckets" :key="bucket.against">
                <TableCell class="font-mono font-medium">
                  1v{{ bucket.against }}
                </TableCell>
                <TableCell class="text-right font-mono">
                  <AnimatedStat :value="bucket.attempts" />
                  <div
                    v-if="hasCompare && compareBucketsByAgainst.get(bucket.against)"
                    class="text-[0.6rem]"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{ compareBucketsByAgainst.get(bucket.against)!.attempts }}
                  </div>
                </TableCell>
                <TableCell class="text-right font-mono">
                  <AnimatedStat :value="bucket.won" />
                  <div
                    v-if="hasCompare && compareBucketsByAgainst.get(bucket.against)"
                    class="text-[0.6rem]"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{ compareBucketsByAgainst.get(bucket.against)!.won }}
                  </div>
                </TableCell>
                <TableCell class="text-right font-mono font-bold">
                  <span class="inline-flex items-center gap-0.5">
                    <AnimatedStat :value="fmtPct(winPctOf(bucket))" />
                    <StatChevron :cfg="winTier" :value="winPctOf(bucket)" />
                  </span>
                  <div
                    v-if="hasCompare && compareBucketsByAgainst.get(bucket.against)"
                    class="text-[0.6rem] font-normal"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{ fmtPct(winPctOf(compareBucketsByAgainst.get(bucket.against)!)) }}
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
      </div>
    </FadeSwap>
  </div>
</template>
