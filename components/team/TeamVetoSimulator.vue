<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { teamVetoStatsQuery } from "~/graphql/teamVetoStatsGraphql";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
  map_id: string | null;
  match_id: string | null;
  match_lineup_id: string | null;
  map: { id: string; name: string; label: string | null } | null;
  match: {
    id: string;
    match_maps: Array<{
      id: string;
      map_id: string | null;
      winning_lineup_id: string | null;
    }>;
  } | null;
}

interface TeamMapProfile {
  mapId: string;
  name: string;
  label: string | null;
  banRate: number;
  pickRate: number;
  played: number;
  winRate: number | null;
}

interface MapPrediction {
  mapId: string;
  name: string;
  label: string | null;
  banLikelihood: number;
  pickLikelihood: number;
  playLikelihood: number;
  predictedWin: number | null;
}

const PICK_WEIGHT = 1;
const BAN_PENALTY = 1;
const WIN_BLEND_SELF = 0.65;
const WIN_BLEND_OPP_INVERSE = 0.35;
const NEUTRAL_WIN = 50;

const bestOfOptions = [
  { value: "1", label: "BO1" },
  { value: "3", label: "BO3" },
  { value: "5", label: "BO5" },
];

const bestOf = ref("3");
const opponentId = ref<string>("");

const loading = ref(false);
const selfPicks = ref<RawVetoPick[]>([]);
const oppPicks = ref<RawVetoPick[]>([]);

let selfGen = 0;
let oppGen = 0;

async function fetchPicks(teamId: string): Promise<RawVetoPick[]> {
  const { data } = await apolloClient.query({
    query: teamVetoStatsQuery,
    variables: { teamId },
    fetchPolicy: "network-only",
  });
  return ((data as any)?.match_map_veto_picks ?? []) as RawVetoPick[];
}

async function loadSelf() {
  if (!props.teamId) {
    selfPicks.value = [];
    return;
  }
  const gen = ++selfGen;
  try {
    const picks = await fetchPicks(props.teamId);
    if (gen === selfGen) {
      selfPicks.value = picks;
    }
  } catch {
    if (gen === selfGen) {
      selfPicks.value = [];
    }
  }
}

async function loadOpp() {
  if (!opponentId.value) {
    oppPicks.value = [];
    return;
  }
  loading.value = true;
  const gen = ++oppGen;
  try {
    const picks = await fetchPicks(opponentId.value);
    if (gen === oppGen) {
      oppPicks.value = picks;
    }
  } catch {
    if (gen === oppGen) {
      oppPicks.value = [];
    }
  } finally {
    if (gen === oppGen) {
      loading.value = false;
    }
  }
}

watch(() => props.teamId, loadSelf, { immediate: true });
watch(opponentId, loadOpp);

function buildProfiles(picks: RawVetoPick[]): {
  profiles: Map<string, TeamMapProfile>;
  records: number;
} {
  const byMap = new Map<
    string,
    {
      name: string;
      label: string | null;
      bans: number;
      picks: number;
      played: Set<string>;
      wins: Set<string>;
    }
  >();
  let bans = 0;
  let picksTotal = 0;

  for (const pick of picks) {
    const map = pick.map;
    if (!map) {
      continue;
    }
    let entry = byMap.get(map.id);
    if (!entry) {
      entry = {
        name: map.name,
        label: map.label,
        bans: 0,
        picks: 0,
        played: new Set(),
        wins: new Set(),
      };
      byMap.set(map.id, entry);
    }
    if (pick.type === "Ban") {
      entry.bans += 1;
      bans += 1;
    } else if (pick.type === "Pick") {
      entry.picks += 1;
      picksTotal += 1;
    }
    const mm = pick.match?.match_maps?.find((m) => m.map_id === map.id);
    if (mm && !entry.played.has(mm.id)) {
      entry.played.add(mm.id);
      if (
        mm.winning_lineup_id &&
        pick.match_lineup_id &&
        mm.winning_lineup_id === pick.match_lineup_id
      ) {
        entry.wins.add(mm.id);
      }
    }
  }

  const profiles = new Map<string, TeamMapProfile>();
  for (const [mapId, entry] of byMap) {
    profiles.set(mapId, {
      mapId,
      name: entry.name,
      label: entry.label,
      banRate: bans > 0 ? entry.bans / bans : 0,
      pickRate: picksTotal > 0 ? entry.picks / picksTotal : 0,
      played: entry.played.size,
      winRate:
        entry.played.size > 0
          ? (entry.wins.size / entry.played.size) * 100
          : null,
    });
  }

  return { profiles, records: picks.length };
}

const selfBuilt = computed(() => buildProfiles(selfPicks.value));
const oppBuilt = computed(() => buildProfiles(oppPicks.value));

const hasSelf = computed(() => selfBuilt.value.records > 0);
const hasOpp = computed(() => oppBuilt.value.records > 0);

