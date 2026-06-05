<script lang="ts" setup>
import { computed, ref, watch, onUnmounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { useI18n } from "vue-i18n";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "vue-chartjs";
import LineupMember from "~/components/match/LineupMember.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { useMatchSide } from "~/composables/useMatchSide";
import { hltvColor } from "~/utils/statTiers";
import cleanMapName from "~/utilities/cleanMapName";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const AMBER = "#fbbf24";
const CYAN = "#38bdf8";

const { t } = useI18n();

const BUY_ECO = "eco";
const BUY_FORCE = "force";
const BUY_FULL = "full";
const BUY_PISTOL = "pistol";

const MATCHUPS = [
  { key: "full_v_full", own: BUY_FULL, enemy: BUY_FULL },
  { key: "full_v_force", own: BUY_FULL, enemy: BUY_FORCE },
  { key: "force_v_full", own: BUY_FORCE, enemy: BUY_FULL },
  { key: "full_v_eco", own: BUY_FULL, enemy: BUY_ECO },
  { key: "eco_v_full", own: BUY_ECO, enemy: BUY_FULL },
  { key: "pistol_v_pistol", own: BUY_PISTOL, enemy: BUY_PISTOL },
] as const;

type MatchupKey = (typeof MATCHUPS)[number]["key"];

const EVEN_KEYS: MatchupKey[] = ["pistol_v_pistol", "full_v_full"];
const ADVANTAGE_KEYS: MatchupKey[] = ["full_v_eco", "full_v_force"];
const UPSET_KEYS: MatchupKey[] = ["eco_v_full", "force_v_full"];

const props = defineProps<{
  match: any;
  lineup: any;
  combineWith?: any;
  selectedMapId?: string | null;
}>();

const side = useMatchSide();

const lineupsToRender = computed(() =>
  props.combineWith ? [props.lineup, props.combineWith] : [props.lineup],
);

const teamA = computed(() => lineupsToRender.value[0] ?? null);
const teamB = computed(() => lineupsToRender.value[1] ?? null);

// Buy-type aggregates come from the backend views v_match_lineup_buy_types
// (team rounds/wins per matchup) and v_match_player_buy_types (per-player
// kills/deaths/rounds per matchup) — no round classification on the client.
const { client: apolloClient } = useApolloClient();
const teamBuyRows = ref<any[]>([]);
const playerBuyRows = ref<any[]>([]);

// Hasura allows only one top-level field per subscription, so the team and
// player aggregates are two separate subscriptions.
const TEAM_BUY_SUB = gql`
  subscription MatchLineupBuyTypes($matchId: uuid!) {
    v_match_lineup_buy_types(where: { match_id: { _eq: $matchId } }) {
      match_map_id
      match_lineup_id
      side
      matchup
      rounds
      wins
    }
  }
`;
const PLAYER_BUY_SUB = gql`
  subscription MatchPlayerBuyTypes($matchId: uuid!) {
    v_match_player_buy_types(where: { match_id: { _eq: $matchId } }) {
      match_map_id
      match_lineup_id
      steam_id
      side
      matchup
      rounds
      kills
      deaths
    }
  }
`;
let teamBuySub: { unsubscribe: () => void } | null = null;
let playerBuySub: { unsubscribe: () => void } | null = null;
watch(
  () => props.match?.id,
  (id) => {
    teamBuySub?.unsubscribe();
    playerBuySub?.unsubscribe();
    teamBuySub = null;
    playerBuySub = null;
    teamBuyRows.value = [];
    playerBuyRows.value = [];
    if (!id) {
      return;
    }
    teamBuySub = apolloClient
      .subscribe({ query: TEAM_BUY_SUB, variables: { matchId: id } })
      .subscribe({
        next: ({ data }: any) => {
          teamBuyRows.value = data?.v_match_lineup_buy_types ?? [];
        },
        error: () => {
          teamBuyRows.value = [];
        },
      });
    playerBuySub = apolloClient
      .subscribe({ query: PLAYER_BUY_SUB, variables: { matchId: id } })
      .subscribe({
        next: ({ data }: any) => {
          playerBuyRows.value = data?.v_match_player_buy_types ?? [];
        },
        error: () => {
          playerBuyRows.value = [];
        },
      });
  },
  { immediate: true },
);
onUnmounted(() => {
  teamBuySub?.unsubscribe();
  playerBuySub?.unsubscribe();
});

// 'all' -> both sides, else the view's normalized side token.
function sideToken(): "t" | "ct" | null {
  if (side.value === "CT") {
    return "ct";
  }
  if (side.value === "T") {
    return "t";
  }
  return null;
}

function rowMatches(r: any): boolean {
  if (props.selectedMapId && r.match_map_id !== props.selectedMapId) {
    return false;
  }
  const token = sideToken();
  if (token && r.side !== token) {
    return false;
  }
  return true;
}

// Team rounds/wins for a lineup in a matchup (map + side filter applied).
function teamBucket(lineupId: string | undefined, key: MatchupKey) {
  let rounds = 0;
  let won = 0;
  if (lineupId) {
    for (const r of teamBuyRows.value) {
      if (
        String(r.match_lineup_id) !== String(lineupId) ||
        r.matchup !== key ||
        !rowMatches(r)
      ) {
        continue;
      }
      rounds += r.rounds ?? 0;
      won += r.wins ?? 0;
    }
  }
  return { rounds, won };
}

function winPct(bucket: { won: number; rounds: number }): number {
  if (bucket.rounds === 0) {
    return 0;
  }
  return Math.round((bucket.won / bucket.rounds) * 100);
}

// One row per buy matchup, comparing each team's record in that economic
// scenario side by side (amber = team A, cyan = team B). Matchups where
// neither team played are dropped so the list stays short.
const buyComparison = computed(() => {
  const a = teamA.value;
  const b = teamB.value;
  const rows: Array<{
    key: MatchupKey;
    aRounds: number;
    aWon: number;
    aPct: number;
    bRounds: number;
    bWon: number;
    bPct: number;
    f1: number;
    f2: number;
    higher: 0 | 1 | 2;
  }> = [];
  for (const m of MATCHUPS) {
    const ra = teamBucket(a?.id, m.key);
    const rb = teamBucket(b?.id, m.key);
    if (ra.rounds === 0 && rb.rounds === 0) {
      continue;
    }
    const pa = winPct(ra);
    const pb = winPct(rb);
    const sum = pa + pb;
    const f1 = sum > 0 ? Math.round((pa / sum) * 100) : 50;
    const higher: 0 | 1 | 2 =
      ra.rounds === 0
        ? 2
        : rb.rounds === 0
          ? 1
          : pa === pb
            ? 0
            : pa > pb
              ? 1
              : 2;
    rows.push({
      key: m.key,
      aRounds: ra.rounds,
      aWon: ra.won,
      aPct: pa,
      bRounds: rb.rounds,
      bWon: rb.won,
      bPct: pb,
      f1,
      f2: 100 - f1,
      higher,
    });
  }
  return rows;
});

const rowsByKey = computed(
  () => new Map(buyComparison.value.map((r) => [r.key, r])),
);

// Even buys (both teams on the same economy) are a symmetric head-to-head, so
// they render as tug-of-war rows. Only matchups that actually happened show.
const evenRows = computed(() =>
  EVEN_KEYS.map((k) => rowsByKey.value.get(k)).filter(
    (r): r is NonNullable<typeof r> => !!r,
  ),
);

// "When a team out-bought the other, did they convert?" — independent per team
// (different round sets), so each is its own 0-100 bar. ADVANTAGE_KEYS read each
// team's win rate while holding the money edge; UPSET_KEYS read it while behind.
function sideRate(keys: MatchupKey[]) {
  let aWon = 0;
  let aRounds = 0;
  let bWon = 0;
  let bRounds = 0;
  for (const k of keys) {
    const row = rowsByKey.value.get(k);
    if (!row) {
      continue;
    }
    aWon += row.aWon;
    aRounds += row.aRounds;
    bWon += row.bWon;
    bRounds += row.bRounds;
  }
  return {
    aWon,
    aRounds,
    aPct: aRounds ? Math.round((aWon / aRounds) * 100) : 0,
    bWon,
    bRounds,
    bPct: bRounds ? Math.round((bWon / bRounds) * 100) : 0,
  };
}

const advantage = computed(() => sideRate(ADVANTAGE_KEYS));
const upsets = computed(() => sideRate(UPSET_KEYS));

const hasAdvantage = computed(
  () => advantage.value.aRounds > 0 || advantage.value.bRounds > 0,
);
const hasUpsets = computed(
  () => upsets.value.aRounds > 0 || upsets.value.bRounds > 0,
);
const hasAnyData = computed(
  () => evenRows.value.length > 0 || hasAdvantage.value || hasUpsets.value,
);

// Per-player kills/deaths/rounds in a matchup from the player view (map + side
// filter applied). rounds = distinct rounds summed across maps/sides.
function playerBucketStats(member: any, lp: any, key: MatchupKey) {
  let kills = 0;
  let deaths = 0;
  let rounds = 0;
  const steamId = String(member.steam_id ?? "");
  for (const r of playerBuyRows.value) {
    if (
      String(r.match_lineup_id) !== String(lp.id) ||
      String(r.steam_id) !== steamId ||
      r.matchup !== key ||
      !rowMatches(r)
    ) {
      continue;
    }
    kills += r.kills ?? 0;
    deaths += r.deaths ?? 0;
    rounds += r.rounds ?? 0;
  }
  return { kills, deaths, rounds };
}

function hltvRating(kills: number, deaths: number, rounds: number): number | null {
  if (rounds === 0) {
    return null;
  }
  const kpr = kills / rounds;
  const dpr = deaths / rounds;
  const impact = 2.13 * kpr - 0.41;
  return 0.3591 * kpr - 0.5329 * dpr + 0.2372 * impact + 0.1587;
}

// Per-player rows for one team in one matchup, computed once and sorted
// by rating. Only built for an expanded matchup.
function membersWithStats(lp: any, key: MatchupKey) {
  return (lp.lineup_players ?? [])
    .map((member: any) => {
      const s = playerBucketStats(member, lp, key);
      return {
        member,
        kills: s.kills,
        deaths: s.deaths,
        rounds: s.rounds,
        rating: hltvRating(s.kills, s.deaths, s.rounds),
      };
    })
    .sort(
      (x: { rating: number | null }, y: { rating: number | null }) =>
        (y.rating ?? -1) - (x.rating ?? -1),
    );
}

function fmtRating(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

// Which matchup's per-player breakdown is shown (and highlighted in the chart).
// Empty = none selected: all bars full, no breakdown.
const selectedMatchup = ref("");

const mapLabel = computed(() => {
  if (!props.selectedMapId) {
    return null;
  }
  const match_map = props.match.match_maps.find(
    (m: any) => m.id === props.selectedMapId,
  );
  if (!match_map?.map?.name) {
    return null;
  }
  return cleanMapName(match_map.map.name);
});

// Vertical grouped bar chart: one group per economic matchup, two bars (your
// team = gold, opponent = sky blue) showing each side's win rate, with faint
// vertical separators between groups. Every group stays full color — the
// filter pills and per-player breakdown below carry the active selection.
const buyChartData = computed(() => ({
  labels: buyComparison.value.map((r) =>
    t(`match.buy_types.matchups.${r.key}`),
  ),
  datasets: [
    {
      label: teamA.value?.name ?? t("match.buy_types.you"),
      data: buyComparison.value.map((r) => (r.aRounds ? r.aPct : null)),
      backgroundColor: AMBER,
      hoverBackgroundColor: AMBER,
      borderRadius: 3,
      borderSkipped: false,
      maxBarThickness: 34,
    },
    {
      label: teamB.value?.name ?? t("match.buy_types.opponent"),
      data: buyComparison.value.map((r) => (r.bRounds ? r.bPct : null)),
      backgroundColor: CYAN,
      hoverBackgroundColor: CYAN,
      borderRadius: 3,
      borderSkipped: false,
      maxBarThickness: 34,
    },
  ],
}));

// Faint vertical separators between each matchup group.
const buySeparatorsPlugin = {
  id: "buySeparators",
  afterDraw: (chart: any) => {
    const x = chart.scales?.x;
    const area = chart.chartArea;
    if (!x || !area) {
      return;
    }
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    const count = chart.data?.labels?.length ?? 0;
    for (let i = 0; i < count - 1; i++) {
      const mid = (x.getPixelForValue(i) + x.getPixelForValue(i + 1)) / 2;
      ctx.beginPath();
      ctx.moveTo(mid, area.top);
      ctx.lineTo(mid, area.bottom);
      ctx.stroke();
    }
    ctx.restore();
  },
};
// Soft amber bloom rising from the base of the selected matchup group — a
// faint elliptical glow anchored at the x-axis (so it hugs the bars instead of
// floating above short ones) that eases between groups as the filter changes.
const buyGlowPlugin = {
  id: "buyGlow",
  beforeDatasetsDraw: (chart: any) => {
    if (!chart.ctx) {
      return;
    }
    const sel = chart.options?.plugins?.buyGlow?.selected;
    const i = buyComparison.value.findIndex((r) => r.key === sel);
    if (i < 0) {
      return;
    }
    const x = chart.scales?.x;
    const area = chart.chartArea;
    if (!x || !area) {
      return;
    }
    const count = buyComparison.value.length;
    const target = x.getPixelForValue(i);
    const spacing =
      count > 1
        ? Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0))
        : area.right - area.left;

    // Ease the glow's x toward the selected group, redrawing until it settles.
    const state = chart._buyGlow || (chart._buyGlow = { x: target });
    const diff = target - state.x;
    if (Math.abs(diff) > 0.5) {
      state.x += diff * 0.2;
      requestAnimationFrame(() => chart.ctx && chart.draw());
    } else {
      state.x = target;
    }

    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    ctx.clip();
    const rx = spacing * 0.42;
    const ry = (area.bottom - area.top) * 0.7;
    ctx.translate(state.x, area.bottom);
    ctx.scale(rx, ry);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, "rgba(251, 191, 36, 0.13)");
    grad.addColorStop(0.5, "rgba(251, 191, 36, 0.05)");
    grad.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  },
};
const buyChartPlugins = [buyGlowPlugin, buySeparatorsPlugin];

const buyChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  categoryPercentage: 0.7,
  barPercentage: 0.9,
  plugins: {
    buyGlow: { selected: selectedMatchup.value },
    legend: {
      display: true,
      position: "top" as const,
      labels: {
        color: "rgba(255, 255, 255, 0.8)",
        usePointStyle: true,
        pointStyle: "rectRounded",
        boxWidth: 10,
        boxHeight: 10,
        padding: 16,
        font: { size: 11, family: "'Oxanium', sans-serif" },
      },
    },
    tooltip: {
      backgroundColor: "rgba(20, 22, 28, 0.96)",
      borderColor: AMBER,
      borderWidth: 1,
      titleColor: "rgba(255, 255, 255, 0.9)",
      titleFont: { size: 11, weight: "600", family: "'Oxanium', sans-serif" },
      bodyColor: "rgba(255, 255, 255, 0.85)",
      bodyFont: { size: 12, family: "'Oxanium', sans-serif" },
      padding: 10,
      cornerRadius: 2,
      callbacks: {
        label: (item: any) => {
          const row = buyComparison.value[item.dataIndex];
          if (!row) {
            return "";
          }
          const won = item.datasetIndex === 0 ? row.aWon : row.bWon;
          const rounds = item.datasetIndex === 0 ? row.aRounds : row.bRounds;
          const pctVal = item.datasetIndex === 0 ? row.aPct : row.bPct;
          return `${item.dataset.label}: ${pctVal}%  (${won}/${rounds})`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      grid: { display: false },
      title: {
        display: true,
        text: t("match.buy_types.win_axis"),
        color: "rgba(255, 255, 255, 0.5)",
        font: { size: 10, family: "'Oxanium', sans-serif" },
      },
      ticks: {
        color: "rgba(255, 255, 255, 0.7)",
        font: { size: 11 },
        padding: 8,
        stepSize: 25,
        callback: (value: any) => `${value}%`,
      },
    },
    x: {
      grid: { display: false },
      ticks: {
        color: "rgba(255, 255, 255, 0.7)",
        font: { size: 11 },
        padding: 6,
        maxRotation: 45,
        minRotation: 0,
        autoSkip: false,
      },
    },
  },
  layout: { padding: { top: 4, right: 8, bottom: 2, left: 4 } },
}));

