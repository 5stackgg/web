<template>
  <template v-if="match">
    <div class="px-4 sm:px-6 lg:px-8">
      <div class="mt-5 lg:mt-16 grid lg:grid-cols-3 gap-8 lg:gap-12">
        <div class="lg:col-span-1">
          <h2
            class="font-bold text-2xl md:text-3xl text-gray-800 dark:text-gray-200"
          >
            {{ matchLineups.lineup1.name }} vs {{ matchLineups.lineup2.name }}
          </h2>
          <match-actions :match="match"></match-actions>
        </div>

        <div class="lg:col-span-2">
          <div class="grid sm:grid-cols-2 gap-8 md:gap-12">
            <div class="flex gap-x-5">
              <div class="grow">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                  Match Status
                </h3>
                <match-status :match="match"></match-status>
              </div>
            </div>

            <div class="flex gap-x-5">
              <div class="grow">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                  {{ match.type }}
                </h3>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                  First to {{ match.mr + 1 }} with
                  <template v-if="match.overtime">overtime</template>
                  <br />
                  best of {{ match.best_of }}
                </p>
              </div>
            </div>

            <div class="flex gap-x-5">
              <div class="grow">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                  Map<template v-if="match.best_of > 1">s</template>
                </h3>
                <template v-if="match.match_maps.length !== match.best_of">
                  Picking Maps
                </template>
                <div
                  class="mt-1 text-gray-600 dark:text-gray-400"
                  v-for="match_map of match.match_maps"
                >
                  [{{ match_map.status }}] {{ match_map.map }}
                  <p>
                    {{ matchLineups.lineup1.name }}:
                    {{ match_map.lineup_1_score }}
                  </p>
                  <p>
                    {{ matchLineups.lineup2.name }}:
                    {{ match_map.lineup_2_score }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex gap-x-5">
              <div class="grow">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                  Captains
                </h3>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                  Captain 1:
                  <captain-info
                    :captain="matchLineups.lineup1.captain"
                  ></captain-info>
                  <br />
                  Captain 2:
                  <captain-info
                    :captain="matchLineups.lineup2.captain"
                  ></captain-info>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <pre>
      Veto: {{ match.map_veto }}
      Coaches: {{ match.coaches }}
      Substitutes: {{ match.number_of_substitutes }}
    </pre>

    <hr class="mt-8 mb-8 border-gray-600" />

    <map-veto :match="match"></map-veto>

    <match-assign-coach :match="match"></match-assign-coach>

    <match-assign-lineups
      :match="match"
      v-if="assigningLineups"
    ></match-assign-lineups>

    <match-map-picks :match="match" v-else-if="assigningMaps"></match-map-picks>

    <template v-if="assigningLineups || assigningMaps">
      <hr class="mt-8 mb-8 border-gray-600" />
    </template>

    <match-tabs :match="match"></match-tabs>
  </template>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import getMatchLineups from "~/utilities/getMatchLineups";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import MapVeto from "~/components/veto/MapVeto.vue";
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchMapPicks from "~/components/match/MatchMapPicks.vue";
import MatchAssignLineups from "~/components/match/MatchAssignLineups.vue";
import { useAuthStore } from "~/stores/AuthStore";
import MatchAssignCoach from "~/components/match/MatchAssignCoach.vue";

export default {
  components: {
    MatchAssignCoach,
    MapVeto,
    MatchTabs,
    MatchStatus,
    MatchActions,
    MatchMapPicks,
    MatchAssignLineups,
  },
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
              overtime: true,
              knife_round: true,
              mr: true,
              best_of: true,
              coaches: true,
              map_veto: true,
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
              type: true,
              scheduled_at: true,
              match_maps: {
                id: true,
                map: {
                  name: true,
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
              lineups: {
                id: true,
                name: true,
                coach: {
                  name: true,
                  steam_id: true,
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
  computed: {
    me() {
      return useAuthStore().me;
    },
    matchLineups() {
      return getMatchLineups(this.match);
    },
    assigningLineups() {
      const currentStatus = this.match.status;
      return (
        this.match.organizer_steam_id == this.me.steam_id &&
        (currentStatus == "Warmup" ||
          currentStatus == "PickingPlayers" ||
          currentStatus == "Scheduled") &&
        (this.canAddToLineup1 || this.canAddToLineup2)
      );
    },
    assigningMaps() {
      return this.match.best_of !== this.match.match_maps.length;
    },
    maxPlayersPerLineup() {
      return (
        (this.match?.type === "Wingman" ? 2 : 5) +
        this.match.number_of_substitutes
      );
    },
    canAddToLineup1() {
      return (
        this.matchLineups.lineup1?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
    canAddToLineup2() {
      return (
        this.matchLineups.lineup2?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
  },
};
</script>
