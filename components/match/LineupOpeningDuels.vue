<script lang="ts" setup>
import { computed } from "vue";
import LineupOpeningDuelRow from "~/components/match/LineupOpeningDuelRow.vue";
import SortableTableHead from "~/components/ui/SortableTableHead.vue";
import { useTableSort } from "~/composables/useTableSort";
import { useMatchSide } from "~/composables/useMatchSide";
import { useOpeningDuelsColumns } from "~/composables/useMatchTableColumns";

const { visibility: duelsVis } = useOpeningDuelsColumns();

const props = defineProps<{
  match: any;
  lineup: any;
  selectedMapId?: string | null;
}>();

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>();
const side = useMatchSide();

const filteredMatchMaps = computed(() => {
  if (!props.selectedMapId) return props.match.match_maps;
  return props.match.match_maps.filter(
    (m: any) => m.id === props.selectedMapId,
  );
});

const isLineup1 = computed(() => props.lineup.id === props.match.lineup_1_id);

// match_map_rounds.lineup_X_side comes from e_sides_enum which stores
// "CT" and "TERRORIST" (NOT "T"). The filter chip uses "T"/"CT" for
// UI clarity, so normalize here.
function sideMatches(roundSide: string | null | undefined): boolean {
  if (side.value === "all") return true;
  if (side.value === "CT") return roundSide === "CT";
  if (side.value === "T") return roundSide === "TERRORIST" || roundSide === "T";
  return true;
}

function roundOnSide(round: any): boolean {
  if (side.value === "all") return true;
  const playerSide = isLineup1.value
    ? round.lineup_1_side
    : round.lineup_2_side;
  return sideMatches(playerSide);
}

function duelStatsFor(member: any) {
  let attempts = 0;
  let success = 0;
  let deaths = 0;
  let tradedDeaths = 0;
  const steamId = String(member.steam_id);
  for (const match_map of filteredMatchMaps.value) {
    for (const round of match_map.rounds) {
      if (!roundOnSide(round)) continue;
      const firstKill = round.kills.find(
        (k: any) =>
          k.player && k.player.steam_id !== k.attacked_player.steam_id,
      );
      if (!firstKill) continue;
      const isKiller = String(firstKill.player?.steam_id) === steamId;
      const isVictim = String(firstKill.attacked_player?.steam_id) === steamId;
      if (!isKiller && !isVictim) continue;
      attempts++;
      if (isKiller) success++;
      if (isVictim) {
        deaths++;
        const traderKill = round.kills.find(
          (k: any) =>
            k.player &&
            String(k.attacked_player?.steam_id) ===
              String(firstKill.player?.steam_id) &&
            String(k.player?.steam_id) !==
              String(firstKill.attacked_player?.steam_id),
        );
        if (traderKill) tradedDeaths++;
      }
    }
  }
  return { attempts, success, deaths, tradedDeaths };
}

const sortGetters: Record<string, (m: any) => unknown> = {
  attempts: (m) => duelStatsFor(m).attempts,
  success: (m) => {
    const s = duelStatsFor(m);
    return s.attempts === 0 ? -1 : s.success / s.attempts;
  },
  traded: (m) => {
    const s = duelStatsFor(m);
    return s.deaths === 0 ? -1 : s.tradedDeaths / s.deaths;
  },
};
</script>
<template>
  <Table class="table-fixed">
    <TableHeader>
      <TableRow>
        <TableHead
          class="w-[220px] text-left whitespace-nowrap sticky left-0 z-20 bg-card border-r border-border shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]"
        >
          {{ lineup.name }}
        </TableHead>
        <SortableTableHead
          sort-key="attempts"
          :active-key="sortKey"
          :direction="sortDir"
          class="w-[130px] whitespace-nowrap"
          @sort="toggle"
          >{{ $t("match.opening_duels.attempts") }}</SortableTableHead
        >
        <SortableTableHead
          sort-key="success"
          :active-key="sortKey"
          :direction="sortDir"
          class="w-[130px] whitespace-nowrap"
          @sort="toggle"
          >{{ $t("match.opening_duels.success") }}</SortableTableHead
        >
        <SortableTableHead
          v-if="duelsVis.traded !== false"
          sort-key="traded"
          :active-key="sortKey"
          :direction="sortDir"
          class="w-[130px] whitespace-nowrap"
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
        :lineup="lineup"
        :match="match"
        :selected-map-id="selectedMapId"
        v-for="member of sortRows(lineup.lineup_players, sortGetters)"
      ></lineup-opening-duel-row>
    </TableBody>
  </Table>
</template>
