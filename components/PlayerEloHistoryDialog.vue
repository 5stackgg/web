<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { TrendingUp, TrendingDown, ArrowUpRight, Crown } from "lucide-vue-next";
import PlayerEloChart from "~/components/charts/PlayerEloChart.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { usePlayerCompareTarget } from "~/composables/usePlayerCompareTarget";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import cleanMapName from "~/utilities/cleanMapName";
import { csRankIcon } from "~/utilities/csRank";

// Drill-down view for a player's ELO history. The page-level chart
// buckets at wide ranges to surface the trend; this dialog stays raw
// so every match is visible — that's the trade-off it exists for.

type Mode = "all" | "Competitive" | "Wingman" | "Duel" | "Premier";
type RangeKey = "7d" | "30d" | "90d" | "1y" | "all";

interface EloEntry {
  current_elo: number | null;
  updated_elo: number | null;
  elo_change: number | null;
  match_created_at: string;
  match_id: string | null;
  match_result: string | null;
  type: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
}

type StatSource = "5stack" | "external";

const props = defineProps<{
  open: boolean;
  playerId: string | number | null;
  playerName?: string | null;
  defaultMode?: Mode;
  defaultRange?: RangeKey;
  excludeTournaments?: boolean;
  // Mirrors the profile's stat source so the drill-down shows the same world
  // (5Stack ELO vs External rank) instead of blending them.
  source?: StatSource;
}>();

const sourceRef = computed<StatSource>(() =>
  props.source === "external" ? "external" : "5stack",
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { client } = useApolloClient();
const { t } = useI18n();

const ranges: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "ALL", days: null },
];

const selectedRange = ref<RangeKey>(props.defaultRange ?? "1y");
const selectedMode = ref<Mode>(props.defaultMode ?? "all");
const history = ref<EloEntry[]>([]);
const premierHistory = ref<EloEntry[]>([]);
const rankHistoryRows = ref<
  Array<{
    rank: number;
    rank_type: number;
    previous_rank: number | null;
    match_id: string | null;
    observed_at: string;
    map_id: string | null;
    map: { id: string; name: string; label: string | null } | null;
  }>
>([]);
const selectedMapId = ref<string | null>(null);
const performanceRows = ref<
  Array<{
    type: string;
    match_result: string | null;
    match_id: string | null;
    map_id: string | null;
  }>
>([]);
const loading = ref(false);
const hasLoadedOnce = ref(false);
let queryGen = 0;

watch(
  () => props.defaultMode,
  (m) => {
    if (m) selectedMode.value = m;
  },
);
watch(
  () => props.defaultRange,
  (r) => {
    if (r) selectedRange.value = r;
  },
);

const ELO_HISTORY_QUERY = gql`
  query PlayerEloHistoryDrillDown(
    $where: v_player_elo_bool_exp!
    $limit: Int!
  ) {
    v_player_elo(
      where: $where
      order_by: { match_created_at: asc }
      limit: $limit
    ) {
      current_elo
      updated_elo
      elo_change
      match_created_at
      match_id
      match_result
      type
      kills
      deaths
      assists
    }
  }
`;

const RANK_HISTORY_QUERY = gql`
  query PlayerRankHistoryDrillDown(
    $where: player_premier_rank_history_bool_exp!
    $limit: Int!
  ) {
    player_premier_rank_history(
      where: $where
      order_by: { observed_at: asc }
      limit: $limit
    ) {
      rank
      rank_type
      previous_rank
      match_id
      observed_at
      map_id
      map {
        id
        name
        label
      }
    }
  }
`;

// External win/loss for the stats strip — rank history carries no result.
const PERFORMANCE_QUERY = gql`
  query PlayerPerformanceDrillDown(
    $where: v_player_match_performance_bool_exp!
    $limit: Int!
  ) {
    v_player_match_performance(where: $where, limit: $limit) {
      type
      match_result
      match_id
      map_id
    }
  }
`;

const sinceTimestamp = computed(() => {
  const r = ranges.find((x) => x.key === selectedRange.value);
  if (!r || r.days === null) return null;
  return new Date(Date.now() - r.days * 86_400_000).toISOString();
});

const rangeLimit = computed(() => {
  switch (selectedRange.value) {
    case "7d":
      return 500;
    case "30d":
      return 1500;
    case "90d":
      return 3000;
    case "1y":
      return 6000;
    default:
      return 10000;
  }
});

