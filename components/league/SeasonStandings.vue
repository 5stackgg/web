<script setup lang="ts">
import { ref, computed, watch } from "vue";
import LeagueStandings from "~/components/league/LeagueStandings.vue";
import Pagination from "~/components/Pagination.vue";
import { Input } from "~/components/ui/input";
import { Search } from "lucide-vue-next";
import { usePerPage } from "~/composables/usePerPage";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Division-segmented standings with client-side pagination + a per-page
// selector, defaulting to (and snapping to the page holding) the viewer's team.
const props = defineProps<{
  seasonDivisions: any[];
  teamNames: Record<string, string>;
  playoffSeats?: number;
  withdrawnTeamSeasonIds?: string[];
  myTeamSeasonIds?: string[];
}>();

const divisions = computed(() =>
  (props.seasonDivisions ?? []).filter((sd: any) => sd.tournament_id),
);

const selectedDivisionId = ref<string>("");
const activeDivision = computed(
  () =>
    divisions.value.find(
      (sd: any) => sd.league_division_id === selectedDivisionId.value,
    ) ?? divisions.value[0],
);
const standings = computed<any[]>(() => activeDivision.value?.standings ?? []);

// Team-name search filter over the active division's standings.
const search = ref("");
const filteredStandings = computed<any[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return standings.value;
  return standings.value.filter((r: any) =>
    (props.teamNames[r.league_team_season_id] ?? "").toLowerCase().includes(q),
  );
});

const page = ref(1);
const perPage = usePerPage("league-standings");
const pagedStandings = computed(() =>
  filteredStandings.value.slice(
    (page.value - 1) * perPage.value,
    page.value * perPage.value,
  ),
);
watch(search, () => (page.value = 1));

// The division that holds the viewer's team (so we default to it).
function divisionOfMyTeam(): string | null {
  for (const sd of divisions.value) {
    if (
      (sd.standings ?? []).some((r: any) =>
        props.myTeamSeasonIds?.includes(r.league_team_season_id),
      )
    ) {
      return sd.league_division_id;
    }
  }
  return null;
}

// Snap to the page that holds the viewer's team in the active division.
function snap() {
  const idx = standings.value.findIndex((r: any) =>
    props.myTeamSeasonIds?.includes(r.league_team_season_id),
  );
  page.value = idx >= 0 ? Math.floor(idx / perPage.value) + 1 : 1;
}

watch(
  divisions,
  (list) => {
    if (
      !list.some(
        (sd: any) => sd.league_division_id === selectedDivisionId.value,
      )
    ) {
      selectedDivisionId.value =
        divisionOfMyTeam() ?? list[0]?.league_division_id ?? "";
    }
    snap();
  },
  { immediate: true },
);
watch(selectedDivisionId, snap);
watch(perPage, snap);
</script>

<template>
  <section
    v-if="divisions.length"
    class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-5"
  >
    <div class="flex flex-wrap items-center gap-3">
      <span :class="[tacticalSectionLabelClasses, '!mb-0']">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("league.tabs.standings") }}
      </span>
      <div class="relative ml-auto w-full max-w-[220px]">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          :placeholder="$t('league.standings.search')"
          class="h-8 pl-8"
        />
      </div>
    </div>

    <div v-if="divisions.length > 1" class="mt-3 flex flex-wrap gap-1.5">
      <button
        v-for="sd in divisions"
        :key="sd.id"
        class="inline-flex h-8 items-center rounded-md border px-3 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors"
        :class="
          activeDivision?.id === sd.id
            ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
            : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
        "
        @click="selectedDivisionId = sd.league_division_id"
      >
        {{ sd.division.name }}
      </button>
    </div>

    <div class="mt-4">
      <LeagueStandings
        :standings="pagedStandings"
        :team-names="teamNames"
        :playoff-seats="playoffSeats"
        :total-teams="standings.length"
        :withdrawn-team-season-ids="withdrawnTeamSeasonIds"
        :highlight-team-season-ids="myTeamSeasonIds"
      />

      <Pagination
        v-if="filteredStandings.length > perPage || perPage !== 10"
        class="mt-4"
        :page="page"
        :per-page="perPage"
        :total="filteredStandings.length"
        :show-per-page-selector="true"
        @page="(p: number) => (page = p)"
        @update:perPage="(v: number) => ((perPage = v), (page = 1), snap())"
      />
    </div>
  </section>
</template>
