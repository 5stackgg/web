<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "vue-chartjs";
import { playerIntroStatsQuery } from "~/graphql/playerIntroStatsGraphql";
import { usePlayerComparison } from "~/composables/usePlayerComparison";
import RadialStat from "~/components/charts/RadialStat.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import StatChevron from "~/components/StatChevron.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { statLevelFromRange } from "~/utils/statTiers";
import LastTenWinsAndLosses from "~/components/charts/LastTenWinsAndLosses.vue";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import cleanMapName from "~/utilities/cleanMapName";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

// Single-series player charts stay white; a pinned compare adds a second
// sky-blue line. (Literals because chart.js canvas can't resolve var().)
const PRIMARY = "#fff";

const props = defineProps<{
  steamId: string;
  matchType?: string | string[] | null;
  source?: string | null;
  limit?: number | null;
  since?: string | null;
}>();

const { t, te } = useI18n();

function statTitle(key: string): string {
  return te(`stat_glossary.${key}.label`) ? t(`stat_glossary.${key}.label`) : "";
}
function statDesc(key: string): string {
  return te(`stat_glossary.${key}.description`)
    ? t(`stat_glossary.${key}.description`)
    : "";
}

function buildMatchesWhere() {
  const where: Record<string, any> = {
    status: { _eq: "Finished" },
  };
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
const { client: apolloClient } = useApolloClient();

interface MatchMeta {
  id: string;
  created_at: string;
  started_at: string | null;
  source: string | null;
  winning_lineup_id: string | null;
  lineup_1_id: string | null;
  lineup_2_id: string | null;
  lineup_1: { id: string; name: string; lineup_players: any[] } | null;
  lineup_2: { id: string; name: string; lineup_players: any[] } | null;
  match_maps: Array<{
    id: string;
    lineup_1_score: number | null;
    lineup_2_score: number | null;
    winning_lineup_id: string | null;
    map: { id: string; name: string } | null;
  }>;
}

interface RawStats {
  match_id: string;
  steam_id: string | number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  flash_assists: number | null;
  damage: number | null;
  he_damage: number | null;
  molotov_damage: number | null;
  rounds_played: number | null;
  rounds_t: number | null;
  rounds_ct: number | null;
  hs_kills: number | null;
  hits: number | null;
  headshot_hits: number | null;
  two_kill_rounds: number | null;
  three_kill_rounds: number | null;
  four_kill_rounds: number | null;
  five_kill_rounds: number | null;
  trade_kill_successes: number | null;
  traded_death_successes: number | null;
}

interface MatchPoint {
  matchId: string;
  date: string;
  mapName: string;
  result: "won" | "lost" | "tied" | null;
  scorePlayer: number;
  scoreOpponent: number;
  opponentName: string;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  hltv: number;
  adr: number;
  kpr: number;
  dpr: number;
  kast: number | null;
  udr: number;
  hsPct: number | null;
}

const loading = ref(true);
const matchesMeta = ref<MatchMeta[]>([]);
const rawStats = ref<RawStats[]>([]);
const hltvRows = ref<any[]>([]);

let loadGen = 0;

async function load() {
  if (!props.steamId) {
    matchesMeta.value = [];
    rawStats.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const gen = ++loadGen;
  try {
    const { data } = await apolloClient.query({
      query: playerIntroStatsQuery,
      variables: {
        steamId: props.steamId,
        matchesWhere: buildMatchesWhere(),
        limit: props.limit ?? 30,
        statsLimit: 200,
        hltvLimit: 600,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    matchesMeta.value =
      ((data as any)?.playerIntroMatches?.matches ?? []) as MatchMeta[];
    rawStats.value =
      ((data as any)?.playerIntroStats ?? []) as RawStats[];
    hltvRows.value = ((data as any)?.playerIntroHltv ?? []) as any[];
  } catch {
    if (gen === loadGen) {
      matchesMeta.value = [];
      rawStats.value = [];
      hltvRows.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(
  () => [
    props.steamId,
    props.source,
    props.matchType,
    props.limit,
    props.since,
  ],
  load,
  { immediate: true },
);

function lineupForPlayer(match: MatchMeta, steamId: string): string | null {
  const sid = String(steamId);
  const onL1 = match.lineup_1?.lineup_players?.some(
    (lp: any) => String(lp.player?.steam_id ?? "") === sid,
  );
  if (onL1) {
    return match.lineup_1_id;
  }
  const onL2 = match.lineup_2?.lineup_players?.some(
    (lp: any) => String(lp.player?.steam_id ?? "") === sid,
  );
  if (onL2) {
    return match.lineup_2_id;
  }
  return null;
}

// Canonical per-match HLTV rating + KAST, aggregated (rounds-weighted) from the
// per-map v_player_match_map_hltv view — the same source the match page and
// leaderboards use. Falls back to the client estimate below when a match has no
// view rows (e.g. live, aggregate-only).
function buildHltvByMatch(
  rows: any[],
): Map<string, { hltv: number; kast: number }> {
  const acc = new Map<
    string,
    { wHltv: number; wKast: number; rounds: number }
  >();
  for (const r of rows) {
    const mid = String(r.match_id ?? "");
    const rounds = Number(r.rounds_played ?? 0);
    if (!mid || rounds <= 0) {
      continue;
    }
    const cur = acc.get(mid) ?? { wHltv: 0, wKast: 0, rounds: 0 };
    cur.wHltv += Number(r.hltv_rating ?? 0) * rounds;
    cur.wKast += Number(r.kast_pct ?? 0) * rounds;
    cur.rounds += rounds;
    acc.set(mid, cur);
  }
  const out = new Map<string, { hltv: number; kast: number }>();
  for (const [mid, v] of acc.entries()) {
    if (v.rounds > 0) {
      out.set(mid, { hltv: v.wHltv / v.rounds, kast: v.wKast / v.rounds });
    }
  }
  return out;
}

function buildPoints(
  meta: MatchMeta[],
  stats: RawStats[],
  steamId: string,
  hltvByMatch?: Map<string, { hltv: number; kast: number }>,
): MatchPoint[] {
  const statsByMatch = new Map<string, RawStats>();
  for (const s of stats) {
    if (s.match_id) {
      statsByMatch.set(String(s.match_id), s);
    }
  }

  const result: MatchPoint[] = [];
  for (const match of meta) {
    const s = statsByMatch.get(String(match.id));
    if (!s) {
      continue;
    }
    const rounds = s.rounds_played ?? 0;
    if (!rounds) {
      continue;
    }
    const kills = s.kills ?? 0;
    const deaths = s.deaths ?? 0;
    const assists = s.assists ?? 0;
    const damage = s.damage ?? 0;
    const kpr = kills / rounds;
    const dpr = deaths / rounds;
    const apr = assists / rounds;
    const adr = damage / rounds;
    const udr = ((s.he_damage ?? 0) + (s.molotov_damage ?? 0)) / rounds;

    const tradedDeaths = s.traded_death_successes ?? 0;
    const survivedRounds = Math.max(0, rounds - deaths);
    const kast = Math.min(
      100,
      ((survivedRounds + tradedDeaths) / rounds) * 100,
    );

    const impact = 2.13 * kpr + 0.42 * apr - 0.41;
    const hltv =
      0.0073 * (kast ?? 70) +
      0.3591 * kpr -
      0.5329 * dpr +
      0.2372 * impact +
      0.0032 * adr +
      0.1587;

    const hits = s.hits ?? 0;
    const hsHits = s.headshot_hits ?? 0;
    const hsPct = hits > 0 ? (hsHits / hits) * 100 : null;

    const mine = lineupForPlayer(match, steamId);
    let resultStr: "won" | "lost" | "tied" | null = null;
    if (mine) {
      if (!match.winning_lineup_id) {
        resultStr = "tied";
      } else {
        resultStr = match.winning_lineup_id === mine ? "won" : "lost";
      }
    }

    let scorePlayer = 0;
    let scoreOpponent = 0;
    for (const mm of match.match_maps) {
      const l1 = mm.lineup_1_score ?? 0;
      const l2 = mm.lineup_2_score ?? 0;
      if (mine && mine === match.lineup_1_id) {
        scorePlayer += l1;
        scoreOpponent += l2;
      } else if (mine && mine === match.lineup_2_id) {
        scorePlayer += l2;
        scoreOpponent += l1;
      }
    }

    const opponentName =
      mine === match.lineup_1_id
        ? match.lineup_2?.name ?? "—"
        : match.lineup_1?.name ?? "—";

    const firstMap = match.match_maps[0]?.map?.name ?? null;
    const mapName = firstMap ? cleanMapName(firstMap) : "—";

    const canonical = hltvByMatch?.get(String(match.id));

    result.push({
      matchId: String(match.id),
      date: match.started_at ?? match.created_at,
      mapName,
      result: resultStr,
      scorePlayer,
      scoreOpponent,
      opponentName,
      rounds,
      kills,
      deaths,
      assists,
      hltv: canonical ? canonical.hltv : hltv,
      adr,
      kpr,
      dpr,
      kast: canonical ? canonical.kast : kast,
      udr,
      hsPct,
    });
  }

  return result.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

const points = computed<MatchPoint[]>(() =>
  buildPoints(
    matchesMeta.value,
    rawStats.value,
    props.steamId,
    buildHltvByMatch(hltvRows.value),
  ),
);

const hasData = computed(() => points.value.length > 0);

function avg(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function buildAggregate(list: MatchPoint[]) {
  const totalRounds = list.reduce((s, p) => s + p.rounds, 0);
  const totalKills = list.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = list.reduce((s, p) => s + p.deaths, 0);
  const totalAssists = list.reduce((s, p) => s + p.assists, 0);
  const wins = list.filter((p) => p.result === "won").length;
  const losses = list.filter((p) => p.result === "lost").length;
  const decided = wins + losses;
  const kastVals = list
    .map((p) => p.kast)
    .filter((v): v is number => v !== null);
  const hsVals = list
    .map((p) => p.hsPct)
    .filter((v): v is number => v !== null);
  return {
    adr: avg(list.map((p) => p.adr)),
    kd: totalDeaths > 0 ? totalKills / totalDeaths : totalKills,
    kpr: totalRounds > 0 ? totalKills / totalRounds : 0,
    dpr: totalRounds > 0 ? totalDeaths / totalRounds : 0,
    hltv: avg(list.map((p) => p.hltv)),
    kast: kastVals.length ? avg(kastVals) : null,
    hsPct: hsVals.length ? avg(hsVals) : null,
    kills: totalKills,
    deaths: totalDeaths,
    assists: totalAssists,
    wins,
    losses,
    winPct: decided > 0 ? (wins / decided) * 100 : 0,
    matches: list.length,
  };
}

function cumulativeWinRate(list: MatchPoint[]): number[] {
  let wins = 0;
  let decided = 0;
  const out: number[] = [];
  for (const p of list) {
    if (p.result === "won") {
      wins += 1;
      decided += 1;
    } else if (p.result === "lost") {
      decided += 1;
    }
    out.push(decided > 0 ? (wins / decided) * 100 : NaN);
  }
  return out;
}

const aggregate = computed(() => buildAggregate(points.value));

const {
  enabled: compareEnabled,
  comparePlayer,
  compareLoading,
  compareData,
} = usePlayerComparison(
  playerIntroStatsQuery,
  (steamId) => ({
    steamId,
    matchesWhere: buildMatchesWhere(),
    limit: props.limit ?? 30,
    statsLimit: 200,
    hltvLimit: 600,
  }),
  (data: any) => ({
    matchesMeta: (data?.playerIntroMatches?.matches ?? []) as MatchMeta[],
    rawStats: (data?.playerIntroStats ?? []) as RawStats[],
    hltvRows: (data?.playerIntroHltv ?? []) as any[],
  }),
);

const comparePoints = computed<MatchPoint[]>(() => {
  const data = compareData.value;
  const player = comparePlayer.value;
  if (!compareEnabled.value || !data || !player) {
    return [];
  }
  return buildPoints(
    data.matchesMeta,
    data.rawStats,
    String(player.steam_id),
    buildHltvByMatch(data.hltvRows ?? []),
  );
});

const hasCompare = computed(
  () => compareEnabled.value && comparePoints.value.length > 0,
);

const compareAggregate = computed(() => buildAggregate(comparePoints.value));

const compareColor = "#38bdf8";

function compareSeries(selector: (p: MatchPoint) => number): number[] {
  return comparePoints.value.map(selector);
}

function alignToPrimary(series: number[]): (number | null)[] {
  const target = points.value.length;
  if (series.length === target) {
    return series.map((v) => (Number.isFinite(v) ? v : null));
  }
  if (series.length > target) {
    return series
      .slice(series.length - target)
      .map((v) => (Number.isFinite(v) ? v : null));
  }
  const pad: (number | null)[] = new Array(target - series.length).fill(null);
  return pad.concat(series.map((v) => (Number.isFinite(v) ? v : null)));
}

function fmt(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) {
    return "—";
  }
  return n.toFixed(digits);
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) {
    return "—";
  }
  return `${Math.round(n)}%`;
}

const labels = computed(() => points.value.map((p) => p.date));

function sparkData(series: number[], compare?: number[]) {
  const datasets: any[] = [
    {
      data: series,
      borderColor: PRIMARY,
      borderWidth: 2,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.35,
      spanGaps: true,
    },
  ];
  if (hasCompare.value && compare) {
    datasets.push({
      data: alignToPrimary(compare),
      borderColor: compareColor,
      borderWidth: 1.75,
      borderDash: [4, 3],
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.35,
      spanGaps: true,
    });
  }
  return {
    labels: labels.value,
    datasets,
  };
}

const sparkOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: "easeOutQuart" as const },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    x: { display: false },
    y: { display: false },
  },
  elements: {
    line: { borderJoinStyle: "round" as const },
  },
};

const metricCards = computed(() => [
  {
    key: "winrate",
    label: t("pages.players.detail.intro.win_rate"),
    value: fmt(aggregate.value.winPct, 0) + "%",
    compareValue: hasCompare.value
      ? fmt(compareAggregate.value.winPct, 0) + "%"
      : null,
    subtext: `${aggregate.value.wins}W · ${aggregate.value.losses}L`,
    series: cumulativeWinRate(points.value),
    compareSeries: hasCompare.value
      ? cumulativeWinRate(comparePoints.value)
      : [],
    level: statLevelFromRange(aggregate.value.winPct, 65, 35),
  },
  {
    key: "adr",
    label: t("pages.players.detail.intro.adr"),
    value: fmt(aggregate.value.adr, 1),
    compareValue: hasCompare.value ? fmt(compareAggregate.value.adr, 1) : null,
    series: points.value.map((p) => p.adr),
    compareSeries: compareSeries((p) => p.adr),
    level: statLevelFromRange(aggregate.value.adr, 90, 55),
  },
  {
    key: "kd",
    label: t("pages.players.detail.intro.kd"),
    value: fmt(aggregate.value.kd, 2),
    compareValue: hasCompare.value ? fmt(compareAggregate.value.kd, 2) : null,
    subtext: `${aggregate.value.kills}K · ${aggregate.value.deaths}D · ${aggregate.value.assists}A`,
    series: points.value.map((p) =>
      p.deaths > 0 ? p.kills / p.deaths : p.kills,
    ),
    compareSeries: compareSeries((p) =>
      p.deaths > 0 ? p.kills / p.deaths : p.kills,
    ),
    level: statLevelFromRange(aggregate.value.kd, 1.3, 0.8),
  },
  {
    key: "kpr",
    label: t("pages.players.detail.intro.kpr"),
    value: fmt(aggregate.value.kpr, 2),
    compareValue: hasCompare.value ? fmt(compareAggregate.value.kpr, 2) : null,
    series: points.value.map((p) => p.kpr),
    compareSeries: compareSeries((p) => p.kpr),
    level: statLevelFromRange(aggregate.value.kpr, 0.85, 0.5),
  },
  {
    key: "dpr",
    label: t("pages.players.detail.intro.dpr"),
    value: fmt(aggregate.value.dpr, 2),
    compareValue: hasCompare.value ? fmt(compareAggregate.value.dpr, 2) : null,
    series: points.value.map((p) => p.dpr),
    compareSeries: compareSeries((p) => p.dpr),
    level: statLevelFromRange(aggregate.value.dpr, 0.6, 0.95),
  },
]);

const ratingAvg = computed(() => avg(points.value.map((p) => p.hltv)));

const ratingChartData = computed(() => {
  const datasets: any[] = [
    {
      data: points.value.map((p) => p.hltv),
      borderColor: PRIMARY,
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      borderWidth: 2.5,
      fill: true,
      pointRadius: points.value.length <= 30 ? 3 : 1.5,
      pointHoverRadius: 5,
      pointBackgroundColor: PRIMARY,
      pointBorderColor: PRIMARY,
      pointBorderWidth: 1,
      tension: 0.35,
      spanGaps: true,
    },
    {
      data: points.value.map(() => ratingAvg.value),
      borderColor: "rgba(255,255,255,0.45)",
      borderWidth: 1.5,
      borderDash: [5, 5],
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 0,
    },
  ];
  if (hasCompare.value) {
    datasets.push({
      label: comparePlayer.value?.name ?? "B",
      data: alignToPrimary(comparePoints.value.map((p) => p.hltv)),
      borderColor: compareColor,
      backgroundColor: "transparent",
      borderWidth: 2,
      borderDash: [5, 4],
      fill: false,
      pointRadius: comparePoints.value.length <= 30 ? 2.5 : 1.25,
      pointHoverRadius: 4,
      pointBackgroundColor: compareColor,
      pointBorderColor: "#fff",
      pointBorderWidth: 1,
      tension: 0.35,
      spanGaps: true,
      isCompare: true,
    });
  }
  return {
    labels: labels.value,
    datasets,
  };
});

const seriesDefs = computed<
  {
    key: string;
    label: string;
    color: string;
    values: number[];
    digits: number;
  }[]
>(() => [
  {
    key: "hltv",
    label: t("pages.players.detail.intro.series.hltv"),
    color: "#fbbf24",
    values: points.value.map((p) => p.hltv),
    digits: 2,
  },
  {
    key: "adr",
    label: t("pages.players.detail.intro.series.adr"),
    color: "hsl(340, 80%, 62%)",
    values: points.value.map((p) => p.adr),
    digits: 1,
  },
  {
    key: "kd",
    label: t("pages.players.detail.intro.series.kd"),
    color: "hsl(142, 71%, 50%)",
    values: points.value.map((p) =>
      p.deaths > 0 ? p.kills / p.deaths : p.kills,
    ),
    digits: 2,
  },
  {
    key: "kpr",
    label: t("pages.players.detail.intro.series.kpr"),
    color: "hsl(280, 70%, 65%)",
    values: points.value.map((p) => p.kpr),
    digits: 2,
  },
  {
    key: "udr",
    label: t("pages.players.detail.intro.series.udr"),
    color: "hsl(160, 70%, 50%)",
    values: points.value.map((p) => p.udr),
    digits: 1,
  },
  {
    key: "kast",
    label: t("pages.players.detail.intro.series.kast"),
    color: "hsl(48, 96%, 60%)",
    values: points.value.map((p) => p.kast ?? NaN),
    digits: 0,
  },
]);

const seriesFilterOptions = computed(() =>
  seriesDefs.value.map((def) => ({
    key: def.key,
    label: def.label,
    title: statTitle(def.key) || def.label,
    desc: statDesc(def.key),
  })),
);
const activeSeriesKey = computed({
  get: () => activeSeries.value[0],
  set: (key: string) => toggleSeries(key),
});

const activeSeries = ref<string[]>(["hltv"]);

// Switching metric swaps to a totally different y-scale (HLTV ~0–2 vs ADR
// ~50–150), so a chart.js morph reads as the line "growing" up the axis.
// Instead: wink the current chart fully OUT (collapse to its centerline),
// swap the data while it's collapsed (invisible, animation suppressed so it
// doesn't morph), then wink the new one back IN. Genuine data reloads don't
// touch `recentCollapsed`, so they still animate smoothly in place.
const suppressRecentAnim = ref(false);
const recentCollapsed = ref(false);
function toggleSeries(key: string) {
  if (activeSeries.value[0] === key) {
    return;
  }
  suppressRecentAnim.value = true;
  recentCollapsed.value = true; // wink out
  setTimeout(() => {
    activeSeries.value = [key]; // swap data while collapsed + invisible
    setTimeout(() => {
      recentCollapsed.value = false; // wink the new chart back in
    }, 40);
    setTimeout(() => {
      suppressRecentAnim.value = false;
    }, 400);
  }, 240);
}

// When a data reload SHRINKS the series (e.g. range L30 → 7D), chart.js removes
// points and rescales the axis — it reads as a jarring full redraw. Suppress
// the animation for just that update so it snaps cleanly. Growing keeps its
// point-slide-in animation (it already looks good). The 'pre'-flush watcher
// runs before the chart re-renders, so animation:false is applied in time.
let recentSeriesInitialized = false;
watch(
  () => points.value.length,
  (len, prevLen) => {
    if (!recentSeriesInitialized) {
      recentSeriesInitialized = true;
      return;
    }
    if (len < (prevLen ?? 0) && !recentCollapsed.value) {
      suppressRecentAnim.value = true;
      window.setTimeout(() => {
        suppressRecentAnim.value = false;
      }, 80);
    }
  },
);

const compareSeriesDefs = computed(() => {
  const list = comparePoints.value;
  return {
    hltv: list.map((p) => p.hltv),
    adr: list.map((p) => p.adr),
    kd: list.map((p) => (p.deaths > 0 ? p.kills / p.deaths : p.kills)),
    kpr: list.map((p) => p.kpr),
    udr: list.map((p) => p.udr),
    kast: list.map((p) => p.kast ?? NaN),
  } as Record<string, number[]>;
});

// Good/bad anchors per metric — feed the metric-card quality chevron so the
// number reads good/bad at a glance without colorizing the value itself.
const QUALITY_THRESHOLDS: Record<string, { good: number; bad: number }> = {
  hltv: { good: 1.15, bad: 0.85 },
  adr: { good: 90, bad: 55 },
  kd: { good: 1.3, bad: 0.8 },
  kpr: { good: 0.85, bad: 0.5 },
  udr: { good: 12, bad: 4 },
  kast: { good: 75, bad: 55 },
};
const recentChartData = computed(() => {
  const datasets: any[] = [];
  const compareName = comparePlayer.value?.name ?? "B";
  for (const def of seriesDefs.value) {
    if (!activeSeries.value.includes(def.key)) {
      continue;
    }
    datasets.push({
      label: def.label,
      data: def.values.map((v) => (Number.isFinite(v) ? v : null)),
      borderColor: PRIMARY,
      backgroundColor: PRIMARY,
      borderWidth: 2.5,
      fill: false,
      pointRadius: points.value.length <= 30 ? 3 : 1.5,
      pointHoverRadius: 5,
      pointBackgroundColor: PRIMARY,
      pointBorderColor: PRIMARY,
      pointBorderWidth: 1,
      tension: 0.35,
      spanGaps: true,
    });
    const seriesAvg = avg(def.values.filter((v) => Number.isFinite(v)));
    datasets.push({
      label: `${def.label} avg`,
      data: def.values.map(() => seriesAvg),
      borderColor: "rgba(255,255,255,0.4)",
      borderWidth: 1.25,
      borderDash: [5, 5],
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      isAvg: true,
    });
    if (hasCompare.value) {
      datasets.push({
        label: `${def.label} · ${compareName}`,
        data: alignToPrimary(compareSeriesDefs.value[def.key] ?? []),
        borderColor: compareColor,
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5, 4],
        fill: false,
        pointRadius: comparePoints.value.length <= 30 ? 2.5 : 1.25,
        pointHoverRadius: 4,
        pointBackgroundColor: compareColor,
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
        tension: 0.35,
        spanGaps: true,
        isCompare: true,
      });
    }
  }
  return {
    labels: labels.value,
    datasets,
  };
});

const lineTooltipBase = {
  enabled: true,
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
  boxPadding: 6,
  backgroundColor: "rgba(20, 22, 28, 0.96)",
  borderColor: "#fbbf24",
  borderWidth: 1,
  titleColor: "rgba(255, 255, 255, 0.9)",
  titleFont: { size: 11, weight: "600", family: "'Oxanium', sans-serif" },
  bodyColor: "rgba(255, 255, 255, 0.85)",
  bodyFont: { size: 12, family: "'Oxanium', sans-serif" },
  padding: 10,
  cornerRadius: 2,
  caretSize: 6,
};

const ratingOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 750, easing: "easeInOutQuart" as const },
  interaction: { mode: "index" as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      ...lineTooltipBase,
      filter: (item: any) =>
        item.datasetIndex === 0 || item.dataset?.isCompare,
      callbacks: {
        title: (items: any[]) => tooltipTitle(items?.[0]?.dataIndex),
        label: (item: any) => {
          const who = item.dataset?.isCompare
            ? (comparePlayer.value?.name ?? "B")
            : t("pages.players.detail.intro.series.hltv");
          return `${who}  ${item.parsed.y?.toFixed(2) ?? "—"}`;
        },
        afterLabel: (item: any) =>
          item.dataset?.isCompare ? [] : tooltipAfter(item?.dataIndex),
      },
    },
  },
  scales: {
    y: {
      grid: { color: "rgba(255,255,255,0.05)" },
      ticks: { color: "rgba(255,255,255,0.6)", font: { size: 10 } },
    },
    x: {
      grid: { display: false },
      ticks: {
        color: "rgba(255,255,255,0.6)",
        font: { size: 10 },
        autoSkip: true,
        maxTicksLimit: 8,
        maxRotation: 0,
        callback: (_v: any, index: number) => xLabel(index),
      },
    },
  },
}));

const recentOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: suppressRecentAnim.value
    ? (false as const)
    : { duration: 750, easing: "easeInOutQuart" as const },
  interaction: { mode: "index" as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      ...lineTooltipBase,
      filter: (item: any) => !item.dataset?.isAvg,
      callbacks: {
        title: (items: any[]) => tooltipTitle(items?.[0]?.dataIndex),
        label: (item: any) =>
          `${item.dataset.label}  ${item.parsed.y?.toFixed(2) ?? "—"}`,
        afterLabel: (item: any) =>
          item.dataset?.isCompare ? [] : tooltipAfter(item?.dataIndex),
      },
    },
  },
  scales: {
    y: {
      grid: { color: "rgba(255,255,255,0.05)" },
      ticks: { color: "rgba(255,255,255,0.6)", font: { size: 10 } },
    },
    x: {
      grid: { display: false },
      ticks: {
        color: "rgba(255,255,255,0.6)",
        font: { size: 10 },
        autoSkip: true,
        maxTicksLimit: 8,
        maxRotation: 0,
        callback: (_v: any, index: number) => xLabel(index),
      },
    },
  },
}));

function xLabel(index: number): string {
  const p = points.value[index];
  if (!p) {
    return "";
  }
  return new Date(p.date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function tooltipTitle(index: number | undefined): string {
  if (index === undefined) {
    return "";
  }
  const p = points.value[index];
  if (!p) {
    return "";
  }
  return `${p.mapName} · ${p.opponentName}`;
}

function tooltipAfter(index: number | undefined): string[] {
  if (index === undefined) {
    return [];
  }
  const p = points.value[index];
  if (!p) {
    return [];
  }
  const lines: string[] = [];
  const resultLabel =
    p.result === "won"
      ? t("pages.players.detail.intro.tooltip.won")
      : p.result === "lost"
        ? t("pages.players.detail.intro.tooltip.lost")
        : p.result === "tied"
          ? t("pages.players.detail.intro.tooltip.tied")
          : "—";
  lines.push(`${resultLabel}  ${p.scorePlayer}–${p.scoreOpponent}`);
  lines.push(`${p.kills}/${p.deaths}/${p.assists}`);
  lines.push(
    `${t("pages.players.detail.intro.adr")} ${p.adr.toFixed(0)} · ${t("pages.players.detail.intro.series.kast")} ${p.kast === null ? "—" : Math.round(p.kast) + "%"}`,
  );
  return lines;
}
</script>

<template>
  <div>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div :class="[tacticalSectionLabelClasses, 'mb-0']">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.players.detail.intro.section") }}
        <span
          v-if="hasData"
          class="font-mono text-[0.62rem] tracking-[0.18em] text-muted-foreground/70"
        >
          ·
          {{ $t("pages.players.detail.intro.last_n", { n: aggregate.matches }) }}
        </span>
      </div>
    </div>

    <div
      v-if="loading && !hasData"
      class="flex min-h-[200px] items-center justify-center rounded-lg border border-border/60 bg-card/30"
    >
      <div
        class="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        <span class="relative flex h-2 w-2">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
          ></span>
          <span
            class="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tac-amber))]"
          ></span>
        </span>
        {{ $t("pages.players.detail.intro.loading") }}
      </div>
    </div>

    <Empty v-else-if="!hasData" class="min-h-[200px] border border-border/60">
      <EmptyTitle>{{
        $t("pages.players.detail.intro.empty_title")
      }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.players.detail.intro.empty_description") }}
      </EmptyDescription>
    </Empty>

    <div v-else class="flex flex-col gap-4 md:gap-6">
      <div class="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <AnimatedCard
          v-for="card in metricCards"
          :key="card.key"
          variant="elevated"
          class="flex flex-col gap-1.5 p-4"
        >
          <div
            class="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            <StatLabel :stat="card.key" :label="card.label" />
          </div>
          <div class="flex items-center gap-1.5">
            <AnimatedStat
              :value="card.value"
              class="font-sans text-3xl font-bold leading-none"
            />
            <StatChevron :level="card.level" class="h-5 w-5" />
          </div>
          <AnimatedStat
            v-if="card.subtext"
            :value="card.subtext"
            class="font-mono text-[0.6rem] tracking-[0.06em] text-muted-foreground/80"
          />
          <div
            v-if="card.compareValue !== null"
            class="font-mono text-[0.62rem] tracking-[0.1em]"
            style="color: #38bdf8"
          >
            {{ card.value }} {{ $t("pages.players.detail.compare.vs") }}
            {{ card.compareValue }}
          </div>
          <div class="mt-auto h-9 pt-1">
            <Line
              :data="sparkData(card.series, card.compareSeries)"
              :options="sparkOptions"
            />
          </div>
        </AnimatedCard>
      </div>

      <div class="grid grid-cols-1 items-stretch gap-4 md:gap-6 lg:grid-cols-3">
        <div class="flex flex-col gap-4">
          <div
            class="flex items-center justify-around gap-4 rounded-lg border border-border/60 bg-card/30 p-3"
          >
            <FiveStackToolTip
              v-if="aggregate.kast !== null"
              as-child
              side="top"
              :delay-duration="120"
            >
              <template #trigger>
                <div class="flex cursor-help flex-col items-center">
                  <RadialStat
                    :value="fmtPct(aggregate.kast)"
                    :label="$t('pages.players.detail.intro.series.kast')"
                    :percentage="aggregate.kast"
                    :level="statLevelFromRange(aggregate.kast, 75, 55)"
                  />
                  <div
                    v-if="hasCompare && compareAggregate.kast !== null"
                    class="mt-1 font-mono text-[0.6rem]"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{ fmtPct(compareAggregate.kast) }}
                  </div>
                </div>
              </template>
              <div class="max-w-[220px] space-y-0.5">
                <div
                  class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-foreground"
                >
                  {{ statTitle("kast") }}
                </div>
                <div class="text-xs leading-snug text-muted-foreground">
                  {{ statDesc("kast") }}
                </div>
              </div>
            </FiveStackToolTip>
            <FiveStackToolTip as-child side="top" :delay-duration="120">
              <template #trigger>
                <div class="flex cursor-help flex-col items-center">
                  <RadialStat
                    :value="fmtPct(aggregate.hsPct)"
                    :label="$t('pages.players.detail.intro.hs_pct')"
                    :percentage="aggregate.hsPct ?? 0"
                    :level="statLevelFromRange(aggregate.hsPct ?? 0, 55, 25)"
                  />
                  <div
                    v-if="hasCompare && compareAggregate.hsPct !== null"
                    class="mt-1 font-mono text-[0.6rem]"
                    style="color: #38bdf8"
                  >
                    {{ $t("pages.players.detail.compare.vs") }}
                    {{ fmtPct(compareAggregate.hsPct) }}
                  </div>
                </div>
              </template>
              <div class="max-w-[220px] space-y-0.5">
                <div
                  class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-foreground"
                >
                  {{ statTitle("hs") }}
                </div>
                <div class="text-xs leading-snug text-muted-foreground">
                  {{ statDesc("hs") }}
                </div>
              </div>
            </FiveStackToolTip>
          </div>

          <AnimatedCard variant="elevated" class="flex flex-col p-3">
            <CardHeader class="flex flex-col gap-0.5 p-0 pb-1">
              <CardTitle
                class="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground"
              >
                {{ $t("pages.players.detail.recent_wins_and_losses") }}
              </CardTitle>
              <span
                class="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70"
              >
                {{ $t("pages.players.detail.last_n_matches", "Last 10") }}
              </span>
            </CardHeader>
            <CardContent class="p-0 sm:p-0">
              <LastTenWinsAndLosses
                class="mx-auto aspect-square w-full max-w-[320px]"
                :steam_id="steamId"
                :match_type="matchType ?? null"
                :source="source ?? null"
              />
            </CardContent>
          </AnimatedCard>
        </div>

        <AnimatedCard
          variant="elevated"
          class="flex flex-col px-4 pb-4 pt-2.5 lg:col-span-2"
        >
          <CardHeader class="flex flex-col gap-2 p-0 pb-2 sm:p-0 sm:pb-2">
            <AnimatedFilters
              v-model="activeSeriesKey"
              :options="seriesFilterOptions"
            />
          </CardHeader>
          <CardContent class="flex flex-1 flex-col p-0 sm:p-0">
            <div
              class="min-h-[360px] flex-1 origin-center transition-transform duration-200 ease-in-out"
              :class="recentCollapsed ? 'scale-y-0' : 'scale-y-100'"
            >
              <Line :data="recentChartData" :options="recentOptions" />
            </div>
          </CardContent>
        </AnimatedCard>
      </div>
    </div>
  </div>
</template>
