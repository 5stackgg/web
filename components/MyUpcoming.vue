<script lang="ts" setup>
import SimpleMatchDisplay from "./SimpleMatchDisplay.vue";
import SimpleTournamentDisplay from "./tournament/SimpleTournamentDisplay.vue";
</script>

<template>
  <div v-if="hasUpcomingItems" class="flex gap-4 overflow-x-auto">
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
</template>

<script lang="ts">
import { mapFields } from "~/graphql/mapGraphql";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";

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
            {
              id: true,
              name: true,
              start: true,
              e_tournament_status: {
                description: true,
              },
              options: {
                type: true,
                map_pool: {
                  maps: [{}, mapFields],
                },
              },
              stages: [
                {
                  order_by: [
                    {
                      order: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  type: true,
                  e_tournament_stage_type: {
                    description: true,
                  },
                  order: true,
                },
              ],
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            steam_id: useAuthStore().me?.steam_id || null,
            statuses: [
              e_tournament_status_enum.Cancelled,
              e_tournament_status_enum.CancelledMinTeams,
              e_tournament_status_enum.Finished,
            ],
          };
        },
        skip() {
          return !useAuthStore().me?.steam_id;
        },
        result({ data }: { data: any }) {
          this.tournaments = data?.tournaments || [];
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
  },
};
</script>
