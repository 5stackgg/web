<script setup lang="ts">
import MatchMapSelection from "~/components/match/MatchMapSelection.vue";
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchMaps from "~/components/match/MatchMaps.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
</script>

<template>
  <template v-if="match">
    <div
      class="grid items-start gap-8 grid-cols-[1fr] lg:grid-cols-[minmax(320px,_400px)_1fr]"
    >
      <MatchInfo :match="match"></MatchInfo>

      <div class="grid gap-y-4">
        <div
          class="flex gap-4 max-h-[500px] justify-around"
          v-if="match.match_maps.length > 0"
        >
          <template v-for="match_map of match.match_maps">
            <MatchMaps :match="match" :match-map="match_map"></MatchMaps>
          </template>
        </div>

        <MatchMapSelection :match="match"></MatchMapSelection>

        <MatchTabs :match="match"></MatchTabs>
      </div>
    </div>
  </template>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { mapFields } from "~/graphql/mapGraphql";
import {matchLineups} from "~/graphql/matchLineupsGraphql";

export default {
  data() {
    return {
      match: undefined,
    };
  },
  apollo: {
    $subscribe: {
      matches_by_pk: {
        variables: function () {
          return {
            matchId: this.$route.params.id,
            order_by_name: order_by.asc,
            order_by_kills: order_by.desc,
            order_by_round_kills: order_by.asc,
          };
        },
        query: typedGql("subscription")({
          matches_by_pk: [
            {
              id: $("matchId", "uuid!"),
            },
            {
              id: true,
              status: true,
              server_id: true,
              server_type: true,
              lineup_1_id: true,
              lineup_2_id: true,
              veto_type: true,
              veto_picking_lineup_id: true,
              organizer_steam_id: true,
              connection_link: true,
              connection_string: true,
              tv_connection_string: true,
              tv_connection_link: true,
              is_match_server_available: true,
              options: {
                type: true,
                mr: true,
                best_of: true,
                coaches: true,
                map_veto: true,
                overtime: true,
                knife_round: true,
                number_of_substitutes: true,
                map_pool: {
                  type: true,
                },
              },
              e_match_status: {
                description: true,
              },
              scheduled_at: true,
              match_maps: [
                {
                  order_by: {
                    order: order_by.asc,
                  },
                },
                {
                  id: true,
                  order: true,
                  lineup_1_side: true,
                  lineup_2_side: true,
                  map: mapFields,
                  vetos: {
                    side: true,
                    type: true,
                    match_lineup_id: true,
                  },
                  status: true,
                  lineup_1_score: true,
                  lineup_2_score: true,
                  rounds: {
                    round: true,
                    kills: [
                      {
                        order_by: {
                          time: $("order_by_round_kills", "order_by"),
                        },
                      },
                      {
                        player: {
                          steam_id: true,
                        },
                        attacked_player: {
                          steam_id: true,
                        },
                      },
                    ],
                  },
                },
              ],
              lineup_1: [{}, matchLineups],
              lineup_2: [{}, matchLineups]
            },
          ],
        }),
        result: function ({ data }) {
          this.match = data.matches_by_pk;
        },
      },
    },
  },
};
</script>
