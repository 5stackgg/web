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
              server_id: true,
              server_type: true,
              overtime: true,
              knife_round: true,
              mr: true,
              best_of: true,
              coaches: true,
              map_veto: true,
              veto_type: true,
              veto_picking_lineup_id: true,
              number_of_substitutes: true,
              lineup_1_id: true,
              lineup_2_id: true,
              organizer_steam_id: true,
              connection_string: true,
              connection_link: true,
              tv_connection_string: true,
              tv_connection_link: true,
              is_match_server_available: true,
              status: true,
              e_match_status: {
                description: true,
              },
              type: true,
              scheduled_at: true,
              map_pool: {
                label: true,
              },
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
                  map: {
                    name: true,
                    patch: true,
                    poster: true,
                  },
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
              lineups: {
                id: true,
                name: true,
                team_id: true,
                coach: {
                  name: true,
                  steam_id: true,
                  avatar_url: true,
                },
                captain: {
                  placeholder_name: true,
                  player: {
                    name: true,
                    steam_id: true,
                  },
                },
                lineup_players: [
                  {
                    order_by: [
                      {
                        player: {
                          name: $("order_by_name", "order_by"),
                          kills_aggregate: {
                            count: $("order_by_kills", "order_by"),
                          },
                        },
                      },
                    ],
                  },
                  {
                    captain: true,
                    steam_id: true,
                    player: {
                      name: true,
                      steam_id: true,
                      avatar_url: true,
                      kills_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              count: true,
                            },
                          ],
                        },
                      ],
                      assists_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              count: true,
                            },
                          ],
                        },
                      ],
                      deaths_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              count: true,
                            },
                          ],
                        },
                      ],
                      damage_dealt_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                            team_damage: {
                              _eq: false,
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              sum: {
                                damage: true,
                              },
                            },
                          ],
                        },
                      ],
                      multi_kills: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          kills: true,
                        },
                      ],
                      flashed_players_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              count: true,
                            },
                          ],
                        },
                      ],
                      __alias: {
                        hs_kills_aggregate: {
                          kills_aggregate: [
                            {
                              where: {
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                                headshot: {
                                  _eq: true,
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  count: true,
                                },
                              ],
                            },
                          ],
                        },
                        zeus_kills_aggregate: {
                          kills_aggregate: [
                            {
                              where: {
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                                with: {
                                  _eq: "taser",
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  count: true,
                                },
                              ],
                            },
                          ],
                        },
                        knife_kills_aggregate: {
                          kills_aggregate: [
                            {
                              where: {
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                                with: {
                                  _eq: "knife",
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  count: true,
                                },
                              ],
                            },
                          ],
                        },
                        team_flashes_aggregate: {
                          flashed_players_aggregate: [
                            {
                              where: {
                                team_flash: {
                                  _eq: true,
                                },
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  count: true,
                                },
                              ],
                            },
                          ],
                        },
                        avg_flash_duration_aggregate: {
                          flashed_players_aggregate: [
                            {
                              where: {
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  avg: {
                                    duration: true,
                                  },
                                },
                              ],
                            },
                          ],
                        },
                        flashes_thrown_aggregate: {
                          utility_thrown_aggregate: [
                            {
                              where: {
                                type: {
                                  _eq: "Flash",
                                },
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  count: true,
                                },
                              ],
                            },
                          ],
                        },
                        team_damage_aggregate: {
                          damage_dealt_aggregate: [
                            {
                              where: {
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                                team_damage: {
                                  _eq: true,
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  sum: {
                                    damage: true,
                                  },
                                },
                              ],
                            },
                          ],
                        },
                        he_damage_aggregate: {
                          damage_dealt_aggregate: [
                            {
                              where: {
                                with: {
                                  _eq: "hegrenade",
                                },
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                                team_damage: {
                                  _eq: false,
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  sum: {
                                    damage: true,
                                  },
                                },
                              ],
                            },
                          ],
                        },
                        molotov_damage_aggregate: {
                          // TODO - non team damage
                          damage_dealt_aggregate: [
                            {
                              where: {
                                with: {
                                  _eq: "molotov",
                                },
                                match_id: {
                                  _eq: $("matchId", "uuid!"),
                                },
                                team_damage: {
                                  _eq: false,
                                },
                              },
                            },
                            {
                              aggregate: [
                                {},
                                {
                                  sum: {
                                    damage: true,
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
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