const whereClause = computed(() => {
  const w: Record<string, any> = {
    player_steam_id: { _eq: props.playerId },
  };
  if (sinceTimestamp.value) {
    w.match_created_at = { _gte: sinceTimestamp.value };
  }
  if (props.excludeTournaments) {
    w.match = { is_tournament_match: { _eq: false } };
  }
  return w;
});

async function fetchHistory() {
  if (!props.open || !props.playerId) {
    history.value = [];
    premierHistory.value = [];
    rankHistoryRows.value = [];
    performanceRows.value = [];
    return;
  }
  const gen = ++queryGen;
  loading.value = true;

  try {
    if (sourceRef.value === "5stack") {
      // 5Stack ELO only.
      const eloRes = await client.query({
        query: ELO_HISTORY_QUERY,
        variables: { where: whereClause.value, limit: rangeLimit.value },
        fetchPolicy: "network-only",
      });
      if (gen !== queryGen) return;
      history.value = ((eloRes.data as any)?.v_player_elo ?? []) as EloEntry[];
      premierHistory.value = [];
      rankHistoryRows.value = [];
      performanceRows.value = [];
    } else {
      // External: Valve rank history (all rank types) + performance for W/L.
      const rankWhere: Record<string, any> = {
        steam_id: { _eq: props.playerId },
      };
      if (sinceTimestamp.value) {
        rankWhere.observed_at = { _gte: sinceTimestamp.value };
      }
      const perfWhere: Record<string, any> = {
        player_steam_id: { _eq: props.playerId },
        source: { _neq: "5stack" },
      };
      if (sinceTimestamp.value) {
        perfWhere.match_created_at = { _gte: sinceTimestamp.value };
      }
      if (props.excludeTournaments) {
        perfWhere.match = { is_tournament_match: { _eq: false } };
      }
      const [rankRes, perfRes] = await Promise.all([
        client.query({
          query: RANK_HISTORY_QUERY,
          variables: { where: rankWhere, limit: rangeLimit.value },
          fetchPolicy: "network-only",
        }),
        client.query({
          query: PERFORMANCE_QUERY,
          variables: { where: perfWhere, limit: rangeLimit.value },
          fetchPolicy: "network-only",
        }),
      ]);
      if (gen !== queryGen) return;
      history.value = [];
      rankHistoryRows.value = ((rankRes.data as any)
        ?.player_premier_rank_history ?? []) as typeof rankHistoryRows.value;
      performanceRows.value = ((perfRes.data as any)
        ?.v_player_match_performance ?? []) as typeof performanceRows.value;
      // Premier (rank_type 11) series.
      let prev: number | null = null;
      premierHistory.value = rankHistoryRows.value
        .filter((r) => r.rank_type === 11)
        .map((r) => {
          const change = prev === null ? 0 : r.rank - prev;
          prev = r.rank;
          return {
            current_elo: r.rank,
            updated_elo: r.rank,
            elo_change: change,
            match_created_at: r.observed_at,
            match_id: r.match_id,
            match_result: null,
            type: "Premier",
            kills: null,
            deaths: null,
            assists: null,
          };
        });
    }
  } finally {
    if (gen === queryGen) {
      loading.value = false;
      hasLoadedOnce.value = true;
    }
  }
}

// Competitive (12) / Wingman (6) Valve skill-group series from rank history.
// Both ladders are per map, so the series is scoped to the selected map.
function buildRankSeries(rankType: number, type: string): EloEntry[] {
  let prev: number | null = null;
  return rankHistoryRows.value
    .filter(
      (r) =>
        r.rank_type === rankType &&
        (!selectedMapId.value || r.map_id === selectedMapId.value),
    )
    .map((r) => {
      const change =
        r.previous_rank != null
          ? r.rank - Number(r.previous_rank)
          : prev === null
            ? 0
            : r.rank - prev;
      prev = r.rank;
      return {
        current_elo: r.rank,
        updated_elo: r.rank,
        elo_change: change,
        match_created_at: r.observed_at,
        match_id: r.match_id,
        match_result: null,
        type,
        kills: null,
        deaths: null,
        assists: null,
      } as EloEntry;
    });
}
const competitiveRank = computed(() => buildRankSeries(12, "Competitive"));
const wingmanRank = computed(() => buildRankSeries(6, "Wingman"));

