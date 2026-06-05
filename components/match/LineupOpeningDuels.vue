<script lang="ts" setup>
import { computed, ref, watch, onUnmounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import LineupOpeningDuelRow from "~/components/match/LineupOpeningDuelRow.vue";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import { useTableSort } from "~/composables/useTableSort";
import { useMatchSide } from "~/composables/useMatchSide";
import { useOpeningDuelsColumns } from "~/composables/useMatchTableColumns";

const { visibility: duelsVis } = useOpeningDuelsColumns();

const props = defineProps<{
  match: any;
  lineup: any;
  combineWith?: any;
  selectedMapId?: string | null;
}>();

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>();
const side = useMatchSide();

const lineupsToRender = computed(() =>
  props.combineWith ? [props.lineup, props.combineWith] : [props.lineup],
);

// Opening-duel aggregates from the backend: per-player records +
// v_match_lineup_map_stats for the lineup's total side rounds (attempt%
// denominator). No round scanning on the client.
const { client: apolloClient } = useApolloClient();
const duelRows = ref<any[]>([]);
const lineupRoundRows = ref<any[]>([]);
const killPairRows = ref<any[]>([]);
const OPENING_SUB = gql`
  subscription MatchOpeningDuels($matchId: uuid!) {
    v_match_player_opening_duels(where: { match_id: { _eq: $matchId } }) {
      match_map_id
      match_lineup_id
      steam_id
      side
      attempts
      wins
      deaths
      traded_deaths
    }
  }
`;
const LINEUP_ROUNDS_SUB = gql`
  subscription MatchLineupRounds($matchId: uuid!) {
    v_match_lineup_map_stats(where: { match_id: { _eq: $matchId } }) {
      match_map_id
      match_lineup_id
      side
      rounds
    }
  }
`;
const KILL_PAIRS_SUB = gql`
  subscription MatchKillPairs($matchId: uuid!) {
    v_match_kill_pairs(where: { match_id: { _eq: $matchId } }) {
      match_map_id
      killer_steam_id
      victim_steam_id
      weapon
      killer_side
      victim_side
      kills
    }
  }
`;
let duelSub: { unsubscribe: () => void } | null = null;
let roundsSub: { unsubscribe: () => void } | null = null;
let killPairsSub: { unsubscribe: () => void } | null = null;
watch(
  () => props.match?.id,
  (id) => {
    duelSub?.unsubscribe();
    roundsSub?.unsubscribe();
    killPairsSub?.unsubscribe();
    duelSub = null;
    roundsSub = null;
    killPairsSub = null;
    duelRows.value = [];
    lineupRoundRows.value = [];
    killPairRows.value = [];
    if (!id) {
      return;
    }
    duelSub = apolloClient
      .subscribe({ query: OPENING_SUB, variables: { matchId: id } })
      .subscribe({
        next: ({ data }: any) => {
          duelRows.value = data?.v_match_player_opening_duels ?? [];
        },
        error: () => {
          duelRows.value = [];
        },
      });
    roundsSub = apolloClient
      .subscribe({ query: LINEUP_ROUNDS_SUB, variables: { matchId: id } })
      .subscribe({
        next: ({ data }: any) => {
          lineupRoundRows.value = data?.v_match_lineup_map_stats ?? [];
        },
        error: () => {
          lineupRoundRows.value = [];
        },
      });
    killPairsSub = apolloClient
      .subscribe({ query: KILL_PAIRS_SUB, variables: { matchId: id } })
      .subscribe({
        next: ({ data }: any) => {
          killPairRows.value = data?.v_match_kill_pairs ?? [];
        },
        error: () => {
          killPairRows.value = [];
        },
      });
  },
  { immediate: true },
);
onUnmounted(() => {
  duelSub?.unsubscribe();
  roundsSub?.unsubscribe();
  killPairsSub?.unsubscribe();
});

// Kill-matchup breakdown for a player (map + side filter applied), where side
// is taken from the end the player sits on (killer_side for their kills,
// victim_side for their deaths). Mirrors the old client killBreakdown shape.
function killBreakdownFor(steamId: string | number) {
  const sid = String(steamId);
  const token = sideToken();
  const victims: Record<string, number> = {};
  const killers: Record<string, number> = {};
  const weapons: Record<string, number> = {};
  for (const r of killPairRows.value) {
    if (props.selectedMapId && r.match_map_id !== props.selectedMapId) {
      continue;
    }
    if (String(r.killer_steam_id) === sid && (!token || r.killer_side === token)) {
      const v = String(r.victim_steam_id);
      victims[v] = (victims[v] ?? 0) + (r.kills ?? 0);
      if (r.weapon) weapons[r.weapon] = (weapons[r.weapon] ?? 0) + (r.kills ?? 0);
    }
    if (String(r.victim_steam_id) === sid && (!token || r.victim_side === token)) {
      const k = String(r.killer_steam_id);
      killers[k] = (killers[k] ?? 0) + (r.kills ?? 0);
    }
  }
  return { victims, killers, weapons };
}

function sideToken(): "t" | "ct" | null {
  if (side.value === "CT") return "ct";
  if (side.value === "T") return "t";
  return null;
}
function rowPasses(r: any): boolean {
  if (props.selectedMapId && r.match_map_id !== props.selectedMapId) {
    return false;
  }
  const token = sideToken();
  return !token || r.side === token;
}

// Per-player opening record (map + side filter applied).
function openingFor(lineupId: string, steamId: string | number) {
  const sid = String(steamId);
  let attempts = 0;
  let wins = 0;
  let deaths = 0;
  let tradedDeaths = 0;
  for (const r of duelRows.value) {
    if (
      String(r.match_lineup_id) !== String(lineupId) ||
      String(r.steam_id) !== sid ||
      !rowPasses(r)
    ) {
      continue;
    }
    attempts += r.attempts ?? 0;
    wins += r.wins ?? 0;
    deaths += r.deaths ?? 0;
    tradedDeaths += r.traded_deaths ?? 0;
  }
  return { attempts, success: wins, deaths, tradedDeaths };
}

// Lineup's total rounds (map + side filter applied) — attempt% denominator.
function lineupRoundsFor(lineupId: string): number {
  let rounds = 0;
  for (const r of lineupRoundRows.value) {
    if (String(r.match_lineup_id) !== String(lineupId) || !rowPasses(r)) {
      continue;
    }
    rounds += r.rounds ?? 0;
  }
  return rounds;
}

function sortGettersFor(lp: any): Record<string, (m: any) => unknown> {
  return {
    attempts: (m) => openingFor(lp.id, m.steam_id).attempts,
    success: (m) => {
      const s = openingFor(lp.id, m.steam_id);
      return s.attempts === 0 ? -1 : s.success / s.attempts;
    },
    traded: (m) => {
      const s = openingFor(lp.id, m.steam_id);
      return s.deaths === 0 ? -1 : s.tradedDeaths / s.deaths;
    },
  };
}
</script>
<template>
  <Table
    class="min-w-full w-max [&_td]:whitespace-nowrap [&_th]:px-2 [&_td]:px-2 [&_th.sticky+th]:!pl-5 [&_td.sticky+td]:!pl-5"
  >
    <template v-for="(lp, lpIdx) of lineupsToRender" :key="lp.id">
      <TableHeader
        :class="[
          '[&_th]:h-12 bg-muted/20',
          lpIdx > 0 ? '[&_th]:pt-7 border-t-[3px] border-border/80' : '',
        ]"
      >
        <TableRow>
          <TableHead
            class="w-[110px] md:w-[220px] text-left whitespace-nowrap sticky left-0 z-20 bg-card border-r border-border shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)] [transform:translateZ(0)]"
          >
            {{ lp.name }}
          </TableHead>
          <SortableTableHead
            sort-key="attempts"
            :active-key="sortKey"
            :direction="sortDir"
            class="whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.opening_duels.attempts") }}</SortableTableHead
          >
          <SortableTableHead
            sort-key="success"
            :active-key="sortKey"
            :direction="sortDir"
            class="whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.opening_duels.success") }}</SortableTableHead
          >
          <SortableTableHead
            v-if="duelsVis.traded !== false"
            sort-key="traded"
            :active-key="sortKey"
            :direction="sortDir"
            class="whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.opening_duels.traded") }}</SortableTableHead
          >
          <TableHead
            v-if="duelsVis.most_killed !== false"
            class="whitespace-nowrap hidden md:table-cell"
            >{{ $t("match.opening_duels.most_killed") }}</TableHead
          >
          <TableHead
            v-if="duelsVis.best_weapon !== false"
            class="whitespace-nowrap hidden md:table-cell"
            >{{ $t("match.opening_duels.best_weapon") }}</TableHead
          >
          <TableHead
            v-if="duelsVis.most_died_to !== false"
            class="whitespace-nowrap hidden md:table-cell"
            >{{ $t("match.opening_duels.most_died_to") }}</TableHead
          >
        </TableRow>
      </TableHeader>
      <TableBody>
        <lineup-opening-duel-row
          :member="member"
          :lineup="lp"
          :match="match"
          :selected-map-id="selectedMapId"
          :opening="openingFor(lp.id, member.steam_id)"
          :lineup-rounds="lineupRoundsFor(lp.id)"
          :kill-breakdown="killBreakdownFor(member.steam_id)"
          v-for="member of sortRows(lp.lineup_players, sortGettersFor(lp))"
        ></lineup-opening-duel-row>
      </TableBody>
    </template>
  </Table>
</template>
