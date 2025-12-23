<script lang="ts" setup>
import SimpleTournamentDisplay from "./SimpleTournamentDisplay.vue";
import Separator from "~/components/ui/separator/Separator.vue";
</script>

<template>
  <template v-if="tournaments?.length > 0">
    <div class="flex gap-4 overflow-x-auto">
      <SimpleTournamentDisplay
        :key="tournament.id"
        :tournament="tournament"
        v-for="tournament of tournaments"
      ></SimpleTournamentDisplay>
    </div>
    <Separator></Separator>
  </template>
</template>

<script lang="ts">
import { mapFields } from "~/graphql/mapGraphql";
import { generateQuery } from "~/graphql/graphqlGen";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";

export default {
  apollo: {
    tournaments: {
      fetchPolicy: "network-only",
      query: generateQuery({
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
              map_pool: {
                maps: [{}, mapFields],
              },
            },
          },
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
    },
  },
};
</script>