const matchupFilterOptions = computed(() =>
  buyComparison.value.map((r) => ({
    key: r.key,
    label: t(`match.buy_types.matchups.${r.key}`),
  })),
);

// Default the breakdown to Full v Full (else the first available matchup),
// and re-seed if the current pick falls out of the data (map/side filter).
watch(
  buyComparison,
  (rows) => {
    const keys = rows.map((r) => r.key as string);
    if (!selectedMatchup.value || !keys.includes(selectedMatchup.value)) {
      selectedMatchup.value = keys.includes("full_v_full")
        ? "full_v_full"
        : (keys[0] ?? "");
    }
  },
  { immediate: true },
);

const expandedRows = computed(() =>
  buyComparison.value.filter((r) => r.key === selectedMatchup.value),
);
</script>

<template>
  <div class="grid gap-5">
    <div
      v-if="!hasAnyData"
      class="rounded-md border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground"
    >
      {{ $t("match.buy_types.no_data") }}
    </div>

    <template v-else>
      <!-- Matchup picker (drives the per-player breakdown below) at the top -->
      <div class="px-1">
        <AnimatedFilters
          v-model="selectedMatchup"
          :options="matchupFilterOptions"
        />
      </div>
      <!-- Win rate per economic matchup -->
      <div class="h-[300px] sm:h-[340px]">
        <Bar
          :data="buyChartData"
          :options="buyChartOptions"
          :plugins="buyChartPlugins"
        />
      </div>
    </template>

    <div
      v-for="row of expandedRows"
      :key="row.key"
      class="rounded-md border border-border/60 bg-background/40 overflow-hidden"
    >
      <div
        class="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-1.5"
      >
        <span
          class="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-foreground/80"
        >
          {{ $t(`match.buy_types.matchups.${row.key}`) }}
        </span>
        <span class="text-[0.6rem] text-muted-foreground tabular-nums">
          {{ row.aWon }}/{{ row.aRounds }} · {{ row.bWon }}/{{ row.bRounds }}
        </span>
      </div>
      <div class="grid gap-5 lg:grid-cols-2 p-3">
        <div
          v-for="(lp, lpIdx) of lineupsToRender"
          :key="lp.id"
          class="grid gap-1.5"
        >
          <span
            class="text-[0.6rem] uppercase tracking-[0.16em] truncate"
            :class="lpIdx === 0 ? 'text-[#fbbf24]' : 'text-[#38bdf8]'"
          >
            {{ lp.name }}
          </span>
          <template v-if="(lpIdx === 0 ? row.aRounds : row.bRounds) > 0">
            <div
              v-for="entry of membersWithStats(lp, row.key)"
              :key="entry.member.steam_id"
              class="flex items-center justify-between gap-2"
            >
              <lineup-member :member="entry.member" :lineup_id="lp.id" />
              <div
                class="flex items-center gap-3 shrink-0 tabular-nums text-xs"
              >
                <span class="text-muted-foreground">
                  <AnimatedStat :value="entry.kills" />-<AnimatedStat
                    :value="entry.deaths"
                  />
                </span>
                <span class="font-bold">
                  <AnimatedStat
                    :value="fmtRating(entry.rating)"
                    class="w-10 text-right"
                    :style="{ color: hltvColor(entry.rating) }"
                  />
                </span>
              </div>
            </div>
          </template>
          <span v-else class="text-[0.7rem] text-muted-foreground/70">
            {{ $t("match.buy_types.no_data") }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
