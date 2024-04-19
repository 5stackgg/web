<script setup lang="ts">
import MatchStatus from "~/components/match/MatchStatus.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "~/components/ui/card";
import {Separator} from "~/components/ui/separator";
import {Badge} from "~/components/ui/badge";
</script>
<template>
  <template v-if="match">
    <div class="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
      <div>
        <Card>
          <CardHeader class="flex flex-row items-start bg-muted/50">
            <div class="grid gap-0.5">
              <CardTitle class="group flex items-center gap-2 text-lg">
                {{ matchLineups.lineup1.name }} vs {{ matchLineups.lineup2.name }}
                <Badge variant="outline">
                  {{ match.type }} over {{ match.best_of}} map<span v-if="match.best_of > 1">s</span>
                </Badge>
              </CardTitle>
              <CardDescription>
                <Badge>
                  <match-status :match="match"></match-status>
                </Badge>
              </CardDescription>
            </div>
            <div class="ml-auto flex items-center gap-1">
              <match-actions :match="match"></match-actions>
            </div>
          </CardHeader>
          <CardContent class="p-6 text-sm">
            <div class="grid gap-3">
              <div class="font-semibold">
                Match Details
              </div>
              <ul class="grid gap-3">
                <li class="flex items-center justify-between">
                  <span class="text-muted-foreground">
                    Max Rounds
                  </span>
                  <span>{{ match.mr }}</span>
                </li>
                <li class="flex items-center justify-between">
                 <span class="text-muted-foreground">
                    Coaches
                  </span>
                  <span>{{ match.coaches }}</span>
                </li>
                <li class="flex items-center justify-between">
                 <span class="text-muted-foreground">
                    Overtime
                  </span>
                  <span>{{ match.overtime }}</span>
                </li>
                <li class="flex items-center justify-between">
                 <span class="text-muted-foreground">
                    Knife Round
                  </span>
                  <span>{{ match.knife_round }}</span>
                </li>
                <li class="flex items-center justify-between">
                 <span class="text-muted-foreground">
                    Map Veto
                  </span>
                  <span>{{ match.map_veto }}</span>
                </li>
                <li class="flex items-center justify-between">
                 <span class="text-muted-foreground">
                    Map Pool
                  </span>
                  <span>
                    {{ match.map_pool.label }}
                  </span>
                </li>
                <li class="flex items-center justify-between">
                 <span class="text-muted-foreground">
                    Substitutes
                  </span>
                  <span>{{ match.number_of_substitutes }}</span>
                </li>
              </ul>
              <Separator class="my-2" />
              <div class="grid gap-3">
                <div class="font-semibold">
                  Captains
                </div>
                <ul class="grid gap-3">
                  <li class="flex items-center justify-between">
                    <span class="text-muted-foreground">
                      Captain 1
                    </span>
                    <span>
                      <captain-info
                          :captain="matchLineups.lineup1.captain"
                      ></captain-info>
                    </span>
                  </li>
                  <li class="flex items-center justify-between">
                    <span class="text-muted-foreground">
                      Captain 2
                    </span>
                    <span>
                      <captain-info
                          :captain="matchLineups.lineup2.captain"
                      ></captain-info>
                    </span>
                  </li>
                </ul>
              </div>
              <Separator class="my-2" />
              <div class="grid gap-3">
                <div class="font-semibold">
                  <template v-if="match.map_veto">
                    Map Veto
                  </template>
                  <template v-else>
                    Maps
                  </template>
                </div>
                <div
                    class="mt-1 text-gray-600 dark:text-gray-400"
                    v-for="match_map of match.match_maps"
                >
                  [{{ match_map.status }}] {{ match_map.map.name }}
                  <template v-for="veto of match_map.vetos">
                    <template v-if="veto.type === 'LeftOver'"
                    >[Left Over]</template
                    >
                  </template>
                  <p>
                    {{ matchLineups.lineup1.name }}:
                    {{ match_map.lineup_1_score }}
                    <template v-for="veto of match_map.vetos">
                      <template
                          v-if="
                          veto.type === 'Pick' &&
                          veto.match_lineup_id === matchLineups.lineup1.id
                        "
                      >[PICKED]</template
                      >
                    </template>
                  </p>
                  <p>
                    {{ matchLineups.lineup2.name }}:
                    {{ match_map.lineup_2_score }}
                    <template v-for="veto of match_map.vetos">
                      <template
                          v-if="
                          veto.type === 'Pick' &&
                          veto.match_lineup_id === matchLineups.lineup2.id
                        "
                      >[PICKED]</template
                      >
                    </template>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div class="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
        <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          <match-assign-lineups
              :match="match"
              v-if="assigningLineups"
          ></match-assign-lineups>
<!--          <match-assign-coach :match="match"></match-assign-coach>-->
<!--          <match-map-veto :match="match"></match-map-veto>-->
<!--          <match-map-picks :match="match" if="assigningMaps"></match-map-picks>-->
        </div>
        <match-tabs :match="match"></match-tabs>
      </div>
    </div>
  </template>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import getMatchLineups from "~/utilities/getMatchLineups";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";

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
              map_pool: {
                label: true,
                maps: {
                  name: true,
                }
              },
              match_maps: {
                id: true,
                map: {
                  name: true,
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
              lineups: {
                id: true,
                name: true,
                team_id: true,
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
