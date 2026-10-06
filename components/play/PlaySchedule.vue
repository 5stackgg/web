<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
import { NOT_LEAGUE_TOURNAMENT } from "~/graphql/tournamentFilters";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import PlayScheduleRow from "~/components/play/PlayScheduleRow.vue";
import {
  scheduleMatchRow,
  scheduleTournamentRow,
  sortScheduleRows,
} from "~/components/play/scheduleRow";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const { t, locale } = useI18n();
const auth = useAuthStore();

// Matches come from the store the header lobby nav already keeps live
// (scheduled ones only once they're within the hour).
const matches = computed<any[]>(() => useMatchLobbyStore().myMatches ?? []);
const tournaments = ref<any[]>([]);

const tournamentsQuery = generateSubscription({
  tournaments: [
    {
      where: {
        status: { _nin: $("statuses", "[e_tournament_status_enum!]") },
        rosters: { player_steam_id: { _eq: $("steam_id", "bigint!") } },
        _and: [NOT_LEAGUE_TOURNAMENT],
      },
      order_by: [{ start: order_by.asc }],
    },
    simpleTournamentFields,
  ],
} as any);

let tournamentsSub: { unsubscribe: () => void } | undefined;

watch(
  () => auth.me?.steam_id,
  (steamId) => {
    tournamentsSub?.unsubscribe();
    tournamentsSub = undefined;
    tournaments.value = [];
    if (!steamId || typeof window === "undefined") return;
    tournamentsSub = getGraphqlClient()
      .subscribe({
        query: tournamentsQuery,
        variables: {
          steam_id: steamId,
          statuses: [
            e_tournament_status_enum.Cancelled,
            e_tournament_status_enum.CancelledMinTeams,
            e_tournament_status_enum.Finished,
          ],
        },
      })
      .subscribe({
        next: ({ data }: any) => {
          tournaments.value = data?.tournaments ?? [];
        },
        error: (error: any) => {
          console.error("[play] schedule tournaments subscription:", error);
        },
      });
  },
  { immediate: true },
);

// Relative times ("in 15 min") and the "Now" cut-over tick along.
const now = ref(new Date());
const clock =
  typeof window !== "undefined"
    ? setInterval(() => (now.value = new Date()), 30_000)
    : null;

onBeforeUnmount(() => {
  tournamentsSub?.unsubscribe();
  if (clock) clearInterval(clock);
});

const rows = computed(() => {
  const ctx = {
    t,
    locale: locale.value,
    now: now.value,
    meSteamId: auth.me?.steam_id ?? null,
  };
  return sortScheduleRows([
    ...matches.value.map((match) => scheduleMatchRow(match, ctx)),
    ...tournaments.value.map((tournament) =>
      scheduleTournamentRow(tournament, ctx),
    ),
  ]);
});

const matchesById = computed(
  () => new Map(matches.value.map((match) => [match.id, match])),
);
</script>

<template>
  <section v-if="rows.length" aria-labelledby="play-schedule-label">
    <h2
      id="play-schedule-label"
      :class="[tacticalSectionLabelClasses, '!flex']"
    >
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("common.your_schedule") }}
    </h2>

    <TransitionGroup
      tag="div"
      class="schedule-grid grid gap-2"
      enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      enter-from-class="translate-y-1 opacity-0"
      leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
      leave-to-class="opacity-0"
    >
      <PlayScheduleRow
        v-for="row in rows"
        :key="row.key"
        :model="row"
        :match="row.kind === 'match' ? matchesById.get(row.id) : null"
      />
    </TransitionGroup>
  </section>
</template>

<style scoped>
/* Rows are subgrids of these tracks; one shared action column keeps every
   row's state text starting at the same x. */
.schedule-grid {
  grid-template-columns: 96px minmax(0, 1.4fr) minmax(0, 1fr) auto;
}

@media (max-width: 900px) {
  .schedule-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
