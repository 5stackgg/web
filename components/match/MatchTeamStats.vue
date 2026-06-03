<script lang="ts" setup>
import { computed, ref, watch, onUnmounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { useMatchSide } from "~/composables/useMatchSide";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Empty,
  EmptyTitle,
  EmptyDescription,
} from "~/components/ui/empty";

const BUY_PISTOL = "pistol";
const BUY_ECO = "eco";
const BUY_FORCE = "force";
const BUY_FULL = "full";
const BUY_BUCKETS = [BUY_PISTOL, BUY_ECO, BUY_FORCE, BUY_FULL] as const;
type BuyBucket = (typeof BUY_BUCKETS)[number];

const SIDES = ["CT", "TERRORIST"] as const;
type Side = (typeof SIDES)[number];

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

const filteredMatchMaps = computed(() => {
  if (!props.selectedMapId) {
    return props.match.match_maps;
  }
  return props.match.match_maps.filter(
    (m: any) => m.id === props.selectedMapId,
  );
});

// Round-derived team KPIs (round/pistol/opening win, man advantage) come from
// the backend view v_match_lineup_map_stats — one row per (map, lineup, side) —
// instead of walking round events on the client. Trade/UDR/flash still sum the
// per-player columns, and the buy-mix still reads round money (see #2).
const { client: apolloClient } = useApolloClient();
const viewRows = ref<any[]>([]);
const LINEUP_MAP_STATS_SUB = gql`
  subscription MatchLineupMapStats($matchId: uuid!) {
    v_match_lineup_map_stats(where: { match_id: { _eq: $matchId } }) {
      match_map_id
      match_lineup_id
      side
      rounds
      round_wins
      pistol_rounds
      pistol_wins
      opening_attempts
      opening_wins
      man_adv_rounds
      man_adv_wins
      man_dis_rounds
      man_dis_wins
      won_buy_pistol
      won_buy_eco
      won_buy_force
      won_buy_full
    }
  }
`;
let lineupStatsSub: { unsubscribe: () => void } | null = null;
watch(
  () => props.match?.id,
  (id) => {
    lineupStatsSub?.unsubscribe();
    lineupStatsSub = null;
    viewRows.value = [];
    if (!id) {
      return;
    }
    lineupStatsSub = apolloClient
      .subscribe({ query: LINEUP_MAP_STATS_SUB, variables: { matchId: id } })
      .subscribe({
        next: ({ data }: any) => {
          viewRows.value = data?.v_match_lineup_map_stats ?? [];
        },
        error: () => {
          viewRows.value = [];
        },
      });
  },
  { immediate: true },
);
onUnmounted(() => lineupStatsSub?.unsubscribe());

// 'all' -> both sides, else the view's normalized token.
function sideFilterToken(): "t" | "ct" | null {
  if (side.value === "CT") {
    return "ct";
  }
  if (side.value === "T") {
    return "t";
  }
  return null;
}

const VIEW_KEYS = [
  "rounds",
  "round_wins",
  "pistol_rounds",
  "pistol_wins",
  "opening_attempts",
  "opening_wins",
  "man_adv_rounds",
  "man_adv_wins",
  "man_dis_rounds",
  "man_dis_wins",
  "won_buy_pistol",
  "won_buy_eco",
  "won_buy_force",
  "won_buy_full",
] as const;
type ViewAgg = Record<(typeof VIEW_KEYS)[number], number>;

function emptyViewAgg(): ViewAgg {
  return Object.fromEntries(VIEW_KEYS.map((k) => [k, 0])) as ViewAgg;
}

// Sum view rows for a lineup, honoring the map filter + an optional explicit
// side ('t'/'ct'); when no side is passed the global side filter applies.
function viewAgg(lineupId: string, explicitSide?: "t" | "ct"): ViewAgg {
  const token = explicitSide ?? sideFilterToken();
  const acc = emptyViewAgg();
  for (const r of viewRows.value) {
    if (String(r.match_lineup_id) !== String(lineupId)) {
      continue;
    }
    if (props.selectedMapId && r.match_map_id !== props.selectedMapId) {
      continue;
    }
    if (token && r.side !== token) {
      continue;
    }
    for (const k of VIEW_KEYS) {
      acc[k] += r[k] ?? 0;
    }
  }
  return acc;
}