// Comparison overlay — the pinned player's matching ELO/rank series, fetched
// for the active source/range and built for the active mode/map. Stored raw so
// switching mode/map re-derives the line without a refetch.
const { compareTarget } = usePlayerCompareTarget();
const compareEloRows = ref<EloEntry[]>([]);
const compareRankRows = ref<typeof rankHistoryRows.value>([]);
let compareGen = 0;

async function loadCompare() {
  const target = compareTarget.value;
  if (!props.open || !target?.steam_id) {
    compareEloRows.value = [];
    compareRankRows.value = [];
    return;
  }
  const gen = ++compareGen;
  try {
    if (sourceRef.value === "5stack") {
      const where: Record<string, any> = {
        player_steam_id: { _eq: target.steam_id },
      };
      if (sinceTimestamp.value) {
        where.match_created_at = { _gte: sinceTimestamp.value };
      }
      if (props.excludeTournaments) {
        where.match = { is_tournament_match: { _eq: false } };
      }
      const res = await client.query({
        query: ELO_HISTORY_QUERY,
        variables: { where, limit: rangeLimit.value },
        fetchPolicy: "network-only",
      });
      if (gen !== compareGen) return;
      compareEloRows.value = ((res.data as any)?.v_player_elo ??
        []) as EloEntry[];
      compareRankRows.value = [];
    } else {
      const rankWhere: Record<string, any> = {
        steam_id: { _eq: target.steam_id },
      };
      if (sinceTimestamp.value) {
        rankWhere.observed_at = { _gte: sinceTimestamp.value };
      }
      const res = await client.query({
        query: RANK_HISTORY_QUERY,
        variables: { where: rankWhere, limit: rangeLimit.value },
        fetchPolicy: "network-only",
      });
      if (gen !== compareGen) return;
      compareRankRows.value = ((res.data as any)?.player_premier_rank_history ??
        []) as typeof rankHistoryRows.value;
      compareEloRows.value = [];
    }
  } catch {
    if (gen === compareGen) {
      compareEloRows.value = [];
      compareRankRows.value = [];
    }
  }
}

const compareEntries = computed<EloEntry[]>(() => {
  if (!compareTarget.value) return [];
  if (sourceRef.value === "5stack") {
    const focusMode =
      selectedMode.value === "all" ? "Competitive" : selectedMode.value;
    return compareEloRows.value.filter((e) => e.type === focusMode);
  }
  const rankType =
    selectedMode.value === "Wingman"
      ? 6
      : selectedMode.value === "Competitive"
        ? 12
        : 11;
  const perMap = rankType === 6 || rankType === 12;
  return compareRankRows.value
    .filter(
      (r) =>
        r.rank_type === rankType &&
        (!perMap || !selectedMapId.value || r.map_id === selectedMapId.value),
    )
    .map(
      (r) =>
        ({
          current_elo: r.rank,
          updated_elo: r.rank,
          elo_change: 0,
          match_created_at: r.observed_at,
          match_id: r.match_id,
          match_result: null,
          type: "compare",
          kills: null,
          deaths: null,
          assists: null,
        }) as EloEntry,
    );
});

// External Competitive/Wingman are Valve skill groups (rendered as badges) and
// are tracked per map — that combination drives the badge cells + map selector.
const isPerMapMode = computed(
  () =>
    sourceRef.value === "external" &&
    (selectedMode.value === "Competitive" || selectedMode.value === "Wingman"),
);
const skillGroupKind = computed<"competitive" | "wingman">(() =>
  selectedMode.value === "Wingman" ? "wingman" : "competitive",
);

// Best/worst single gain/loss is only meaningful where each match moves a
// numeric rating (5Stack ELO, Premier CS Rating). For Competitive/Wingman the
// per-match "delta" is a skill-group step (usually 0), so we hide it.
const showExtremes = computed(
  () =>
    selectedMode.value !== "Competitive" && selectedMode.value !== "Wingman",
);

