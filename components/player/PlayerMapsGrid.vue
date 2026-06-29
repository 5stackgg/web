<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { playerMapStatsQuery } from "~/graphql/playerMapStatsGraphql";
import { playerMapHltvQuery } from "~/graphql/playerMapHltvGraphql";
import { usePlayerComparison } from "~/composables/usePlayerComparison";
import { useTableSort } from "~/composables/useTableSort";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import RadialStat from "~/components/charts/RadialStat.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import StatLabel from "~/components/common/StatLabel.vue";
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
import { Skeleton } from "~/components/ui/skeleton";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import StatChevron from "~/components/StatChevron.vue";
import {
  statLevelFor,
  statScore,
  hltvColor,
  kdColor,
  type StatTierConfig,
} from "~/utils/statTiers";
import cleanMapName from "~/utilities/cleanMapName";

type SideKey = "all" | "T" | "CT";

const props = defineProps<{
  steamId: string;
  matchType?: string | string[] | null;
  source?: string | null;
  since?: string | null;
}>();

function buildStatsWhere() {
  const match: Record<string, any> = {};
  if (props.source && props.source !== "all") {
    match.source =
      props.source === "5stack"
        ? { _eq: "5stack" }
        : props.source === "external"
          ? { _neq: "5stack" }
          : props.source === "unknown"
            ? { _nin: ["5stack", "valve", "faceit"] }
            : { _eq: props.source };
  }
  if (props.matchType) {
    match.options = {
      type: {
        _in: Array.isArray(props.matchType)
          ? props.matchType
          : [props.matchType],
      },
    };
  }
  if (props.since) {
    match.started_at = { _gte: props.since };
  }
  return Object.keys(match).length ? { match_map: { match } } : {};
}

// The inner `match` filter (for views keyed by a `match` relationship, like
// v_player_match_map_hltv) — same source/type/since as buildStatsWhere.
function buildMatchWhere() {
  const match: Record<string, any> = {};
  if (props.source && props.source !== "all") {
    match.source =
      props.source === "5stack"
        ? { _eq: "5stack" }
        : props.source === "external"
          ? { _neq: "5stack" }
          : props.source === "unknown"
            ? { _nin: ["5stack", "valve", "faceit"] }
            : { _eq: props.source };
  }
  if (props.matchType) {
    match.options = {
      type: {
        _in: Array.isArray(props.matchType)
          ? props.matchType
          : [props.matchType],
      },
    };
  }
  if (props.since) {
    match.started_at = { _gte: props.since };
  }
  return match;
}

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

interface RawMapStat {
  match_map_id: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  damage: number | null;
  he_damage: number | null;
  molotov_damage: number | null;
  rounds_played: number | null;
  rounds_t: number | null;
  rounds_ct: number | null;
  kills_t: number | null;
  kills_ct: number | null;
  deaths_t: number | null;
  deaths_ct: number | null;
  damage_t: number | null;
  damage_ct: number | null;
  assists_t: number | null;
  assists_ct: number | null;
  match_map: {
    id: string;
    winning_lineup_id: string | null;
    map: {
      id: string;
      name: string;
      label: string | null;
      poster: string | null;
    } | null;
    match: {
      id: string;
      lineup_1_id: string | null;
      lineup_2_id: string | null;
      lineup_1: {
        id: string;
        lineup_players: Array<{ steam_id: string | number }>;
      } | null;
      lineup_2: {
        id: string;
        lineup_players: Array<{ steam_id: string | number }>;
      } | null;
    } | null;
  } | null;
}

interface SideSplit {
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  // Canonical KAST% for the map (rounds-weighted Both KAST from
  // v_player_match_map_hltv). All three splits carry the map's KAST — per-side
  // KAST isn't stored separately, so CT/T inherit the map's overall value.
  kast: number;
}

interface MapAggregate {
  mapId: string;
  name: string;
  label: string | null;
  poster: string | null;
  played: number;
  wins: number;
  all: SideSplit;
  t: SideSplit;
  ct: SideSplit;
  heDamage: number;
  molotovDamage: number;
  ratings: number[];
  kastSum: number;
  kastRounds: number;
}

