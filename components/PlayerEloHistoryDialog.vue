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

// Drill-down view for a player's ELO history. The page-level chart
// buckets at wide ranges to surface the trend; this dialog stays raw
// so every match is visible — that's the trade-off it exists for.

type Mode = "all" | "Competitive" | "Wingman" | "Duel";
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

const props = defineProps<{
  open: boolean;
  playerId: string | number | null;
  playerName?: string | null;
  defaultMode?: Mode;
  defaultRange?: RangeKey;
  excludeTournaments?: boolean;
}>();

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
const loading = ref(false);
let subHandle: { unsubscribe: () => void } | null = null;
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

const ELO_HISTORY_SUB = gql`
  subscription PlayerEloHistoryDrillDown(
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

function teardown() {
  if (subHandle) {
    subHandle.unsubscribe();
    subHandle = null;
  }
}

function startSubscription() {
  teardown();
  if (!props.open || !props.playerId) return;
  loading.value = true;
  const gen = ++queryGen;
  const observable = client.subscribe({
    query: ELO_HISTORY_SUB,
    variables: { where: whereClause.value, limit: rangeLimit.value },
  });
  subHandle = observable.subscribe({
    next: ({ data }: any) => {
      if (gen !== queryGen) return;
      history.value = (data?.v_player_elo ?? []) as EloEntry[];
      loading.value = false;
    },
    error: () => {
      if (gen !== queryGen) return;
      loading.value = false;
    },
  });
}

watch(
  () => [
    props.open,
    props.playerId,
    selectedRange.value,
    props.excludeTournaments,
  ],
  () => {
    if (props.open) startSubscription();
    else teardown();
  },
  { immediate: true },
);

const filteredHistory = computed<EloEntry[]>(() => {
  if (selectedMode.value === "all") return history.value;
  return history.value.filter((e) => e.type === selectedMode.value);
});

const chartSeries = computed(() => {
  const groupBy = (m: Mode) => history.value.filter((e) => e.type === m);

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

  return visible.filter((s) => s.history.length > 0);
});

const stats = computed(() => {
  const list = filteredHistory.value;
  // Headline ELO values (current/peak/lowest) anchor to Competitive when
  // no specific mode is chosen — otherwise the most recent Wingman/Duel
  // match would flip "Current ELO" away from the player's primary mode.
  const headlineList =
    selectedMode.value === "all"
      ? history.value.filter((e) => e.type === "Competitive")
      : list;
  if (list.length === 0) {
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

  for (const e of list) {
    if (e.match_result === "won" || e.match_result === "win") wins++;
    else if (e.match_result === "lost" || e.match_result === "loss") losses++;
    else if (e.match_result === "tied" || e.match_result === "tie") ties++;
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
    total: list.length,
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

const modeOptions = computed<{ key: Mode; label: string }[]>(() => [
  { key: "all", label: t("pages.leaderboard.match_types.all") },
  { key: "Competitive", label: t("pages.leaderboard.match_types.competitive") },
  { key: "Wingman", label: t("pages.leaderboard.match_types.wingman") },
  { key: "Duel", label: t("pages.leaderboard.match_types.duel") },
]);

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
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent
      class="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto p-0 gap-0"
    >
      <DialogHeader class="px-6 pt-6 pb-3 border-b border-border/50">
        <div
          class="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
          {{ $t("pages.players.detail.elo_history_dialog.eyebrow") }}
        </div>
        <DialogTitle class="text-2xl font-bold uppercase tracking-[0.04em]">
          {{
            $t("pages.players.detail.elo_history_dialog.title", {
              name:
                playerName ??
                $t("pages.players.detail.elo_history_dialog.default_player"),
            })
          }}
        </DialogTitle>
        <DialogDescription class="text-sm text-muted-foreground">
          {{ $t("pages.players.detail.elo_history_dialog.description") }}
        </DialogDescription>
      </DialogHeader>

      <div
        class="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-border/50"
      >
        <div class="flex items-center gap-1.5">
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground mr-1"
          >
            {{ $t("pages.players.detail.range") }}
          </span>
          <button
            v-for="r in ranges"
            :key="r.key"
            type="button"
            class="rounded border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] transition-colors"
            :class="
              selectedRange === r.key
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))]'
                : 'border-border/60 bg-card/40 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground'
            "
            @click="selectedRange = r.key"
          >
            {{ r.label }}
          </button>
        </div>
        <div class="flex items-center gap-1.5 ml-auto">
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground mr-1"
          >
            {{ $t("pages.players.detail.elo_history_dialog.mode") }}
          </span>
          <button
            v-for="m in modeOptions"
            :key="m.key"
            type="button"
            class="rounded border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] transition-colors"
            :class="
              selectedMode === m.key
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))]'
                : 'border-border/60 bg-card/40 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground'
            "
            @click="selectedMode = m.key"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

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
          <div
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight"
          >
            {{ fmtInt(stats.current) }}
          </div>
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
          <div
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight text-[hsl(var(--tac-amber))]"
          >
            {{ fmtInt(stats.peak) }}
          </div>
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
          <div
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight"
          >
            {{ fmtInt(stats.lowest) }}
          </div>
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
          <div
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight"
          >
            {{ stats.total.toLocaleString() }}
          </div>
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
          <div
            class="text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight"
            :class="stats.winPct >= 50 ? 'text-green-500' : 'text-red-500'"
          >
            {{ stats.total > 0 ? stats.winPct.toFixed(1) + "%" : "—" }}
          </div>
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
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
          </div>
        </div>
      </div>

      <div class="px-4 sm:px-6 pt-5">
        <div
          v-if="loading && history.length === 0"
          class="h-[360px] flex items-center justify-center text-muted-foreground font-mono text-xs uppercase tracking-[0.18em]"
        >
          {{ $t("pages.players.detail.elo_history_dialog.loading_history") }}
        </div>
        <div
          v-else-if="filteredHistory.length === 0"
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
          <PlayerEloChart :series="chartSeries" />
        </div>
      </div>

      <div
        v-if="stats.bestGain || stats.worstLoss"
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
    </DialogContent>
  </Dialog>
</template>
