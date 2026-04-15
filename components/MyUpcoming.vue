<script lang="ts" setup>
import SimpleMatchDisplay from "./SimpleMatchDisplay.vue";
import SimpleTournamentDisplay from "./tournament/SimpleTournamentDisplay.vue";
import {
  tacticalSectionDescriptionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <div v-if="hasUpcomingItems">
    <div :class="tacticalSectionLabelClasses">
      <span :class="tacticalSectionTickClasses"></span>
      Your Schedule
      <span
        class="rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.15)] px-[0.45rem] py-[0.05rem] text-[0.62rem] tracking-[0.08em] text-[hsl(var(--tac-amber))]"
      >
        {{ upcomingCount }}
      </span>
    </div>
    <div :class="tacticalSectionDescriptionClasses">
      Matches and tournaments you're currently part of.
    </div>
    <div class="flex gap-4 overflow-x-auto pb-1">
      <!-- Matches -->
      <SimpleMatchDisplay
        :key="`match-${match.id}`"
        :match="match"
        v-for="match of matches"
        class="flex-shrink-0"
      ></SimpleMatchDisplay>

      <!-- Tournaments -->
      <SimpleTournamentDisplay
        :key="`tournament-${tournament.id}`"
        :tournament="tournament"
        v-for="tournament of tournaments"
        class="flex-shrink-0"
      ></SimpleTournamentDisplay>
    </div>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";

export default {
  data() {
    return {
      tournaments: [],
    };
  },
  apollo: {
    $subscribe: {
      tournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              where: {
                status: {
                  _nin: $("statuses", "[e_tournament_status_enum]"),
                },
                rosters: {
                  player_steam_id: {
                    _eq: $("steam_id", "bigint"),
                  },
                },
              },
              order_by: [
                {},
                {
                  start: order_by.desc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            steam_id: useAuthStore().me.steam_id,
            statuses: [
              e_tournament_status_enum.Cancelled,
              e_tournament_status_enum.CancelledMinTeams,
              e_tournament_status_enum.Finished,
            ],
          };
        },
        result: function ({ data }) {
          this.tournaments = data.tournaments;
        },
      },
    },
  },
  computed: {
    matches() {
      return useMatchLobbyStore().myMatches;
    },
    currentMatch() {
      return useMatchLobbyStore().currentMatch;
    },
    hasUpcomingItems(): boolean {
      const matchesCount = this.matches?.length ?? 0;
      const tournamentsCount = this.tournaments?.length ?? 0;
      return matchesCount > 0 || tournamentsCount > 0;
    },
    upcomingCount(): number {
      return (this.matches?.length ?? 0) + (this.tournaments?.length ?? 0);
    },
  },
};
</script>