function roundWin(lp: any) {
  const a = viewAgg(lp.id);
  return { rounds: a.rounds, won: a.round_wins };
}

function pistolWin(lp: any) {
  const a = viewAgg(lp.id);
  return { rounds: a.pistol_rounds, won: a.pistol_wins };
}

function openingWin(lp: any) {
  const a = viewAgg(lp.id);
  return { attempts: a.opening_attempts, won: a.opening_wins };
}

function manAdvantage(lp: any) {
  const a = viewAgg(lp.id);
  return {
    fiveV: { rounds: a.man_adv_rounds, won: a.man_adv_wins },
    fourV: { rounds: a.man_dis_rounds, won: a.man_dis_wins },
  };
}

function statFor(member: any) {
  const player = member?.player;
  if (!player) {
    return null;
  }
  if (props.selectedMapId) {
    const arr = player.match_map_stats;
    if (Array.isArray(arr)) {
      const row = arr.find(
        (s: any) => s.match_map_id === props.selectedMapId,
      );
      return row ?? null;
    }
    return null;
  }
  const arr = player.match_stats;
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

function roundsForMember(stat: any): number {
  if (!stat) {
    return 0;
  }
  if (side.value === "CT") {
    return stat.rounds_ct ?? 0;
  }
  if (side.value === "T") {
    return stat.rounds_t ?? 0;
  }
  return stat.rounds_played ?? 0;
}

function tradeOpportunities(lp: any): number {
  let opps = 0;
  for (const member of lp.lineup_players || []) {
    const s = statFor(member);
    if (!s) {
      continue;
    }
    opps += s.trade_kill_opportunities ?? 0;
  }
  return opps;
}

function tradeSuccesses(lp: any): number {
  let n = 0;
  for (const member of lp.lineup_players || []) {
    const s = statFor(member);
    if (!s) {
      continue;
    }
    n += s.trade_kill_successes ?? 0;
  }
  return n;
}

function teamUdr(lp: any): number {
  let dmg = 0;
  let rounds = 0;
  for (const member of lp.lineup_players || []) {
    const s = statFor(member);
    if (!s) {
      continue;
    }
    dmg += (s.he_damage ?? 0) + (s.molotov_damage ?? 0);
    rounds = Math.max(rounds, roundsForMember(s));
  }
  if (rounds === 0) {
    return 0;
  }
  return dmg / rounds;
}

function teamFlashPerRound(lp: any): number {
  let fa = 0;
  let rounds = 0;
  for (const member of lp.lineup_players || []) {
    const s = statFor(member);
    if (!s) {
      continue;
    }
    fa += s.flash_assists ?? 0;
    rounds = Math.max(rounds, roundsForMember(s));
  }
  if (rounds === 0) {
    return 0;
  }
  return fa / rounds;
}

function pct(n: number, d: number): number {
  if (d === 0) {
    return 0;
  }
  return Math.round((n / d) * 100);
}

function fmt2(v: number | null): string {
  if (v === null || Number.isNaN(v)) {
    return "—";
  }
  return v.toFixed(2);
}

function fmt1(v: number | null): string {
  if (v === null || Number.isNaN(v)) {
    return "—";
  }
  return v.toFixed(1);
}

function sideRecord(lp: any, sideKey: Side) {
  const a = viewAgg(lp.id, sideKey === "CT" ? "ct" : "t");
  return { rounds: a.rounds, won: a.round_wins };
}

// Buy mix of the rounds the team WON on this side, from the view's
// won_buy_* columns. counts sum to `won`; `rounds` (total played) is the bar's
// denominator so segment widths of counts[bucket]/rounds fill to the win rate.
function wonBuyComposition(lp: any, sideKey: Side) {
  const a = viewAgg(lp.id, sideKey === "CT" ? "ct" : "t");
  return {
    counts: {
      pistol: a.won_buy_pistol,
      eco: a.won_buy_eco,
      force: a.won_buy_force,
      full: a.won_buy_full,
    } as Record<BuyBucket, number>,
    won: a.round_wins,
    rounds: a.rounds,
  };
}

// Single-hue ramp per team (strong = best buy) so the buy mix reads as one
// scale instead of a 4-color rainbow. Pistol sits apart in muted grey.
// Team A = amber, team B = cyan, preserving team identity within the bar.
const buyRampA: Record<BuyBucket, string> = {
  full: "hsl(var(--tac-amber))",
  force: "hsl(var(--tac-amber) / 0.6)",
  eco: "hsl(var(--tac-amber) / 0.32)",
  pistol: "hsl(var(--muted-foreground) / 0.5)",
};
const buyRampB: Record<BuyBucket, string> = {
  full: "hsl(199 89% 60%)",
  force: "hsl(199 89% 60% / 0.6)",
  eco: "hsl(199 89% 60% / 0.32)",
  pistol: "hsl(var(--muted-foreground) / 0.5)",
};
function buyRampFor(teamId: "a" | "b"): Record<BuyBucket, string> {
  return teamId === "a" ? buyRampA : buyRampB;
}

function hasRoundData(): boolean {
  return filteredMatchMaps.value.some(
    (m: any) => Array.isArray(m.rounds) && m.rounds.length > 0,
  );
}

function kpis(lp: any) {
  const rw = roundWin(lp);
  const pw = pistolWin(lp);
  const ow = openingWin(lp);
  const ma = manAdvantage(lp);
  const tradeOpps = tradeOpportunities(lp);
  const trades = tradeSuccesses(lp);
  return {
    roundWinPct: pct(rw.won, rw.rounds),
    roundWin: rw,
    pistolWinPct: pct(pw.won, pw.rounds),
    pistolWin: pw,
    openingWinPct: pct(ow.won, ow.attempts),
    openingWin: ow,
    tradePct: pct(trades, tradeOpps),
    udr: teamUdr(lp),
    flashPerRound: teamFlashPerRound(lp),
    fiveVPct: pct(ma.fiveV.won, ma.fiveV.rounds),
    fiveV: ma.fiveV,
    fourVPct: pct(ma.fourV.won, ma.fourV.rounds),
    fourV: ma.fourV,
  };
}

const teamA = computed(() => lineupsToRender.value[0] ?? null);
const teamB = computed(() => lineupsToRender.value[1] ?? null);

// Head-to-head overview: one row per KPI with both teams' values and a
// tug-of-war bar (amber = team A, cyan = team B) so they read side by side.
const comparisonRows = computed(() => {
  const a = teamA.value;
  const b = teamB.value;
  if (!a || !b) {
    return [];
  }
  const ka = kpis(a);
  const kb = kpis(b);
  const mk = (
    key: string,
    v1: number | null,
    v2: number | null,
    d1: string,
    d2: string,
  ) => {
    const x = Math.max(0, Number(v1) || 0);
    const y = Math.max(0, Number(v2) || 0);
    const sum = x + y;
    const f1 = sum > 0 ? Math.round((x / sum) * 100) : 50;
    return {
      key,
      d1,
      d2,
      f1,
      f2: 100 - f1,
      higher: v1 === v2 ? 0 : (Number(v1) > Number(v2) ? 1 : 2),
    };
  };
  return [
    mk("round_win", ka.roundWinPct, kb.roundWinPct, ka.roundWinPct + "%", kb.roundWinPct + "%"),
    mk("pistol_win", ka.pistolWinPct, kb.pistolWinPct, ka.pistolWinPct + "%", kb.pistolWinPct + "%"),
    mk("opening_win", ka.openingWinPct, kb.openingWinPct, ka.openingWinPct + "%", kb.openingWinPct + "%"),
    mk("trade", ka.tradePct, kb.tradePct, ka.tradePct + "%", kb.tradePct + "%"),
    mk(
      "man_advantage",
      ka.fiveVPct,
      kb.fiveVPct,
      ka.fiveV.rounds ? ka.fiveVPct + "%" : "—",
      kb.fiveV.rounds ? kb.fiveVPct + "%" : "—",
    ),
    mk(
      "man_disadvantage",
      ka.fourVPct,
      kb.fourVPct,
      ka.fourV.rounds ? ka.fourVPct + "%" : "—",
      kb.fourV.rounds ? kb.fourVPct + "%" : "—",
    ),
    mk("udr", ka.udr, kb.udr, fmt1(ka.udr), fmt1(kb.udr)),
    mk("flash_assists_pr", ka.flashPerRound, kb.flashPerRound, fmt2(ka.flashPerRound), fmt2(kb.flashPerRound)),
  ];
});

// Sides grouped BY side (CT, then T) so each team's record on the same
// side sits on one row — easier to compare than two separate team panels.
const sideComparison = computed(() => {
  const a = teamA.value;
  const b = teamB.value;
  if (!a || !b) {
    return [];
  }
  return SIDES.map((sideKey) => {
    const ra = sideRecord(a, sideKey);
    const rb = sideRecord(b, sideKey);
    const pa = pct(ra.won, ra.rounds);
    const pb = pct(rb.won, rb.rounds);
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
    return {
      side: sideKey,
      a: { won: ra.won, rounds: ra.rounds, pct: pa, comp: wonBuyComposition(a, sideKey) },
      b: { won: rb.won, rounds: rb.rounds, pct: pb, comp: wonBuyComposition(b, sideKey) },
      f1,
      f2: 100 - f1,
      higher,
    };
  });
});
</script>

<template>
  <div class="grid gap-8">
    <template v-if="!hasRoundData()">
      <Empty>
        <EmptyTitle>{{ $t("match.team_stats.no_data.title") }}</EmptyTitle>
        <EmptyDescription>{{
          $t("match.team_stats.no_data.description")
        }}</EmptyDescription>
      </Empty>
    </template>
    <template v-else>
      <Card class="bg-card/20">
        <CardHeader class="pb-3">
          <div class="flex items-center justify-between gap-3">
            <span
              class="text-sm font-bold uppercase tracking-[0.14em] text-[#fbbf24] truncate"
            >
              {{ teamA?.name }}
            </span>
            <span
              class="text-sm font-bold uppercase tracking-[0.14em] text-[#38bdf8] truncate text-right"
            >
              {{ teamB?.name }}
            </span>
          </div>
        </CardHeader>
        <CardContent class="grid gap-3.5">
          <div
            v-for="row of comparisonRows"
            :key="row.key"
            class="grid grid-cols-[3.5rem_1fr_3.5rem] sm:grid-cols-[5rem_1fr_5rem] items-center gap-3"
          >
            <span
              class="text-left text-base sm:text-lg font-bold tabular-nums text-[#fbbf24] transition-opacity"
              :class="row.higher === 2 ? 'opacity-60' : ''"
            >
              <AnimatedStat :value="row.d1" />
            </span>
            <div class="flex flex-col items-center gap-1 min-w-0">
              <span
                class="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground whitespace-nowrap"
              >
                {{ $t(`match.team_stats.kpi.${row.key}`) }}
              </span>
              <div
                class="flex w-full h-2 rounded-sm overflow-hidden bg-muted/30"
              >
                <div
                  class="h-full bg-[#fbbf24] transition-all"
                  :class="row.higher === 2 ? 'opacity-50' : ''"
                  :style="{ width: row.f1 + '%' }"
                />
                <div
                  class="h-full bg-[#38bdf8] transition-all"
                  :class="row.higher === 1 ? 'opacity-50' : ''"
                  :style="{ width: row.f2 + '%' }"
                />
              </div>
            </div>
            <span
              class="text-right text-base sm:text-lg font-bold tabular-nums text-[#38bdf8] transition-opacity"
              :class="row.higher === 1 ? 'opacity-60' : ''"
            >
              <AnimatedStat :value="row.d2" />
            </span>
          </div>
        </CardContent>
      </Card>

      <div class="grid gap-4">
        <div :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("match.team_stats.sides_title") }}
        </div>
        <div
            v-for="row of sideComparison"
            :key="row.side"
            class="rounded-md border border-border/60 bg-muted/10 p-3 grid gap-3"
          >
            <span
              class="text-[0.62rem] font-bold uppercase tracking-[0.2em]"
              :class="
                row.side === 'CT'
                  ? 'text-[#38bdf8]'
                  : 'text-[hsl(var(--tac-amber))]'
              "
            >
              {{
                row.side === "CT"
                  ? $t("match.team_stats.side.ct")
                  : $t("match.team_stats.side.t")
              }}
            </span>

            <div class="grid gap-2.5">
              <div
                v-for="team of [
                  {
                    id: 'a',
                    name: teamA?.name,
                    pct: row.a.pct,
                    won: row.a.won,
                    rounds: row.a.rounds,
                    comp: row.a.comp,
                    text: 'text-[#fbbf24]',
                  },
                  {
                    id: 'b',
                    name: teamB?.name,
                    pct: row.b.pct,
                    won: row.b.won,
                    rounds: row.b.rounds,
                    comp: row.b.comp,
                    text: 'text-[#38bdf8]',
                  },
                ]"
                :key="team.id"
                class="flex items-center gap-3"
              >
                <span
                  class="w-20 sm:w-28 shrink-0 truncate text-xs font-semibold uppercase tracking-[0.1em]"
                  :class="team.text"
                >
                  {{ team.name }}
                </span>
                <!-- One bar: fills to win rate, internally split by the buy mix
                     of the rounds the team won (counts/rounds sum to win%). -->
                <div
                  class="relative flex h-2.5 flex-1 overflow-hidden rounded-sm bg-muted/30"
                >
                  <template v-for="bucket of BUY_BUCKETS" :key="bucket">
                    <div
                      v-if="team.comp.counts[bucket] > 0"
                      class="h-full transition-all"
                      :style="{
                        width: pct(team.comp.counts[bucket], team.comp.rounds) + '%',
                        backgroundColor: buyRampFor(team.id)[bucket],
                      }"
                      :title="`${$t('match.team_stats.buy.' + bucket)} ${team.comp.counts[bucket]}/${team.won} ${$t('match.team_stats.rounds_won')}`"
                    />
                  </template>
                </div>
                <span
                  class="flex w-20 items-baseline justify-end gap-1.5 tabular-nums whitespace-nowrap"
                >
                  <span class="text-sm font-bold" :class="team.text">
                    <AnimatedStat :value="team.rounds ? team.pct + '%' : '—'" />
                  </span>
                  <span class="text-[0.6rem] text-muted-foreground">
                    {{ team.won }}/{{ team.rounds }}
                  </span>
                </span>
              </div>

              <!-- Shared buy-mix key: opacity ramp (strong = full buy) applies
                   to both teams' bars; only the hue differs by team. -->
              <div
                class="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[5.75rem] text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground/60 sm:pl-[7.75rem]"
              >
                <span>{{ $t("match.team_stats.buy_mix") }}</span>
                <span
                  v-for="bucket of BUY_BUCKETS"
                  :key="bucket"
                  class="inline-flex items-center gap-1"
                >
                  <span
                    class="inline-block h-2 w-2 rounded-[1px]"
                    :style="{ backgroundColor: buyRampA[bucket] }"
                  />
                  {{ $t(`match.team_stats.buy.${bucket}`) }}
                </span>
              </div>
            </div>
          </div>
        </div>
    </template>
  </div>
</template>