// Maps the player has skill-group history for in the active per-map mode,
// most-played first — drives the per-map selector above the chart.
const mapOptions = computed(() => {
  if (!isPerMapMode.value) {
    return [] as { mapId: string; name: string; count: number }[];
  }
  const rt = selectedMode.value === "Wingman" ? 6 : 12;
  const counts = new Map<
    string,
    { mapId: string; name: string; count: number }
  >();
  for (const r of rankHistoryRows.value) {
    if (r.rank_type !== rt || !r.map_id) continue;
    const entry = counts.get(r.map_id) ?? {
      mapId: r.map_id,
      name: r.map?.label || r.map?.name || r.map_id,
      count: 0,
    };
    entry.count++;
    counts.set(r.map_id, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
});

// Default to the most-played map on entering a per-map mode / when data lands;
// keep the current pick if it's still valid, clear it when maps don't apply.
watch(
  mapOptions,
  (opts) => {
    if (opts.length === 0) {
      selectedMapId.value = null;
      return;
    }
    if (
      !selectedMapId.value ||
      !opts.some((o) => o.mapId === selectedMapId.value)
    ) {
      selectedMapId.value = opts[0].mapId;
    }
  },
  { immediate: true },
);

watch(
  () => [
    props.open,
    props.playerId,
    selectedRange.value,
    props.excludeTournaments,
    sourceRef.value,
  ],
  () => {
    void fetchHistory();
  },
  { immediate: true },
);

watch(
  () => [
    props.open,
    props.playerId,
    compareTarget.value,
    selectedRange.value,
    props.excludeTournaments,
    sourceRef.value,
  ],
  () => {
    void loadCompare();
  },
  { immediate: true },
);

// Keep the selected mode valid for the active source.
watch(sourceRef, () => {
  const valid = modeOptions.value.map((m) => m.key);
  if (!valid.includes(selectedMode.value)) {
    selectedMode.value = sourceRef.value === "external" ? "Premier" : "all";
  }
});

const filteredHistory = computed<EloEntry[]>(() => {
  if (sourceRef.value === "external") {
    if (selectedMode.value === "Competitive") return competitiveRank.value;
    if (selectedMode.value === "Wingman") return wingmanRank.value;
    return premierHistory.value;
  }
  if (selectedMode.value === "all") {
    return history.value;
  }
  return history.value.filter((e) => e.type === selectedMode.value);
});

// Valve rank type for the chart's skill-group ladder (badges + integer steps).
const chartRankType = computed<number | null>(() =>
  sourceRef.value === "external" &&
  (selectedMode.value === "Competitive" || selectedMode.value === "Wingman")
    ? selectedMode.value === "Wingman"
      ? 6
      : 12
    : null,
);

const chartSeries = computed(() => {
  const base: Array<{
    key: string;
    label: string;
    history: EloEntry[];
    focus: boolean;
    color?: string;
  }> = [];

  if (sourceRef.value === "external") {
    // External: one rank series for the active mode (Premier / Comp / Wingman).
    const s = filteredHistory.value;
    if (s.length > 0) {
      base.push({
        key: selectedMode.value,
        label: selectedMode.value,
        history: s,
        focus: true,
      });
    }
  } else {
    const groupBy = (m: Exclude<Mode, "Premier" | "all">) =>
      history.value.filter((e) => e.type === m);
    const all = [
      {
        key: "Competitive",
        label: "Competitive",
        history: groupBy("Competitive"),
        focus:
          selectedMode.value === "all" || selectedMode.value === "Competitive",
      },
      {
        key: "Wingman",
        label: "Wingman",
        history: groupBy("Wingman"),
        focus: selectedMode.value === "Wingman",
      },
      {
        key: "Duel",
        label: "Duel",
        history: groupBy("Duel"),
        focus: selectedMode.value === "Duel",
      },
    ];
    const visible =
      selectedMode.value === "all"
        ? all
        : all.filter((s) => s.key === selectedMode.value);
    base.push(...visible.filter((s) => s.history.length > 0));
  }

  // Comparison overlay — a dimmed cyan line for the pinned player.
  if (compareTarget.value && compareEntries.value.length > 0) {
    base.push({
      key: "__compare__",
      label: compareTarget.value.name,
      history: compareEntries.value,
      focus: false,
      color: "#38bdf8",
    });
  }

  return base;
});

const liveStats = computed(() => {
  const list = filteredHistory.value;
  const headlineList =
    sourceRef.value === "5stack" && selectedMode.value === "all"
      ? history.value.filter((e) => e.type === "Competitive")
      : list;
  // Match count + W/L come from the performance view (one row per match),
  // filtered to the active mode's type. The rank-history `list` only has a row
  // when a rank snapshot was recorded, so it under-counts matches — it drives
  // the rank chart + current/peak/lowest, NOT the match / W-L tally. Keeping
  // both off `perfList` means MATCHES always equals W+L+T and lines up with the
  // matches table below. (The per-map selector only scopes the rank ladder.)
  let perfList: { match_result: string | null }[];
  if (sourceRef.value !== "external") {
    perfList = list;
  } else if (selectedMode.value === "all") {
    perfList = performanceRows.value;
  } else {
    perfList = performanceRows.value.filter(
      (p) => p.type === selectedMode.value,
    );
  }
  if (list.length === 0 && perfList.length === 0) {
    return {
      current: null as number | null,
      peak: null as number | null,
      lowest: null as number | null,
      total: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      avgChange: 0,
      bestGain: null as EloEntry | null,
      worstLoss: null as EloEntry | null,
      peakEntry: null as EloEntry | null,
    };
  }
  let peak = -Infinity;
  let lowest = Infinity;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let changeSum = 0;
  let changeCount = 0;
  let bestGain: EloEntry | null = null;
  let worstLoss: EloEntry | null = null;
  let peakEntry: EloEntry | null = null;

  for (const e of headlineList) {
    const elo = e.updated_elo ?? e.current_elo ?? null;
    if (elo !== null) {
      if (elo > peak) {
        peak = elo;
        peakEntry = e;
      }
      if (elo < lowest) lowest = elo;
    }
  }

  for (const e of perfList) {
    if (e.match_result === "won" || e.match_result === "win") wins++;
    else if (e.match_result === "lost" || e.match_result === "loss") losses++;
    else if (e.match_result === "tied" || e.match_result === "tie") ties++;
  }

  for (const e of list) {
    if (typeof e.elo_change === "number") {
      changeSum += e.elo_change;
      changeCount++;
      if (!bestGain || e.elo_change > (bestGain.elo_change ?? -Infinity))
        bestGain = e;
      if (!worstLoss || e.elo_change < (worstLoss.elo_change ?? Infinity))
        worstLoss = e;
    }
  }

  const last = headlineList[headlineList.length - 1];
  const decided = wins + losses;
  return {
    current: last?.updated_elo ?? last?.current_elo ?? null,
    peak: peak === -Infinity ? null : peak,
    lowest: lowest === Infinity ? null : lowest,
    total: perfList.length,
    wins,
    losses,
    ties,
    winPct: decided > 0 ? (wins / decided) * 100 : 0,
    avgChange: changeCount > 0 ? changeSum / changeCount : 0,
    bestGain,
    worstLoss,
    peakEntry,
  };
});

// Hold the last stats through an async refetch (e.g. a source flip) so the
// cells flip straight from old → new like a synchronous mode switch, instead
// of flashing to the empty intermediate while the new source loads.
const stats = ref(liveStats.value);
watch([liveStats, loading], () => {
  if (!loading.value) {
    stats.value = liveStats.value;
  }
});

const modeOptions = computed<{ key: Mode; label: string }[]>(() =>
  sourceRef.value === "external"
    ? [
        { key: "Premier", label: "Premier" },
        {
          key: "Competitive",
          label: t("pages.leaderboard.match_types.competitive"),
        },
        { key: "Wingman", label: t("pages.leaderboard.match_types.wingman") },
      ]
    : [
        { key: "all", label: t("pages.leaderboard.match_types.all") },
        {
          key: "Competitive",
          label: t("pages.leaderboard.match_types.competitive"),
        },
        { key: "Wingman", label: t("pages.leaderboard.match_types.wingman") },
        { key: "Duel", label: t("pages.leaderboard.match_types.duel") },
      ],
);

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}
function fmtSigned(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const r = Math.round(n);
  return r > 0 ? `+${r.toLocaleString()}` : r.toLocaleString();
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function rankIcon(rank: number | null | undefined): string | null {
  if (rank === null || rank === undefined) return null;
  return csRankIcon(skillGroupKind.value === "wingman" ? 6 : 12, rank);
}
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border border-border/60 bg-card/30 [backdrop-filter:blur(6px)]"
  >
      <!-- Every cell is a 3-row stack (label / value / subtext) with the
           same min-height. Cells without a real subtext render an &nbsp;
           placeholder so the value baseline lines up across the whole
           strip — otherwise Current/Lowest visually float to the top of
           their cells next to Peak/Matches/Win Rate. -->
      <div
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border/40 border-b border-border/50"
      >
        <div
          class="bg-card/60 min-h-[96px] px-4 py-4 flex flex-col justify-center gap-1.5"
        >
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.elo_history_dialog.current") }}
          </div>
          <template v-if="isPerMapMode">
            <img
              v-if="rankIcon(stats.current)"
              :src="rankIcon(stats.current)!"
              class="h-11 w-auto"
              :alt="skillGroupKind"
            />
            <span
              v-else
              class="text-2xl sm:text-3xl font-bold leading-none text-muted-foreground"
              >—</span
            >
          </template>
          <AnimatedStat
            v-else
            :value="fmtInt(stats.current)"
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight"
          />
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            &nbsp;
          </div>
        </div>
        <div
          class="bg-card/60 min-h-[96px] px-4 py-4 flex flex-col justify-center gap-1.5"
        >
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-1"
          >
            <Crown class="h-3 w-3 text-[hsl(var(--tac-amber))]" />
            {{ $t("pages.players.detail.elo_history_dialog.peak") }}
          </div>
          <template v-if="isPerMapMode">
            <img
              v-if="rankIcon(stats.peak)"
              :src="rankIcon(stats.peak)!"
              class="h-11 w-auto"
              :alt="skillGroupKind"
            />
            <span
              v-else
              class="text-2xl sm:text-3xl font-bold leading-none text-muted-foreground"
              >—</span
            >
          </template>
          <AnimatedStat
            v-else
            :value="fmtInt(stats.peak)"
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight text-[hsl(var(--tac-amber))]"
          />
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <template v-if="stats.peakEntry">{{
              fmtDate(stats.peakEntry.match_created_at)
            }}</template>
            <template v-else>&nbsp;</template>
          </div>
        </div>
        <div
          class="bg-card/60 min-h-[96px] px-4 py-4 flex flex-col justify-center gap-1.5"
        >
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.elo_history_dialog.lowest") }}
          </div>
          <template v-if="isPerMapMode">
            <img
              v-if="rankIcon(stats.lowest)"
              :src="rankIcon(stats.lowest)!"
              class="h-11 w-auto"
              :alt="skillGroupKind"
            />
            <span
              v-else
              class="text-2xl sm:text-3xl font-bold leading-none text-muted-foreground"
              >—</span
            >
          </template>
          <AnimatedStat
            v-else
            :value="fmtInt(stats.lowest)"
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight"
          />
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            &nbsp;
          </div>
        </div>
        <div
          class="bg-card/60 min-h-[96px] px-4 py-4 flex flex-col justify-center gap-1.5"
        >
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.elo_history_dialog.matches") }}
          </div>
          <AnimatedStat
            :value="stats.total.toLocaleString()"
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight"
          />
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <template v-if="stats.total > 0">
              <span class="text-green-500">{{ stats.wins }}W</span>
              ·
              <span class="text-red-500">{{ stats.losses }}L</span>
              <template v-if="stats.ties > 0">
                · <span>{{ stats.ties }}T</span>
              </template>
            </template>
            <template v-else>&nbsp;</template>
          </div>
        </div>
        <div
          class="bg-card/60 min-h-[96px] px-4 py-4 col-span-2 sm:col-span-1 flex flex-col justify-center gap-1.5"
        >
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.elo_history_dialog.win_rate") }}
          </div>
          <AnimatedStat
            :value="stats.total > 0 ? stats.winPct.toFixed(1) + '%' : '—'"
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight"
            :class="stats.winPct >= 50 ? 'text-green-500' : 'text-red-500'"
          />
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <template v-if="!isPerMapMode">
              {{ $t("pages.players.detail.elo_history_dialog.avg_delta_elo") }}
              <span
                :class="
                  stats.avgChange > 0
                    ? 'text-green-500'
                    : stats.avgChange < 0
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                "
              >
                {{ fmtSigned(stats.avgChange) }}
              </span>
            </template>
            <template v-else>&nbsp;</template>
          </div>
        </div>
      </div>

      <div class="px-4 sm:px-6 pt-5">
        <!-- Competitive/Wingman skill groups are per map; this scopes the
             badge cells + chart to one map (most-played first). -->
        <div
          v-if="isPerMapMode && mapOptions.length > 0"
          class="mb-3 flex justify-end"
        >
          <Select
            :model-value="selectedMapId ?? undefined"
            @update:model-value="(v) => (selectedMapId = v as string)"
          >
            <SelectTrigger
              class="h-7 w-[160px] gap-1 border-border/60 bg-card/80 px-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] backdrop-blur-sm"
            >
              <SelectValue :placeholder="$t('player_match.headers.map')" />
            </SelectTrigger>
            <SelectContent class="max-h-[300px]">
              <SelectItem
                v-for="m in mapOptions"
                :key="m.mapId"
                :value="m.mapId"
                class="font-mono text-[0.7rem] uppercase tracking-[0.1em]"
              >
                {{ cleanMapName(m.name) }}
                <span class="ml-1 tabular-nums opacity-60">×{{ m.count }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div
          v-if="loading && !hasLoadedOnce"
          class="h-[360px] flex items-center justify-center text-muted-foreground font-mono text-xs uppercase tracking-[0.18em]"
        >
          {{ $t("pages.players.detail.elo_history_dialog.loading_history") }}
        </div>
        <div
          v-else-if="!loading && filteredHistory.length === 0"
          class="h-[360px] flex flex-col items-center justify-center gap-2 text-muted-foreground"
        >
          <span class="font-mono text-xs uppercase tracking-[0.18em]">
            {{
              $t("pages.players.detail.elo_history_dialog.no_matches_window")
            }}
          </span>
          <button
            v-if="selectedRange !== 'all'"
            type="button"
            class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] hover:underline"
            @click="selectedRange = 'all'"
          >
            {{
              $t("pages.players.detail.elo_history_dialog.expand_to_all_time")
            }}
          </button>
        </div>
        <div v-else class="h-[360px] sm:h-[420px]">
          <PlayerEloChart
            :series="chartSeries"
            :rank-type="chartRankType"
            :loading="loading"
          />
        </div>
      </div>

      <div
        v-if="showExtremes && (stats.bestGain || stats.worstLoss)"
        class="px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/50 mt-3"
      >
        <div
          v-if="stats.bestGain"
          class="rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3"
        >
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-1.5"
          >
            <TrendingUp class="h-3 w-3 text-green-500" />
            {{ $t("pages.players.detail.elo_history_dialog.best_gain") }}
          </div>
          <div class="mt-1 flex items-baseline gap-3">
            <span class="text-lg font-bold text-green-500 tabular-nums">
              {{ fmtSigned(stats.bestGain.elo_change) }}
            </span>
            <span
              class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ stats.bestGain.type }} ·
              {{ fmtDate(stats.bestGain.match_created_at) }}
            </span>
          </div>
          <NuxtLink
            v-if="stats.bestGain.match_id"
            :to="`/matches/${stats.bestGain.match_id}`"
            class="mt-1 inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] hover:underline"
          >
            {{ $t("pages.players.detail.elo_history_dialog.view_match") }}
            <ArrowUpRight class="h-3 w-3" />
          </NuxtLink>
        </div>
        <div
          v-if="stats.worstLoss"
          class="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3"
        >
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground inline-flex items-center gap-1.5"
          >
            <TrendingDown class="h-3 w-3 text-red-500" />
            {{ $t("pages.players.detail.elo_history_dialog.worst_loss") }}
          </div>
          <div class="mt-1 flex items-baseline gap-3">
            <span class="text-lg font-bold text-red-500 tabular-nums">
              {{ fmtSigned(stats.worstLoss.elo_change) }}
            </span>
            <span
              class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ stats.worstLoss.type }} ·
              {{ fmtDate(stats.worstLoss.match_created_at) }}
            </span>
          </div>
          <NuxtLink
            v-if="stats.worstLoss.match_id"
            :to="`/matches/${stats.worstLoss.match_id}`"
            class="mt-1 inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] hover:underline"
          >
            {{ $t("pages.players.detail.elo_history_dialog.view_match") }}
            <ArrowUpRight class="h-3 w-3" />
          </NuxtLink>
        </div>
      </div>
  </div>
</template>
