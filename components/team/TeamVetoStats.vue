<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { teamVetoStatsQuery } from "~/graphql/teamVetoStatsGraphql";
import { useTableSort } from "~/composables/useTableSort";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
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
import { type StatTierConfig } from "~/utils/statTiers";
import cleanMapName from "~/utilities/cleanMapName";

const props = defineProps<{
  teamId: string;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

interface RawVetoPick {
  id: string;
  type: string;
  side: string | null;
  map_id: string | null;
  match_id: string | null;
  created_at: string | null;
  match_lineup_id: string | null;
  map: { id: string; name: string; label: string | null } | null;
  match_lineup: { id: string; team_id: string | null } | null;
  match: {
    id: string;
    match_maps: Array<{
      id: string;
      map_id: string | null;
      winning_lineup_id: string | null;
    }>;
  } | null;
}

interface MapVetoAggregate {
  mapId: string;
  name: string;
  label: string | null;
  banned: number;
  picked: number;
  decider: number;
  firstBan: number;
  firstPick: number;
  played: number;
  wins: number;
}

const COMFORT_MIN_PLAYED = 3;

const loading = ref(true);
const picks = ref<RawVetoPick[]>([]);

let loadGen = 0;

async function load() {
  if (!props.teamId) {
    picks.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const gen = ++loadGen;
  try {
    const { data } = await apolloClient.query({
      query: teamVetoStatsQuery,
      variables: {
        teamId: props.teamId,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    picks.value = ((data as any)?.match_map_veto_picks ?? []) as RawVetoPick[];
  } catch {
    if (gen === loadGen) {
      picks.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => props.teamId, load, { immediate: true });

const totalRecords = computed(() => picks.value.length);

const aggregates = computed<MapVetoAggregate[]>(() => {
  const byMap = new Map<string, MapVetoAggregate>();

  const firstByMatch = new Map<string, { ban: boolean; pick: boolean }>();
  const playedByMap = new Map<string, { played: Set<string>; wins: Set<string> }>();

  function ensure(mapId: string, name: string, label: string | null) {
    let agg = byMap.get(mapId);
    if (!agg) {
      agg = {
        mapId,
        name,
        label,
        banned: 0,
        picked: 0,
        decider: 0,
        firstBan: 0,
        firstPick: 0,
        played: 0,
        wins: 0,
      };
      byMap.set(mapId, agg);
    }
    return agg;
  }

  for (const pick of picks.value) {
    const map = pick.map;
    if (!map) {
      continue;
    }
    const agg = ensure(map.id, map.name, map.label);
    if (pick.type === "Ban") {
      agg.banned += 1;
      const matchId = pick.match_id ?? "";
      const flag = firstByMatch.get(matchId) ?? { ban: false, pick: false };
      if (!flag.ban) {
        agg.firstBan += 1;
        flag.ban = true;
      }
      firstByMatch.set(matchId, flag);
    } else if (pick.type === "Pick") {
      agg.picked += 1;
      const matchId = pick.match_id ?? "";
      const flag = firstByMatch.get(matchId) ?? { ban: false, pick: false };
      if (!flag.pick) {
        agg.firstPick += 1;
        flag.pick = true;
      }
      firstByMatch.set(matchId, flag);
    } else if (pick.type === "Decider") {
      agg.decider += 1;
    }

    const mm = pick.match?.match_maps?.find(
      (m) => m.map_id === map.id,
    );
    if (mm) {
      let store = playedByMap.get(map.id);
      if (!store) {
        store = { played: new Set(), wins: new Set() };
        playedByMap.set(map.id, store);
      }
      if (!store.played.has(mm.id)) {
        store.played.add(mm.id);
        agg.played += 1;
        if (
          mm.winning_lineup_id &&
          pick.match_lineup_id &&
          mm.winning_lineup_id === pick.match_lineup_id
        ) {
          store.wins.add(mm.id);
          agg.wins += 1;
        }
      }
    }
  }

  return [...byMap.values()];
});

const hasData = computed(() => aggregates.value.length > 0);

function totalOf(key: "banned" | "picked" | "firstBan" | "firstPick" | "decider"): number {
  return aggregates.value.reduce((sum, a) => sum + a[key], 0);
}

const totals = computed(() => ({
  banned: totalOf("banned"),
  picked: totalOf("picked"),
  firstBan: totalOf("firstBan"),
  firstPick: totalOf("firstPick"),
  decider: totalOf("decider"),
}));

function winPct(agg: MapVetoAggregate): number | null {
  if (agg.played <= 0) {
    return null;
  }
  return (agg.wins / agg.played) * 100;
}

function pctOf(value: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return (value / total) * 100;
}

const winTier: StatTierConfig = { dir: "high", cuts: [60, 53, 47, 40] };

function fmtPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return Math.round(value) + "%";
}

const mostBanned = computed(() => {
  let best: MapVetoAggregate | null = null;
  for (const a of aggregates.value) {
    if (!best || a.banned > best.banned) {
      best = a;
    }
  }
  return best && best.banned > 0 ? best : null;
});

const mostPicked = computed(() => {
  let best: MapVetoAggregate | null = null;
  for (const a of aggregates.value) {
    if (!best || a.picked > best.picked) {
      best = a;
    }
  }
  return best && best.picked > 0 ? best : null;
});

const comfortMap = computed(() => {
  let best: MapVetoAggregate | null = null;
  let bestPct = -1;
  for (const a of aggregates.value) {
    if (a.played < COMFORT_MIN_PLAYED) {
      continue;
    }
    const pct = winPct(a) ?? -1;
    if (pct > bestPct) {
      bestPct = pct;
      best = a;
    }
  }
  return best;
});

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>("played");

const tableRows = computed(() => {
  const getters: Record<string, (a: MapVetoAggregate) => unknown> = {
    name: (a) => a.label || cleanMapName(a.name),
    played: (a) => a.played,
    win: (a) => winPct(a) ?? -1,
    banned: (a) => a.banned,
    picked: (a) => a.picked,
    firstBan: (a) => a.firstBan,
    firstPick: (a) => a.firstPick,
    decider: (a) => a.decider,
  };
  return sortRows(aggregates.value, getters);
});

function mapDisplay(agg: MapVetoAggregate): string {
  return agg.label || cleanMapName(agg.name);
}
</script>

<template>
  <div v-if="hasData">
    <div :class="[tacticalSectionLabelClasses, 'mb-0']">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("pages.teams.vetos.section") }}
    </div>
    <div :class="tacticalSectionDescriptionClasses">
      {{ $t("pages.teams.vetos.description") }}
    </div>

    <div
      v-if="loading && !hasData"
      class="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground"
    >
      {{ $t("pages.teams.vetos.loading") }}
    </div>

    <Empty v-else-if="!hasData" class="min-h-[160px] border border-border/60">
      <EmptyTitle>{{ $t("pages.teams.vetos.empty_title") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.teams.vetos.empty_description") }}
      </EmptyDescription>
    </Empty>

    <template v-else>
      <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-border/60 bg-card/40 px-4 py-3 [backdrop-filter:blur(6px)]">
          <div class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-destructive">
            {{ $t("pages.teams.vetos.most_banned") }}
          </div>
          <div class="mt-1 font-sans text-base font-bold">
            {{ mostBanned ? mapDisplay(mostBanned) : "—" }}
          </div>
          <div v-if="mostBanned" class="font-mono text-[0.65rem] text-muted-foreground">
            {{ mostBanned.banned }} {{ $t("pages.teams.vetos.bans_short") }}
          </div>
        </div>
        <div class="rounded-lg border border-border/60 bg-card/40 px-4 py-3 [backdrop-filter:blur(6px)]">
          <div class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]">
            {{ $t("pages.teams.vetos.most_picked") }}
          </div>
          <div class="mt-1 font-sans text-base font-bold">
            {{ mostPicked ? mapDisplay(mostPicked) : "—" }}
          </div>
          <div v-if="mostPicked" class="font-mono text-[0.65rem] text-muted-foreground">
            {{ mostPicked.picked }} {{ $t("pages.teams.vetos.picks_short") }}
          </div>
        </div>
        <div class="rounded-lg border border-border/60 bg-card/40 px-4 py-3 [backdrop-filter:blur(6px)]">
          <div class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-success">
            {{ $t("pages.teams.vetos.comfort_map") }}
          </div>
          <div class="mt-1 font-sans text-base font-bold">
            {{ comfortMap ? mapDisplay(comfortMap) : "—" }}
          </div>
          <div v-if="comfortMap" class="font-mono text-[0.65rem] text-muted-foreground">
            {{ fmtPct(winPct(comfortMap)) }} ·
            {{ comfortMap.played }} {{ $t("pages.teams.vetos.played_short") }}
          </div>
          <div v-else class="font-mono text-[0.65rem] text-muted-foreground">
            {{ $t("pages.teams.vetos.comfort_hint", { n: COMFORT_MIN_PLAYED }) }}
          </div>
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
                {{ $t("pages.teams.vetos.col_map") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="played"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("pages.teams.vetos.col_played") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="win"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("pages.teams.vetos.col_win") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="banned"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("pages.teams.vetos.col_banned") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="picked"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("pages.teams.vetos.col_picked") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="firstBan"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("pages.teams.vetos.col_first_ban") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="firstPick"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("pages.teams.vetos.col_first_pick") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="decider"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("pages.teams.vetos.col_decider") }}
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="agg of tableRows" :key="agg.mapId">
              <TableCell class="font-medium">
                {{ mapDisplay(agg) }}
              </TableCell>
              <TableCell class="text-right font-mono">
                {{ agg.played }}
              </TableCell>
              <TableCell class="text-right font-mono font-bold">
                <span class="inline-flex items-center gap-0.5">
                  {{ fmtPct(winPct(agg)) }}
                  <StatChevron :cfg="winTier" :value="winPct(agg)" />
                </span>
              </TableCell>
              <TableCell class="text-right font-mono">
                {{ agg.banned }}
                <span class="text-muted-foreground">
                  ({{ fmtPct(pctOf(agg.banned, totals.banned)) }})
                </span>
              </TableCell>
              <TableCell class="text-right font-mono">
                {{ agg.picked }}
                <span class="text-muted-foreground">
                  ({{ fmtPct(pctOf(agg.picked, totals.picked)) }})
                </span>
              </TableCell>
              <TableCell class="text-right font-mono text-muted-foreground">
                {{ fmtPct(pctOf(agg.firstBan, totals.firstBan)) }}
              </TableCell>
              <TableCell class="text-right font-mono text-muted-foreground">
                {{ fmtPct(pctOf(agg.firstPick, totals.firstPick)) }}
              </TableCell>
              <TableCell class="text-right font-mono text-muted-foreground">
                {{ agg.decider }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div class="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground/70">
        {{ $t("pages.teams.vetos.based_on", { n: totalRecords }) }}
      </div>
    </template>
  </div>
</template>
