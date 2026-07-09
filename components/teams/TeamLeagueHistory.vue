<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { Badge } from "~/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Trophy,
  Layers,
  ChevronDown,
} from "lucide-vue-next";
import { TEAM_LEAGUE_HISTORY_QUERY } from "~/graphql/leagues";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  teamId: string;
}>();

const { client: apolloClient } = useApolloClient();
const leagueTeams = ref<any[]>([]);
const loading = ref(true);
const showHistory = ref(false);

onMounted(async () => {
  try {
    const { data } = await apolloClient.query({
      query: TEAM_LEAGUE_HISTORY_QUERY,
      variables: { teamId: props.teamId },
      fetchPolicy: "cache-first",
    });
    leagueTeams.value = data?.league_teams ?? [];
  } finally {
    loading.value = false;
  }
});

function movementFor(leagueTeam: any, seasonId: string) {
  return (leagueTeam.movements ?? []).find(
    (movement: any) =>
      movement.league_season_id === seasonId && movement.approved_at,
  );
}

// All the team's league entries, newest first (team_seasons are ordered desc).
const allTeamSeasons = computed(() =>
  leagueTeams.value.flatMap((lt: any) => lt.team_seasons ?? []),
);

// The season the team is actively in right now (registration through playoffs).
const ACTIVE = [
  "Setup",
  "RegistrationOpen",
  "RegistrationClosed",
  "Live",
  "Playoffs",
];
const currentTeamSeason = computed(() =>
  allTeamSeasons.value.find(
    (ts: any) =>
      ts.status !== "Withdrawn" && ACTIVE.includes(ts.season?.status),
  ),
);

const currentDivision = computed(
  () => currentTeamSeason.value?.assigned_division ?? null,
);

// Best division ever reached — lowest tier wins (tier 1 is the top division).
const highestDivision = computed(() => {
  const divs = allTeamSeasons.value
    .filter((ts: any) => ts.status !== "Withdrawn")
    .map((ts: any) => ts.assigned_division)
    .filter(Boolean);
  if (!divs.length) return null;
  return divs.reduce((best: any, d: any) => (d.tier < best.tier ? d : best));
});
</script>

<template>
  <div v-if="!loading && leagueTeams.length" class="space-y-4">
    <section
      class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-5"
    >
      <span :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("league.list.title") }}
      </span>

      <!-- Currently playing in -->
      <NuxtLink
        v-if="currentTeamSeason"
        :to="{
          name: 'league-seasons-seasonId',
          params: { seasonId: currentTeamSeason.league_season_id },
        }"
        class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.06)] px-4 py-3 transition-colors hover:bg-[hsl(var(--tac-amber)/0.1)]"
      >
        <span class="flex items-center gap-2 text-sm">
          <Trophy class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
          <span class="font-medium">{{
            $t("league.history.playing_in", {
              season: currentTeamSeason.season.name,
            })
          }}</span>
        </span>
        <Badge
          variant="outline"
          class="border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]"
        >
          {{ $t(`league.season_status.${currentTeamSeason.season.status}`) }}
        </Badge>
      </NuxtLink>

      <!-- Current + highest division -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
          <div
            class="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Layers class="h-3 w-3 text-[hsl(var(--tac-amber))]" />
            {{ $t("league.history.current_division") }}
          </div>
          <div class="mt-1 font-medium">
            {{ currentDivision?.name ?? $t("league.history.none") }}
          </div>
        </div>
        <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
          <div
            class="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <ArrowUp class="h-3 w-3 text-success" />
            {{ $t("league.history.highest_division") }}
          </div>
          <div class="mt-1 font-medium">
            {{ highestDivision?.name ?? $t("league.history.none") }}
          </div>
        </div>
      </div>

      <!-- Toggleable season history -->
      <button
        type="button"
        class="mt-4 flex w-full items-center justify-between gap-2 border-t border-border/60 pt-4 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        @click="showHistory = !showHistory"
      >
        <span class="flex items-center gap-2">
          {{ $t("league.history.seasons") }}
          <span class="tabular-nums text-[hsl(var(--tac-amber))]">
            {{ allTeamSeasons.length }}
          </span>
        </span>
        <ChevronDown
          class="h-3.5 w-3.5 transition-transform"
          :class="{ 'rotate-180': showHistory }"
        />
      </button>

      <ul v-if="showHistory" class="mt-3 space-y-1.5">
        <template v-for="leagueTeam in leagueTeams" :key="leagueTeam.id">
          <li
            v-for="teamSeason in leagueTeam.team_seasons"
            :key="teamSeason.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
          >
            <NuxtLink
              :to="{
                name: 'league-seasons-seasonId',
                params: { seasonId: teamSeason.league_season_id },
              }"
              class="flex flex-wrap items-center gap-2 hover:text-[hsl(var(--tac-amber))]"
            >
              <span class="font-medium">{{ teamSeason.season.name }}</span>
              <Badge
                v-if="teamSeason.assigned_division"
                variant="outline"
                size="sm"
              >
                {{ teamSeason.assigned_division.name }}
              </Badge>
              <Badge
                v-if="teamSeason.status === 'Withdrawn'"
                variant="outline"
                size="sm"
                class="text-muted-foreground line-through"
              >
                {{ teamSeason.status }}
              </Badge>
            </NuxtLink>

            <span
              v-if="movementFor(leagueTeam, teamSeason.league_season_id)"
              class="flex items-center gap-1.5 font-mono text-xs"
            >
              <template
                v-for="movement in [
                  movementFor(leagueTeam, teamSeason.league_season_id),
                ]"
                :key="movement.id"
              >
                <span v-if="movement.final_rank" class="text-muted-foreground">
                  #{{ movement.final_rank }}
                </span>
                <ArrowUp
                  v-if="movement.type === 'Promote'"
                  class="h-3.5 w-3.5 text-success"
                />
                <ArrowDown
                  v-else-if="movement.type === 'Relegate'"
                  class="h-3.5 w-3.5 text-destructive"
                />
                <Minus v-else class="h-3.5 w-3.5 text-muted-foreground" />
                <span
                  v-if="
                    (
                      movement.final_to_division ??
                      movement.computed_to_division
                    )?.name && movement.type !== 'Stay'
                  "
                  class="text-muted-foreground"
                >
                  {{
                    (
                      movement.final_to_division ??
                      movement.computed_to_division
                    )?.name
                  }}
                </span>
              </template>
            </span>
          </li>
        </template>
      </ul>
    </section>
  </div>
</template>
