<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import {
  teamCareerLineupsQuery,
  teamCareerHltvQuery,
} from "~/graphql/teamCareerStatsGraphql";
import { useTableSort } from "~/composables/useTableSort";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
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
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import { hltvColor, kdColor } from "~/utils/statTiers";

const props = defineProps<{
  teamId: string;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

interface PlayerAgg {
  steamId: string;
  player: any;
  maps: number;
  rounds: number;
  rating: number;
  adr: number;
  kpr: number;
  dpr: number;
  kast: number;
}

const loading = ref(true);
const players = ref<PlayerAgg[]>([]);
const matchesPlayed = ref(0);
const mapsPlayed = ref(0);
const mapsWon = ref(0);
const teamRating = ref<number | null>(null);

let loadGen = 0;

async function load() {
  if (!props.teamId) {
    players.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const gen = ++loadGen;
  try {
    const { data: lineupData } = await apolloClient.query({
      query: teamCareerLineupsQuery,
      variables: { teamId: props.teamId },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    const lineups = ((lineupData as any)?.match_lineups ?? []) as any[];

    // (match_id, steam_id) pairs that represented the team, the team's lineup
    // id per match (for win attribution), and the overall map record.
    const teamPairs = new Set<string>();
    const lineupIdByMatch = new Map<string, string>();
    const matchIds = new Set<string>();
    let played = 0;
    let won = 0;
    for (const lu of lineups) {
      const matchId = String(lu.match_id ?? lu.match?.id ?? "");
      if (!matchId) {
        continue;
      }
      matchIds.add(matchId);
      lineupIdByMatch.set(matchId, String(lu.id));
      for (const member of lu.lineup_players ?? []) {
        const sid = String(member.steam_id ?? "");
        if (sid) {
          teamPairs.add(`${matchId}:${sid}`);
        }
      }
      for (const mm of lu.match?.match_maps ?? []) {
        if (!mm.winning_lineup_id) {
          continue;
        }
        played += 1;
        if (String(mm.winning_lineup_id) === String(lu.id)) {
          won += 1;
        }
      }
    }

    matchesPlayed.value = matchIds.size;
    mapsPlayed.value = played;
    mapsWon.value = won;

    if (!matchIds.size) {
      players.value = [];
      teamRating.value = null;
      return;
    }

    const { data: hltvData } = await apolloClient.query({
      query: teamCareerHltvQuery,
      variables: { matchIds: [...matchIds] },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    const rows = ((hltvData as any)?.v_player_match_map_hltv ?? []) as any[];

    const byPlayer = new Map<
      string,
      {
        player: any;
        maps: number;
        rounds: number;
        wRating: number;
        wAdr: number;
        wKpr: number;
        wDpr: number;
        wKast: number;
      }
    >();
    let teamRounds = 0;
    let teamWRating = 0;

    for (const row of rows) {
      const sid = String(row.steam_id ?? "");
      const matchId = String(row.match_id ?? "");
      if (!sid || !teamPairs.has(`${matchId}:${sid}`)) {
        continue;
      }
      const rounds = Number(row.rounds_played ?? 0);
      if (rounds <= 0) {
        continue;
      }
      let agg = byPlayer.get(sid);
      if (!agg) {
        agg = {
          player: row.player,
          maps: 0,
          rounds: 0,
          wRating: 0,
          wAdr: 0,
          wKpr: 0,
          wDpr: 0,
          wKast: 0,
        };
        byPlayer.set(sid, agg);
      }
      agg.maps += 1;
      agg.rounds += rounds;
      agg.wRating += Number(row.hltv_rating ?? 0) * rounds;
      agg.wAdr += Number(row.adr ?? 0) * rounds;
      agg.wKpr += Number(row.kpr ?? 0) * rounds;
      agg.wDpr += Number(row.dpr ?? 0) * rounds;
      agg.wKast += Number(row.kast_pct ?? 0) * rounds;
      teamRounds += rounds;
      teamWRating += Number(row.hltv_rating ?? 0) * rounds;
    }

    players.value = [...byPlayer.entries()].map(([steamId, agg]) => ({
      steamId,
      player: agg.player,
      maps: agg.maps,
      rounds: agg.rounds,
      rating: agg.rounds ? agg.wRating / agg.rounds : 0,
      adr: agg.rounds ? agg.wAdr / agg.rounds : 0,
      kpr: agg.rounds ? agg.wKpr / agg.rounds : 0,
      dpr: agg.rounds ? agg.wDpr / agg.rounds : 0,
      kast: agg.rounds ? agg.wKast / agg.rounds : 0,
    }));
    teamRating.value = teamRounds ? teamWRating / teamRounds : null;
  } catch {
    if (gen === loadGen) {
      players.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => props.teamId, load, { immediate: true });

const { sortKey, sortDir, toggle, sortRows } = useTableSort<
  | "player"
  | "maps"
  | "rounds"
  | "rating"
  | "kpr"
  | "dpr"
  | "kd"
  | "adr"
  | "kast"
>("rating", "desc");

const sortedPlayers = computed(() =>
  sortRows(players.value, {
    player: (p) => p.player?.name ?? "",
    maps: (p) => p.maps,
    rounds: (p) => p.rounds,
    rating: (p) => p.rating,
    kpr: (p) => p.kpr,
    dpr: (p) => p.dpr,
    kd: (p) => (p.dpr > 0 ? p.kpr / p.dpr : p.kpr),
    adr: (p) => p.adr,
    kast: (p) => p.kast,
  }),
);

const mapWinPct = computed(() =>
  mapsPlayed.value ? Math.round((mapsWon.value / mapsPlayed.value) * 100) : 0,
);

function kd(p: PlayerAgg): number {
  return p.dpr > 0 ? p.kpr / p.dpr : p.kpr;
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <span :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("team.career.title") }}
        </span>
        <span :class="tacticalSectionDescriptionClasses">
          {{ $t("team.career.description") }}
        </span>
      </div>

      <Transition
        mode="out-in"
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div v-if="loading" key="loading" class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Skeleton
              v-for="i in 4"
              :key="i"
              class="h-[4.25rem] w-full rounded-md"
            />
          </div>
          <Skeleton class="h-10 w-full rounded-md" />
          <Skeleton
            v-for="i in 5"
            :key="`row-${i}`"
            class="h-9 w-full rounded-md"
          />
        </div>

        <Empty v-else-if="!players.length" key="empty">
          <EmptyTitle>{{ $t("team.career.empty_title") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("team.career.empty_description") }}
          </EmptyDescription>
        </Empty>

        <div v-else key="content" class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div
              v-for="kpi of [
                { label: $t('team.career.matches'), value: matchesPlayed },
                { label: $t('team.career.maps_played'), value: mapsPlayed },
                {
                  label: $t('team.career.map_win_pct'),
                  value: mapWinPct + '%',
                },
                {
                  label: $t('team.career.team_rating'),
                  value: teamRating != null ? teamRating.toFixed(2) : '—',
                },
              ]"
              :key="kpi.label"
              class="rounded-md border border-border/60 bg-card/30 px-3 py-2.5"
            >
              <div
                class="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ kpi.label }}
              </div>
              <div class="mt-1 text-xl font-bold tabular-nums">
                {{ kpi.value }}
              </div>
            </div>
          </div>

          <div class="overflow-x-auto">
            <Table class="min-w-full [&_td]:px-2 [&_th]:px-2">
              <TableHeader class="[&_th]:h-10 bg-muted/20">
                <TableRow>
                  <SortableTableHead
                    sort-key="player"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-left"
                    @sort="toggle"
                  >
                    {{ $t("team.career.player") }}
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="maps"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    {{ $t("team.career.maps") }}
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="rounds"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    {{ $t("team.career.rounds") }}
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="rating"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel stat="hltv" :label="$t('team.career.rating')" />
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="kpr"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel stat="kpr" :label="$t('team.career.kpr')" />
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="dpr"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel stat="dpr" :label="$t('team.career.dpr')" />
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="kd"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel stat="kd" :label="$t('team.career.kd')" />
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="adr"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel stat="adr" :label="$t('team.career.adr')" />
                  </SortableTableHead>
                  <SortableTableHead
                    sort-key="kast"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                  >
                    <StatLabel stat="kast" :label="$t('team.career.kast')" />
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="p of sortedPlayers" :key="p.steamId">
                  <TableCell class="text-left">
                    <PlayerDisplay
                      v-if="p.player"
                      :player="p.player"
                      size="xs"
                      :show-flag="false"
                      :show-role="false"
                      :linkable="true"
                    />
                  </TableCell>
                  <TableCell
                    class="text-right tabular-nums text-muted-foreground"
                  >
                    {{ p.maps }}
                  </TableCell>
                  <TableCell
                    class="text-right tabular-nums text-muted-foreground"
                  >
                    {{ p.rounds }}
                  </TableCell>
                  <TableCell class="text-right font-bold tabular-nums">
                    <span :style="{ color: hltvColor(p.rating) }">
                      {{ p.rating.toFixed(2) }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ p.kpr.toFixed(2) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ p.dpr.toFixed(2) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    <span :style="{ color: kdColor(kd(p)) }">{{
                      kd(p).toFixed(2)
                    }}</span>
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ p.adr.toFixed(1) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ Math.round(p.kast) }}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
