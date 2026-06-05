<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { playerCareerCombatQuery } from "~/graphql/playerCareerCombatGraphql";
import { usePlayerComparison } from "~/composables/usePlayerComparison";
import { useTableSort } from "~/composables/useTableSort";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import StatLabel from "~/components/common/StatLabel.vue";
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
  kdColor,
  type StatTierConfig,
} from "~/utils/statTiers";
import cleanMapName from "~/utilities/cleanMapName";
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

interface RawOpeningDuel {
  match_map_id: string;
  attempts: number;
  wins: number;
  deaths: number;
  traded_deaths: number;
}

interface RawMatchMap {
  id: string;
  winning_lineup_id: string | null;
  map: { id: string; name: string; label: string | null } | null;
  rounds_aggregate: { aggregate: { count: number } | null } | null;
}

interface RawMatch {
  id: string;
  match_maps: RawMatchMap[];
  opening_duels: RawOpeningDuel[];
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

interface MapDuelAggregate {
  mapId: string;
  name: string;
  label: string | null;
  attempts: number;
  openKills: number;
  openDeaths: number;
  tradedDeaths: number;
}

// Opening-duel rows come pre-aggregated per (match_map, side) from the backend
// (match.opening_duels, already filtered to this player). We window to the last
// N played maps and roll them up by CS map (summing both sides).
function buildMapAggregates(matchList: RawMatch[]): MapDuelAggregate[] {
  const byMap = new Map<string, MapDuelAggregate>();
  let processed = 0;

  for (const match of matchList) {
    const openByMap = new Map<string, RawOpeningDuel>();
    for (const od of match.opening_duels ?? []) {
      const existing = openByMap.get(od.match_map_id);
      if (existing) {
        existing.attempts += od.attempts;
        existing.wins += od.wins;
        existing.deaths += od.deaths;
        existing.traded_deaths += od.traded_deaths;
      } else {
        openByMap.set(od.match_map_id, { ...od });
      }
    }

    for (const mm of match.match_maps) {
      if (processed >= WINDOW_MAPS) {
        break;
      }
      if (!mm.map || (mm.rounds_aggregate?.aggregate?.count ?? 0) === 0) {
        continue;
      }
      processed++;
      const od = openByMap.get(mm.id);
      if (!od || od.attempts === 0) {
        continue;
      }
      let agg = byMap.get(mm.map.id);
      if (!agg) {
        agg = {
          mapId: mm.map.id,
          name: mm.map.name,
          label: mm.map.label,
          attempts: 0,
          openKills: 0,
          openDeaths: 0,
          tradedDeaths: 0,
        };
        byMap.set(mm.map.id, agg);
      }
      agg.attempts += od.attempts;
      agg.openKills += od.wins;
      agg.openDeaths += od.deaths;
      agg.tradedDeaths += od.traded_deaths;
    }
    if (processed >= WINDOW_MAPS) {
      break;
    }
  }

  return [...byMap.values()]
    .filter((a) => a.attempts > 0)
    .sort((a, b) => b.attempts - a.attempts);
}

const mapAggregates = computed<MapDuelAggregate[]>(() =>
  buildMapAggregates(matches.value),
);

const totals = computed(() => {
  let attempts = 0;
  let openKills = 0;
  let openDeaths = 0;
  let tradedDeaths = 0;
  for (const agg of mapAggregates.value) {
    attempts += agg.attempts;
    openKills += agg.openKills;
    openDeaths += agg.openDeaths;
    tradedDeaths += agg.tradedDeaths;
  }
  return { attempts, openKills, openDeaths, tradedDeaths };
});

const hasData = computed(() => totals.value.attempts > 0);

function winPctOf(kills: number, attempts: number): number | null {
  if (attempts <= 0) {
    return null;
  }
  return (kills / attempts) * 100;
}

function kdOf(kills: number, deaths: number): number | null {
  if (deaths <= 0) {
    if (kills <= 0) {
      return null;
    }
    return kills;
  }
  return kills / deaths;
}

function tradedPctOf(traded: number, deaths: number): number | null {
  if (deaths <= 0) {
    return null;
  }
  return (traded / deaths) * 100;
}

const overallWinPct = computed(() =>
  winPctOf(totals.value.openKills, totals.value.attempts),
);
const overallKd = computed(() =>
  kdOf(totals.value.openKills, totals.value.openDeaths),
);
const overallTradedPct = computed(() =>
  tradedPctOf(totals.value.tradedDeaths, totals.value.openDeaths),
);

// Opening-duel totals for an arbitrary player over their own matches — used for
// the comparison overlay (same logic as mapAggregates, just not bucketed).
function computeDuelTotals(matchList: RawMatch[]) {
  let attempts = 0;
  let openKills = 0;
  let openDeaths = 0;
  let tradedDeaths = 0;
  for (const agg of buildMapAggregates(matchList)) {
    attempts += agg.attempts;
    openKills += agg.openKills;
    openDeaths += agg.openDeaths;
    tradedDeaths += agg.tradedDeaths;
  }
  return { attempts, openKills, openDeaths, tradedDeaths };
}

const { comparePlayer, compareData } = usePlayerComparison(
  playerCareerCombatQuery,
  (steamId) => ({
    steamId,
    matchesWhere: buildMatchesWhere(),
    limit: props.limit ?? WINDOW_MAPS,
  }),
  (data: any) => (data?.players_by_pk?.matches ?? []) as RawMatch[],
);
const compareTotals = computed(() =>
  computeDuelTotals(compareData.value ?? []),
);
const hasCompare = computed(
  () => !!comparePlayer.value && compareTotals.value.attempts > 0,
);
const compareWinPct = computed(() =>
  winPctOf(compareTotals.value.openKills, compareTotals.value.attempts),
);
const compareKd = computed(() =>
  kdOf(compareTotals.value.openKills, compareTotals.value.openDeaths),
);
const compareTradedPct = computed(() =>
  tradedPctOf(compareTotals.value.tradedDeaths, compareTotals.value.openDeaths),
);
const compareByMap = computed(() => {
  const m = new Map<string, MapDuelAggregate>();
  if (!hasCompare.value) return m;
  for (const agg of buildMapAggregates(compareData.value ?? [])) {
    m.set(agg.mapId, agg);
  }
  return m;
});

const winTier: StatTierConfig = { dir: "high", cuts: [58, 52, 47, 42] };
const kdTier: StatTierConfig = { dir: "high", cuts: [1.3, 1.1, 0.95, 0.85] };
const tradedTier: StatTierConfig = { dir: "high", cuts: [28, 22, 15, 8] };

function fmt(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

function fmtPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return Math.round(value) + "%";
}

const { sortKey, sortDir, toggle, sortRows } =
  useTableSort<string>("attempts");

const tableRows = computed(() => {
  const getters: Record<string, (a: MapDuelAggregate) => unknown> = {
    name: (a) => a.label || cleanMapName(a.name),
    attempts: (a) => a.attempts,
    win: (a) => winPctOf(a.openKills, a.attempts) ?? -999,
    kd: (a) => kdOf(a.openKills, a.openDeaths) ?? -999,
    traded: (a) => tradedPctOf(a.tradedDeaths, a.openDeaths) ?? -999,
  };
  return sortRows(mapAggregates.value, getters);
});
</script>

<template>
  <div>
    <div :class="[tacticalSectionLabelClasses, 'mb-0']">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("pages.players.detail.career_duels.section") }}
    </div>
    <div :class="tacticalSectionDescriptionClasses">
      {{
        $t("pages.players.detail.career_duels.description", { count: WINDOW_MAPS })
      }}
    </div>

    <FadeSwap class="mt-3">
      <StatGridTableSkeleton
        v-if="loading && !hasData"
        key="skeleton"
        :cols="5"
      />

      <Empty v-else-if="!hasData" key="empty" class="min-h-[200px]">
        <EmptyTitle>{{
          $t("pages.players.detail.career_duels.empty_title")
        }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("pages.players.detail.career_duels.empty_description") }}
        </EmptyDescription>
      </Empty>

      <div v-else key="content">
      <div
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-stretch"
      >
        <div
          class="flex flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/40 py-3 [backdrop-filter:blur(6px)]"
        >
          <RadialStat
            :value="fmtPct(overallWinPct)"
            :label="$t('pages.players.detail.career_duels.win_label')"
            :score="statScore(overallWinPct, 58, 42)"
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
            {{ $t("pages.players.detail.career_duels.attempts_label") }}
          </div>
          <div class="font-mono text-2xl font-bold">
            <AnimatedStat :value="totals.attempts" />
          </div>
          <div class="font-mono text-[0.65rem] text-muted-foreground">
            {{ totals.openKills }}
            {{ $t("pages.players.detail.career_duels.kills_short") }} /
            {{ totals.openDeaths }}
            {{ $t("pages.players.detail.career_duels.deaths_short") }}
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
            <StatLabel
              stat="kd"
              :label="$t('pages.players.detail.career_duels.kd_label')"
            />
          </div>
          <div class="font-mono text-2xl font-bold inline-flex items-center gap-1">
            <AnimatedStat
              :value="fmt(overallKd)"
              :style="{ color: kdColor(overallKd) }"
            />
            <StatChevron :cfg="kdTier" :value="overallKd" />
          </div>
          <div
            v-if="hasCompare"
            class="font-mono text-[0.6rem]"
            style="color: #38bdf8"
          >
            {{ $t("pages.players.detail.compare.vs") }} {{ fmt(compareKd) }}
          </div>
        </div>

        <div
          class="flex flex-col justify-center rounded-lg border border-border/60 bg-card/40 px-4 py-3 [backdrop-filter:blur(6px)]"
        >
          <div
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.career_duels.traded_label") }}
          </div>
          <div class="font-mono text-2xl font-bold inline-flex items-center gap-1">
            <AnimatedStat :value="fmtPct(overallTradedPct)" />
            <StatChevron :cfg="tradedTier" :value="overallTradedPct" />
          </div>
          <div
            v-if="hasCompare"
            class="font-mono text-[0.6rem]"
            style="color: #38bdf8"
          >
            {{ $t("pages.players.detail.compare.vs") }}
            {{ fmtPct(compareTradedPct) }}
          </div>
        </div>
      </div>

      <div class="mt-6">
        <div :class="[tacticalSectionLabelClasses, 'mb-2']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.players.detail.career_duels.table_section") }}
        </div>
        <div
          class="overflow-x-auto rounded-lg border border-border/60 bg-card/40 [backdrop-filter:blur(6px)]"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  sort-key="name"
                  :active-key="sortKey"
                  :direction="sortDir"
                  @sort="toggle"
                >
                  {{ $t("pages.players.detail.career_duels.col_map") }}
                </SortableTableHead>
                <SortableTableHead
                  sort-key="attempts"
                  :active-key="sortKey"
                  :direction="sortDir"
                  class="text-right"
                  @sort="toggle"
                >
                  {{ $t("pages.players.detail.career_duels.col_attempts") }}
                </SortableTableHead>
                <SortableTableHead
                  sort-key="win"
                  :active-key="sortKey"
                  :direction="sortDir"
                  class="text-right"
                  @sort="toggle"
                >
                  {{ $t("pages.players.detail.career_duels.col_win") }}
                </SortableTableHead>
                <SortableTableHead
                  sort-key="kd"
                  :active-key="sortKey"
                  :direction="sortDir"
                  class="text-right"
                  @sort="toggle"
                >
                  <StatLabel
                    stat="kd"
                    :label="$t('pages.players.detail.career_duels.col_kd')"
                  />
                </SortableTableHead>
                <SortableTableHead
                  sort-key="traded"
                  :active-key="sortKey"
                  :direction="sortDir"
                  class="text-right"
                  @sort="toggle"
                >
                  {{ $t("pages.players.detail.career_duels.col_traded") }}
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="agg of tableRows" :key="agg.mapId">
                <TableCell class="font-medium">
                  {{ agg.label || cleanMapName(agg.name) }}
                </TableCell>
                <TableCell class="text-right font-mono">
                  <AnimatedStat :value="agg.attempts" />
                  <div
                    v-if="hasCompare && compareByMap.get(agg.mapId)"
                    class="text-[0.6rem]"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{ compareByMap.get(agg.mapId)!.attempts }}
                  </div>
                </TableCell>
                <TableCell class="text-right font-mono font-bold">
                  <span class="inline-flex items-center gap-0.5">
                    <AnimatedStat
                      :value="fmtPct(winPctOf(agg.openKills, agg.attempts))"
                    />
                    <StatChevron
                      :cfg="winTier"
                      :value="winPctOf(agg.openKills, agg.attempts)"
                    />
                  </span>
                  <div
                    v-if="hasCompare && compareByMap.get(agg.mapId)"
                    class="text-[0.6rem] font-normal"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{
                      fmtPct(
                        winPctOf(
                          compareByMap.get(agg.mapId)!.openKills,
                          compareByMap.get(agg.mapId)!.attempts,
                        ),
                      )
                    }}
                  </div>
                </TableCell>
                <TableCell class="text-right font-mono font-bold">
                  <span class="inline-flex items-center gap-0.5">
                    <AnimatedStat
                      :value="fmt(kdOf(agg.openKills, agg.openDeaths))"
                      :style="{
                        color: kdColor(kdOf(agg.openKills, agg.openDeaths)),
                      }"
                    />
                    <StatChevron
                      :cfg="kdTier"
                      :value="kdOf(agg.openKills, agg.openDeaths)"
                    />
                  </span>
                  <div
                    v-if="hasCompare && compareByMap.get(agg.mapId)"
                    class="text-[0.6rem] font-normal"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{
                      fmt(
                        kdOf(
                          compareByMap.get(agg.mapId)!.openKills,
                          compareByMap.get(agg.mapId)!.openDeaths,
                        ),
                      )
                    }}
                  </div>
                </TableCell>
                <TableCell class="text-right font-mono">
                  <span class="inline-flex items-center gap-0.5">
                    <AnimatedStat
                      :value="
                        fmtPct(tradedPctOf(agg.tradedDeaths, agg.openDeaths))
                      "
                    />
                    <StatChevron
                      :cfg="tradedTier"
                      :value="tradedPctOf(agg.tradedDeaths, agg.openDeaths)"
                    />
                  </span>
                  <div
                    v-if="hasCompare && compareByMap.get(agg.mapId)"
                    class="text-[0.6rem]"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{
                      fmtPct(
                        tradedPctOf(
                          compareByMap.get(agg.mapId)!.tradedDeaths,
                          compareByMap.get(agg.mapId)!.openDeaths,
                        ),
                      )
                    }}
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