const predictions = computed<MapPrediction[]>(() => {
  const self = selfBuilt.value.profiles;
  const opp = oppBuilt.value.profiles;

  const mapIds = new Set<string>([...self.keys(), ...opp.keys()]);
  const rows: MapPrediction[] = [];

  for (const mapId of mapIds) {
    const s = self.get(mapId);
    const o = opp.get(mapId);
    const name = s?.name ?? o?.name ?? "";
    const label = s?.label ?? o?.label ?? null;

    const banScore =
      ((s?.banRate ?? 0) + (o?.banRate ?? 0)) * BAN_PENALTY;
    const pickScore =
      ((s?.pickRate ?? 0) + (o?.pickRate ?? 0)) * PICK_WEIGHT;

    const selfWin = s?.winRate ?? NEUTRAL_WIN;
    const oppWin = o?.winRate ?? NEUTRAL_WIN;
    const predictedWin =
      s || o
        ? WIN_BLEND_SELF * selfWin +
          WIN_BLEND_OPP_INVERSE * (100 - oppWin)
        : null;

    rows.push({
      mapId,
      name,
      label,
      banLikelihood: banScore,
      pickLikelihood: pickScore,
      playLikelihood: Math.max(0, pickScore - banScore * 0.5),
      predictedWin,
    });
  }

  const banTotal = rows.reduce((sum, r) => sum + r.banLikelihood, 0) || 1;
  const pickTotal = rows.reduce((sum, r) => sum + r.pickLikelihood, 0) || 1;
  const playTotal = rows.reduce((sum, r) => sum + r.playLikelihood, 0) || 1;

  for (const r of rows) {
    r.banLikelihood = (r.banLikelihood / banTotal) * 100;
    r.pickLikelihood = (r.pickLikelihood / pickTotal) * 100;
    r.playLikelihood = (r.playLikelihood / playTotal) * 100;
  }

  return rows.sort((a, b) => b.playLikelihood - a.playLikelihood);
});

const hasResult = computed(
  () => hasSelf.value && hasOpp.value && predictions.value.length > 0,
);

const winTier: StatTierConfig = { dir: "high", cuts: [58, 52, 46, 40] };

function fmtPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return Math.round(value) + "%";
}

function mapDisplay(row: MapPrediction): string {
  return row.label || cleanMapName(row.name);
}

function onOpponentSelected(team: { id: string }) {
  opponentId.value = team.id;
}
</script>

<template>
  <div v-if="hasSelf">
    <div :class="[tacticalSectionLabelClasses, 'mb-0']">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("pages.teams.veto_sim.section") }}
    </div>
    <div :class="tacticalSectionDescriptionClasses">
      {{ $t("pages.teams.veto_sim.description") }}
    </div>

    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="flex min-w-[220px] flex-col gap-1.5">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("pages.teams.veto_sim.opponent") }}
        </span>
        <TeamSearch
          v-model="opponentId"
          :label="$t('pages.teams.veto_sim.select_opponent')"
          :exclude="[props.teamId]"
          @selected="onOpponentSelected"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("pages.teams.veto_sim.format") }}
        </span>
        <Select v-model="bestOf">
          <SelectTrigger class="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt of bestOfOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div
      class="mb-4 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
    >
      {{ $t("pages.teams.veto_sim.estimate_notice") }}
    </div>

    <Empty
      v-if="!hasSelf"
      class="min-h-[140px] border border-border/60"
    >
      <EmptyTitle>{{ $t("pages.teams.veto_sim.no_self_title") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.teams.veto_sim.no_self_description") }}
      </EmptyDescription>
    </Empty>

    <Empty
      v-else-if="!opponentId"
      class="min-h-[140px] border border-border/60"
    >
      <EmptyTitle>{{ $t("pages.teams.veto_sim.pick_opponent_title") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.teams.veto_sim.pick_opponent_description") }}
      </EmptyDescription>
    </Empty>

    <div
      v-else-if="loading"
      class="flex min-h-[140px] items-center justify-center text-sm text-muted-foreground"
    >
      {{ $t("pages.teams.veto_sim.loading") }}
    </div>

    <Empty
      v-else-if="!hasOpp"
      class="min-h-[140px] border border-border/60"
    >
      <EmptyTitle>{{ $t("pages.teams.veto_sim.no_opp_title") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.teams.veto_sim.no_opp_description") }}
      </EmptyDescription>
    </Empty>

    <template v-else-if="hasResult">
      <div
        class="mb-3 flex flex-wrap gap-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        <span>
          {{ $t("pages.teams.veto_sim.confidence_self", { n: selfBuilt.records }) }}
        </span>
        <span>
          {{ $t("pages.teams.veto_sim.confidence_opp", { n: oppBuilt.records }) }}
        </span>
        <span>BO{{ bestOf }}</span>
      </div>

      <div
        class="overflow-x-auto rounded-lg border border-border/60 bg-card/40 [backdrop-filter:blur(6px)]"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ $t("pages.teams.veto_sim.col_map") }}</TableHead>
              <TableHead class="text-right">
                {{ $t("pages.teams.veto_sim.col_ban") }}
              </TableHead>
              <TableHead class="text-right">
                {{ $t("pages.teams.veto_sim.col_pick") }}
              </TableHead>
              <TableHead class="text-right">
                {{ $t("pages.teams.veto_sim.col_play") }}
              </TableHead>
              <TableHead class="text-right">
                {{ $t("pages.teams.veto_sim.col_predicted_win") }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row of predictions" :key="row.mapId">
              <TableCell class="font-medium">{{ mapDisplay(row) }}</TableCell>
              <TableCell class="text-right font-mono text-destructive">
                {{ fmtPct(row.banLikelihood) }}
              </TableCell>
              <TableCell class="text-right font-mono text-[hsl(var(--tac-amber))]">
                {{ fmtPct(row.pickLikelihood) }}
              </TableCell>
              <TableCell class="text-right font-mono">
                {{ fmtPct(row.playLikelihood) }}
              </TableCell>
              <TableCell class="text-right font-mono font-bold">
                <span class="inline-flex items-center gap-0.5">
                  {{ fmtPct(row.predictedWin) }}
                  <StatChevron :cfg="winTier" :value="row.predictedWin" />
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>
  </div>
</template>