const loading = ref(true);
const rows = ref<RawMapStat[]>([]);
// match_map_id -> canonical per-instance rating + KAST (from the hltv view).
type HltvEntry = { rating: number | null; kast: number; rounds: number };
const hltvByMatchMap = ref<Map<string, HltvEntry>>(new Map());

function buildHltvMap(rows: any[]): Map<string, HltvEntry> {
  const map = new Map<string, HltvEntry>();
  for (const r of rows ?? []) {
    const id = String(r.match_map_id ?? "");
    if (!id) {
      continue;
    }
    map.set(id, {
      rating: r.hltv_rating == null ? null : Number(r.hltv_rating),
      kast: Number(r.kast_pct ?? 0),
      rounds: Number(r.rounds_played ?? 0),
    });
  }
  return map;
}
const tableSide = ref<SideKey>("all");

let loadGen = 0;
// Bumped on every successful load so the card grid remounts and replays its
// staggered entrance — otherwise keyed cards are reused and never re-animate
// when the source/mode/range filter changes.
const gridKey = ref(0);

async function load() {
  if (!props.steamId) {
    rows.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const gen = ++loadGen;
  try {
    const [statsRes, hltvRes] = await Promise.all([
      apolloClient.query({
        query: playerMapStatsQuery,
        variables: {
          steamId: props.steamId,
          statsWhere: buildStatsWhere(),
        },
        fetchPolicy: "network-only",
      }),
      apolloClient.query({
        query: playerMapHltvQuery,
        variables: { steamId: props.steamId, where: buildMatchWhere() },
        fetchPolicy: "network-only",
      }),
    ]);
    if (gen !== loadGen) {
      return;
    }
    rows.value = ((statsRes.data as any)?.players_by_pk?.match_map_stats ??
      []) as RawMapStat[];
    hltvByMatchMap.value = buildHltvMap(
      (hltvRes.data as any)?.v_player_match_map_hltv ?? [],
    );
    gridKey.value++;
  } catch {
    if (gen === loadGen) {
      rows.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => [props.steamId, props.source, props.matchType, props.since], load, {
  immediate: true,
});

function emptySplit(): SideSplit {
  return { rounds: 0, kills: 0, deaths: 0, assists: 0, damage: 0, kast: 0 };
}

// Canonical HLTV 2.0 — same formula + KAST term as v_player_match_map_hltv, so
// the Maps tab agrees with the match page / matches table. (The KAST term was
// previously omitted, which read ~0.5 low.)
function ratingFor(split: SideSplit): number | null {
  if (split.rounds <= 0) {
    return null;
  }
  const kpr = split.kills / split.rounds;
  const dpr = split.deaths / split.rounds;
  const apr = split.assists / split.rounds;
  const adr = split.damage / split.rounds;
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  const rating =
    0.0073 * split.kast +
    0.3591 * kpr -
    0.5329 * dpr +
    0.2372 * impact +
    0.0032 * adr +
    0.1587;
  return rating;
}

function adrFor(split: SideSplit): number | null {
  if (split.rounds <= 0) {
    return null;
  }
  return split.damage / split.rounds;
}

// Resolve the viewed player's lineup id for a map by matching their steam_id
// against both lineups' (steam_id-filtered) players — mirrors PlayerMatchRow's
// playerLineupId. Falls back to null when neither lineup carries the player.
function lineupForPlayer(
  match: NonNullable<NonNullable<RawMapStat["match_map"]>["match"]>,
  steamId: string,
): string | null {
  const sid = String(steamId);
  const onL1 = match.lineup_1?.lineup_players?.some(
    (lp) => String(lp.steam_id ?? "") === sid,
  );
  if (onL1) {
    return match.lineup_1_id;
  }
  const onL2 = match.lineup_2?.lineup_players?.some(
    (lp) => String(lp.steam_id ?? "") === sid,
  );
  if (onL2) {
    return match.lineup_2_id;
  }
  return null;
}

function buildAggregates(
  source: RawMapStat[],
  hltvMap: Map<string, HltvEntry>,
  steamId: string,
): MapAggregate[] {
  const byMap = new Map<string, MapAggregate>();
  const seenMatchMaps = new Map<string, Set<string>>();
  for (const row of source) {
    const mm = row.match_map;
    const map = mm?.map;
    if (!mm || !map) {
      continue;
    }
    const mapId = map.id;
    let agg = byMap.get(mapId);
    if (!agg) {
      agg = {
        mapId,
        name: map.name,
        label: map.label,
        poster: map.poster,
        played: 0,
        wins: 0,
        all: emptySplit(),
        t: emptySplit(),
        ct: emptySplit(),
        heDamage: 0,
        molotovDamage: 0,
        ratings: [],
        kastSum: 0,
        kastRounds: 0,
      };
      byMap.set(mapId, agg);
      seenMatchMaps.set(mapId, new Set());
    }
    const seen = seenMatchMaps.get(mapId)!;
    if (!seen.has(mm.id)) {
      seen.add(mm.id);
      agg.played += 1;
      const hltv = hltvMap.get(mm.id);
      if (hltv && hltv.rounds > 0) {
        agg.kastSum += hltv.kast * hltv.rounds;
        agg.kastRounds += hltv.rounds;
      }
      const match = mm.match;
      const playerLineupId = match ? lineupForPlayer(match, steamId) : null;
      if (
        mm.winning_lineup_id &&
        playerLineupId &&
        mm.winning_lineup_id === playerLineupId
      ) {
        agg.wins += 1;
      }
    }

    const rounds = row.rounds_played ?? 0;
    const tRounds = row.rounds_t ?? 0;
    const ctRounds = row.rounds_ct ?? 0;

    agg.all.rounds += rounds;
    agg.all.kills += row.kills ?? 0;
    agg.all.deaths += row.deaths ?? 0;
    agg.all.assists += row.assists ?? 0;
    agg.all.damage += row.damage ?? 0;

    agg.t.rounds += tRounds;
    agg.t.kills += row.kills_t ?? 0;
    agg.t.deaths += row.deaths_t ?? 0;
    agg.t.assists += row.assists_t ?? 0;
    agg.t.damage += row.damage_t ?? 0;

    agg.ct.rounds += ctRounds;
    agg.ct.kills += row.kills_ct ?? 0;
    agg.ct.deaths += row.deaths_ct ?? 0;
    agg.ct.assists += row.assists_ct ?? 0;
    agg.ct.damage += row.damage_ct ?? 0;

    agg.heDamage += row.he_damage ?? 0;
    agg.molotovDamage += row.molotov_damage ?? 0;

    const hltv = hltvMap.get(mm.id);
    const single: SideSplit = {
      rounds,
      kills: row.kills ?? 0,
      deaths: row.deaths ?? 0,
      assists: row.assists ?? 0,
      damage: row.damage ?? 0,
      kast: hltv?.kast ?? 0,
    };
    // Canonical per-instance rating for the sparkline; fall back to the local
    // formula only when the view has no row for this map.
    const r = hltv?.rating != null ? hltv.rating : ratingFor(single);
    if (r !== null) {
      agg.ratings.push(r);
    }
  }
  // Stamp each side split with the map's canonical (rounds-weighted) KAST so
  // ratingFor() is KAST-inclusive everywhere it's called.
  for (const agg of byMap.values()) {
    const mapKast = agg.kastRounds > 0 ? agg.kastSum / agg.kastRounds : 0;
    agg.all.kast = mapKast;
    agg.ct.kast = mapKast;
    agg.t.kast = mapKast;
  }
  return [...byMap.values()].sort((a, b) => b.played - a.played);
}

const aggregates = computed<MapAggregate[]>(() =>
  buildAggregates(rows.value, hltvByMatchMap.value, props.steamId),
);

const hasMaps = computed(() => aggregates.value.length > 0);

const {
  enabled: compareEnabled,
  comparePlayer,
  compareData,
} = usePlayerComparison(
  playerMapStatsQuery,
  (steamId) => ({ steamId, statsWhere: buildStatsWhere() }),
  (data: any) => (data?.players_by_pk?.match_map_stats ?? []) as RawMapStat[],
  () => [props.source, props.matchType, props.since],
);

const { compareData: compareHltvData } = usePlayerComparison(
  playerMapHltvQuery,
  (steamId) => ({ steamId, where: buildMatchWhere() }),
  (data: any) => (data?.v_player_match_map_hltv ?? []) as any[],
  () => [props.source, props.matchType, props.since],
);

const compareHltvByMatchMap = computed(() =>
  buildHltvMap(compareHltvData.value ?? []),
);

const compareByMap = computed(() => {
  const map = new Map<string, MapAggregate>();
  if (!compareEnabled.value || !comparePlayer.value || !compareData.value) {
    return map;
  }
  for (const agg of buildAggregates(
    compareData.value,
    compareHltvByMatchMap.value,
    String(comparePlayer.value.steam_id),
  )) {
    map.set(agg.mapId, agg);
  }
  return map;
});

const hasCompare = computed(
  () => compareEnabled.value && compareByMap.value.size > 0,
);

function compareRating(mapId: string): number | null {
  const agg = compareByMap.value.get(mapId);
  if (!agg) {
    return null;
  }
  return ratingFor(splitForSide(agg, tableSide.value));
}

function compareWin(mapId: string): number | null {
  const agg = compareByMap.value.get(mapId);
  if (!agg) {
    return null;
  }
  return winPct(agg);
}

function compareAdr(mapId: string): number | null {
  const agg = compareByMap.value.get(mapId);
  return agg ? adrFor(splitForSide(agg, tableSide.value)) : null;
}

function compareKd(mapId: string): number | null {
  const agg = compareByMap.value.get(mapId);
  return agg ? kdFor(splitForSide(agg, tableSide.value)) : null;
}

function compareUdr(mapId: string): number | null {
  const agg = compareByMap.value.get(mapId);
  return agg ? udrFor(agg) : null;
}

function compareKda(mapId: string): string | null {
  const agg = compareByMap.value.get(mapId);
  return agg ? avgKda(agg, tableSide.value) : null;
}

function winPct(agg: MapAggregate): number {
  if (agg.played <= 0) {
    return 0;
  }
  return (agg.wins / agg.played) * 100;
}

function splitForSide(agg: MapAggregate, side: SideKey): SideSplit {
  if (side === "T") {
    return agg.t;
  }
  if (side === "CT") {
    return agg.ct;
  }
  return agg.all;
}

function udrFor(agg: MapAggregate): number | null {
  if (agg.all.rounds <= 0) {
    return null;
  }
  return (agg.heDamage + agg.molotovDamage) / agg.all.rounds;
}

function kdFor(split: SideSplit): number | null {
  if (split.deaths <= 0) {
    if (split.kills <= 0) {
      return null;
    }
    return split.kills;
  }
  return split.kills / split.deaths;
}

const ratingTier: StatTierConfig = {
  dir: "high",
  cuts: [1.2, 1.05, 0.95, 0.85],
};
const winTier: StatTierConfig = { dir: "high", cuts: [60, 53, 47, 40] };

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

function sparklinePoints(ratings: number[], scale: number[] = ratings): string {
  if (ratings.length === 0) {
    return "";
  }
  const w = 72;
  const h = 22;
  if (ratings.length === 1) {
    const y = h / 2;
    return `0,${y} ${w},${y}`;
  }
  const base = scale.length ? scale : ratings;
  const min = Math.min(...base);
  const max = Math.max(...base);
  const range = max - min || 1;
  return ratings
    .map((value, index) => {
      const x = (index / (ratings.length - 1)) * w;
      const y = h - ((value - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function compareRatings(mapId: string): number[] {
  return compareByMap.value.get(mapId)?.ratings ?? [];
}

function sparklineScale(mapId: string, ratings: number[]): number[] {
  return [...ratings, ...compareRatings(mapId)];
}

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>("played");

const tableRows = computed(() => {
  const side = tableSide.value;
  const getters: Record<string, (a: MapAggregate) => unknown> = {
    name: (a) => a.label || cleanMapName(a.name),
    played: (a) => a.played,
    win: (a) => winPct(a),
    rating: (a) => ratingFor(splitForSide(a, side)) ?? -999,
    adr: (a) => adrFor(splitForSide(a, side)) ?? -999,
    kd: (a) => kdFor(splitForSide(a, side)) ?? -999,
    udr: (a) => udrFor(a) ?? -999,
    avg: (a) => {
      const split = splitForSide(a, side);
      if (a.played <= 0) {
        return -999;
      }
      return (split.kills + split.deaths + split.assists) / a.played;
    },
  };
  return sortRows(aggregates.value, getters);
});

const sideOptions: { value: SideKey; label: string }[] = [
  { value: "all", label: "BOTH" },
  { value: "T", label: "T" },
  { value: "CT", label: "CT" },
];

function avgKda(agg: MapAggregate, side: SideKey): string {
  if (agg.played <= 0) {
    return "—";
  }
  const split = splitForSide(agg, side);
  const k = (split.kills / agg.played).toFixed(1);
  const d = (split.deaths / agg.played).toFixed(1);
  const a = (split.assists / agg.played).toFixed(1);
  return `${k} / ${d} / ${a}`;
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.players.detail.maps.section") }}
        </div>
        <div :class="tacticalSectionDescriptionClasses">
          {{ $t("pages.players.detail.maps.description") }}
        </div>
      </div>
    </div>

    <FadeSwap class="mt-3">
      <div v-if="loading && !hasMaps" key="skeleton">
        <div
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <div
            v-for="i in 8"
            :key="i"
            class="overflow-hidden rounded-lg border border-border/60 bg-card/40"
          >
            <Skeleton class="h-24 w-full rounded-none" />
            <div class="flex items-center gap-3 px-3 py-3">
              <Skeleton class="h-12 w-12 shrink-0 rounded-full" />
              <div class="flex-1 space-y-2">
                <Skeleton class="h-3 w-2/3" />
                <Skeleton class="h-[22px] w-full" />
              </div>
            </div>
            <div class="grid grid-cols-3 border-t border-border/50">
              <div
                v-for="c in 3"
                :key="c"
                class="space-y-1.5 px-2 py-2"
                :class="c > 1 && 'border-l border-border/50'"
              >
                <Skeleton class="mx-auto h-2 w-8" />
                <Skeleton class="mx-auto h-3.5 w-10" />
                <Skeleton class="mx-auto h-2 w-9" />
              </div>
            </div>
          </div>
        </div>
        <div
          class="mt-6 overflow-hidden rounded-lg border border-border/60 bg-card/40"
        >
          <Skeleton class="h-10 w-full rounded-none" />
          <div
            v-for="r in 6"
            :key="r"
            class="flex items-center gap-3 border-t border-border/50 px-4 py-3"
          >
            <Skeleton class="h-3 w-28" />
            <Skeleton class="ml-auto h-3 w-10" />
            <Skeleton class="h-3 w-10" />
            <Skeleton class="h-3 w-10" />
          </div>
        </div>
      </div>

      <Empty v-else-if="!hasMaps" key="empty" class="min-h-[200px]">
        <EmptyTitle>{{
          $t("pages.players.detail.maps.empty_title")
        }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("pages.players.detail.maps.empty_description") }}
        </EmptyDescription>
      </Empty>

      <div v-else key="content">
        <div
          :key="gridKey"
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <div
            v-for="(agg, index) of aggregates"
            :key="agg.mapId"
            class="relative overflow-hidden rounded-lg border border-border/60 bg-card/60 animate-in fade-in fill-mode-both duration-500"
            :style="{ animationDelay: index * 30 + 'ms' }"
          >
            <div class="relative h-24 w-full overflow-hidden">
              <NuxtImg
                v-if="agg.poster"
                :src="agg.poster"
                class="h-full w-full object-cover"
                sizes="400px"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent"
              ></div>
              <div
                class="absolute bottom-2 left-3 right-3 flex items-end justify-between"
              >
                <span
                  class="font-sans text-base font-bold uppercase tracking-[0.08em] text-white drop-shadow"
                >
                  {{ agg.label || cleanMapName(agg.name) }}
                </span>
                <span
                  class="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/80"
                >
                  {{ agg.played }}
                  {{ $t("pages.players.detail.maps.played_short") }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-3 px-3 py-3">
              <RadialStat
                :value="fmt(ratingFor(agg.all))"
                :label="$t('pages.players.detail.maps.rating_label')"
                :score="statScore(ratingFor(agg.all), 1.2, 0.85)"
                :level="statLevelFor(ratingTier, ratingFor(agg.all))"
              />
              <div class="flex-1 space-y-1.5">
                <div class="flex items-baseline justify-between">
                  <span
                    class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {{ $t("pages.players.detail.maps.win_rate") }}
                  </span>
                  <span
                    class="font-mono text-sm font-bold inline-flex items-center gap-0.5"
                  >
                    <AnimatedStat :value="fmtPct(winPct(agg))" />
                    <StatChevron :cfg="winTier" :value="winPct(agg)" />
                    <span
                      v-if="hasCompare"
                      class="font-normal"
                      style="color: #38bdf8"
                    >
                      {{ $t("pages.players.detail.compare.vs") }}
                      {{ fmtPct(compareWin(agg.mapId)) }}
                    </span>
                  </span>
                </div>

                <svg
                  class="h-[22px] w-full"
                  viewBox="0 0 72 22"
                  preserveAspectRatio="none"
                >
                  <polyline
                    :points="
                      sparklinePoints(
                        agg.ratings,
                        sparklineScale(agg.mapId, agg.ratings),
                      )
                    "
                    fill="none"
                    stroke="#fff"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <polyline
                    v-if="hasCompare && compareRatings(agg.mapId).length > 1"
                    :points="
                      sparklinePoints(
                        compareRatings(agg.mapId),
                        sparklineScale(agg.mapId, agg.ratings),
                      )
                    "
                    fill="none"
                    stroke="#38bdf8"
                    stroke-width="1.5"
                    stroke-dasharray="2 2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div class="grid grid-cols-3 border-t border-border/50 text-center">
              <div class="px-1 py-2">
                <div
                  class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {{ $t("pages.players.detail.maps.both") }}
                </div>
                <div
                  class="font-mono text-sm font-bold inline-flex items-center gap-0.5"
                >
                  <AnimatedStat
                    :value="fmt(ratingFor(agg.all))"
                    :style="{ color: hltvColor(ratingFor(agg.all)) }"
                  />
                </div>
                <div
                  v-if="hasCompare"
                  class="font-mono text-[0.6rem]"
                  style="color: #38bdf8"
                >
                  {{ $t("pages.players.detail.compare.vs") }}
                  {{
                    fmt(
                      compareByMap.get(agg.mapId)
                        ? ratingFor(compareByMap.get(agg.mapId)!.all)
                        : null,
                    )
                  }}
                </div>
                <div class="font-mono text-[0.6rem] text-muted-foreground">
                  {{ fmt(adrFor(agg.all), 0) }}
                  {{ $t("pages.players.detail.maps.adr_short") }}
                </div>
              </div>
              <div class="border-l border-border/50 px-1 py-2">
                <div
                  class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("pages.players.detail.maps.t_side") }}
                </div>
                <div
                  class="font-mono text-sm font-bold inline-flex items-center gap-0.5"
                >
                  <AnimatedStat
                    :value="fmt(ratingFor(agg.t))"
                    :style="{ color: hltvColor(ratingFor(agg.t)) }"
                  />
                </div>
                <div class="font-mono text-[0.6rem] text-muted-foreground">
                  {{ fmt(adrFor(agg.t), 0) }}
                  {{ $t("pages.players.detail.maps.adr_short") }}
                </div>
              </div>
              <div class="border-l border-border/50 px-1 py-2">
                <div
                  class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-[hsl(199,89%,60%)]"
                >
                  {{ $t("pages.players.detail.maps.ct_side") }}
                </div>
                <div
                  class="font-mono text-sm font-bold inline-flex items-center gap-0.5"
                >
                  <AnimatedStat
                    :value="fmt(ratingFor(agg.ct))"
                    :style="{ color: hltvColor(ratingFor(agg.ct)) }"
                  />
                </div>
                <div class="font-mono text-[0.6rem] text-muted-foreground">
                  {{ fmt(adrFor(agg.ct), 0) }}
                  {{ $t("pages.players.detail.maps.adr_short") }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.players.detail.maps.table_section") }}
            </div>
            <div
              class="inline-flex items-stretch overflow-hidden rounded-sm border border-border bg-[hsl(var(--card)/0.5)]"
            >
              <button
                v-for="opt of sideOptions"
                :key="opt.value"
                type="button"
                class="px-2.5 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] transition-colors"
                :class="
                  tableSide === opt.value
                    ? 'bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="tableSide = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
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
                    {{ $t("pages.players.detail.maps.col_map") }}
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="played"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    {{ $t("pages.players.detail.maps.col_played") }}
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="win"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    {{ $t("pages.players.detail.maps.col_win") }}
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="rating"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel
                      stat="hltv"
                      :label="$t('pages.players.detail.maps.col_rating')"
                    />
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="adr"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel
                      stat="adr"
                      :label="$t('pages.players.detail.maps.col_adr')"
                    />
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
                      :label="$t('pages.players.detail.maps.col_kd')"
                    />
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="udr"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel
                      stat="udr"
                      :label="$t('pages.players.detail.maps.col_udr')"
                    />
                  </SortableTableHead>
                  <TableHead class="text-right">
                    <StatLabel
                      stat="kda"
                      :label="$t('pages.players.detail.maps.col_avg_kda')"
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="agg of tableRows" :key="agg.mapId">
                  <TableCell class="font-medium">
                    {{ agg.label || cleanMapName(agg.name) }}
                  </TableCell>
                  <TableCell class="text-right font-mono">
                    <AnimatedStat :value="agg.played" />
                  </TableCell>
                  <TableCell class="text-right font-mono font-bold">
                    <span class="inline-flex items-center gap-0.5">
                      <AnimatedStat :value="fmtPct(winPct(agg))" />
                      <StatChevron :cfg="winTier" :value="winPct(agg)" />
                    </span>
                    <span
                      v-if="hasCompare"
                      class="font-normal"
                      style="color: #38bdf8"
                    >
                      {{ $t("pages.players.detail.compare.vs") }}
                      {{ fmtPct(compareWin(agg.mapId)) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right font-mono font-bold">
                    <AnimatedStat
                      :value="fmt(ratingFor(splitForSide(agg, tableSide)))"
                      :style="{
                        color: hltvColor(
                          ratingFor(splitForSide(agg, tableSide)),
                        ),
                      }"
                    />
                    <span
                      v-if="hasCompare"
                      class="font-normal"
                      style="color: #38bdf8"
                    >
                      {{ $t("pages.players.detail.compare.vs") }}
                      {{ fmt(compareRating(agg.mapId)) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right font-mono">
                    <AnimatedStat
                      :value="fmt(adrFor(splitForSide(agg, tableSide)), 0)"
                    />
                    <span
                      v-if="hasCompare"
                      class="font-normal"
                      style="color: #38bdf8"
                    >
                      {{ $t("pages.players.detail.compare.vs") }}
                      {{ fmt(compareAdr(agg.mapId), 0) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right font-mono">
                    <AnimatedStat
                      :value="fmt(kdFor(splitForSide(agg, tableSide)))"
                      :style="{
                        color: kdColor(kdFor(splitForSide(agg, tableSide))),
                      }"
                    />
                    <span
                      v-if="hasCompare"
                      class="font-normal"
                      style="color: #38bdf8"
                    >
                      {{ $t("pages.players.detail.compare.vs") }}
                      {{ fmt(compareKd(agg.mapId)) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right font-mono">
                    <AnimatedStat :value="fmt(udrFor(agg), 0)" />
                    <span
                      v-if="hasCompare"
                      class="font-normal"
                      style="color: #38bdf8"
                    >
                      {{ $t("pages.players.detail.compare.vs") }}
                      {{ fmt(compareUdr(agg.mapId), 0) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground">
                    <div><AnimatedStat :value="avgKda(agg, tableSide)" /></div>
                    <div v-if="hasCompare" style="color: #38bdf8">
                      {{ $t("pages.players.detail.compare.vs") }}
                      {{ compareKda(agg.mapId) ?? "—" }}
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
