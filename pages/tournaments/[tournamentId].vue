<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";
import TournamentOrganizers from "~/components/tournament/TournamentOrganizers.vue";
import TournamentServers from "~/components/tournament/TournamentServers.vue";
import MapDisplay from "~/components/MapDisplay.vue";
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import TournamentAddTeam from "~/components/tournament/TournamentAddTeam.vue";
import TournamentActions from "~/components/tournament/TournamentActions.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchOptionsDisplay from "~/components/match/MatchOptionsDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <div v-if="tournament">
    <Tabs default-value="overview">
      <div class="flex justify-between">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bracket">Bracket</TabsTrigger>
          <TabsTrigger value="teams">
            Teams ({{ tournament?.teams_aggregate?.aggregate?.count || 0 }})
          </TabsTrigger>
          <TabsTrigger value="manage" v-if="tournament.is_organizer"
            >Settings</TabsTrigger
          >
        </TabsList>
      </div>

      <TabsContent value="overview">
        <div class="flex flex-col md:flex-row gap-6">
          <Card class="flex-grow p-6 md:w-2/3">
            <CardHeader>
              <div
                class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4"
              >
                <div>
                  <Badge v-if="tournament?.status">{{
                    tournament.status
                  }}</Badge>

                  <CardTitle class="text-2xl font-bold mb-2 sm:mb-0">
                    {{ tournament.name }}
                    <Badge variant="secondary" class="text-sm ml-2">
                      {{ tournament.options.type }}
                    </Badge>
                  </CardTitle>

                  <TimeAgo
                    :date="tournament.start"
                    class="text-sm text-muted-foreground"
                  />
                </div>

                <div class="flex flex-col items-start gap-2 mt-2">
                  <TournamentActions
                    :tournament="tournament"
                  ></TournamentActions>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Card class="py-4">
                <CardContent>
                  <div class="prose">{{ tournament.description }}</div>
                </CardContent>
              </Card>

              <div class="mt-4 space-y-4">
                <h3 class="text-lg font-semibold mb-2">Admin</h3>
                <PlayerDisplay :player="tournament.admin" />

                <template v-if="tournament.organizers.length > 0">
                  <Separator class="my-8" />

                  <h3 class="text-lg font-semibold mb-2">Organizers</h3>
                  <div class="grid grid-cols-4 gap-4">
                    <div
                      v-for="{ organizer } of tournament.organizers"
                      :key="organizer.steam_id"
                      class="flex items-center space-x-2"
                    >
                      <PlayerDisplay :player="organizer" />
                    </div>
                  </div>
                </template>
              </div>

              <Separator class="my-8" />

              <MatchOptionsDisplay
                :options="tournament.options"
              ></MatchOptionsDisplay>

              <Separator class="my-8" />

              <div>
                <h3 class="text-lg font-semibold mb-2">Map Pool</h3>
                <div
                  class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                >
                  <MapDisplay
                    v-for="map in tournament.options.map_pool.maps"
                    :key="map.id"
                    :map="map"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div class="w-full md:w-1/3 space-y-4">
            <Card class="p-4">
              <CardHeader>
                <CardTitle class="text-xl">Join Tournament</CardTitle>
              </CardHeader>
              <CardContent>
                <TournamentJoinForm
                  :tournament="tournament"
                  @close="tournamentDialog = false"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="bracket">
        <TournamentStageBuilder
          :tournament="tournament"
        ></TournamentStageBuilder>
      </TabsContent>
      <TabsContent value="teams">
        <div class="flex flex-col md:flex-row gap-6">
          <div class="flex-grow md:w-2/3">
            <template v-if="myTeam">
              <Card class="p-4">
                <TournamentTeam
                  :tournament="tournament"
                  :team="myTeam"
                ></TournamentTeam>
              </Card>
              <Separator class="my-8" />
            </template>

            <Card class="p-4" v-for="team of teams" :key="team.id">
              <div class="flex justify-between items-center mb-4">
                <NuxtLink
                  :to="`/tournaments/${tournament.id}/teams/${team.id}`"
                  class="text-lg font-semibold hover:underline"
                >
                  {{ team.name }}
                </NuxtLink>
                <span class="text-sm text-gray-600">
                  {{ team.roster_aggregate.aggregate.count }} players registered
                </span>
              </div>

              <div
                class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4"
              >
                <PlayerDisplay
                  v-for="{ player } of team.roster"
                  :key="player.steam_id"
                  :player="player"
                  class="text-sm"
                ></PlayerDisplay>
              </div>

              <Button
                v-if="tournament.is_organizer"
                @click="removeTeam(team.id)"
                variant="destructive"
                size="sm"
                class="w-full sm:w-auto"
              >
                Remove Team
              </Button>
            </Card>
          </div>

          <div class="w-full md:w-1/3 space-y-4" v-if="tournament.is_organizer">
            <Card class="p-4">
              <CardHeader>
                <CardTitle class="text-xl"> Add Team to Tournament </CardTitle>
              </CardHeader>
              <CardContent>
                <TournamentAddTeam :tournament="tournament"></TournamentAddTeam>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="manage">
        <Tabs default-value="match-options">
          <TabsList>
            <TabsTrigger value="match-options"> Match Options </TabsTrigger>
            <TabsTrigger value="organizers"> Organizers </TabsTrigger>
            <TabsTrigger value="servers"> Servers </TabsTrigger>
          </TabsList>
          <TabsContent value="match-options">
            <TournamentForm :tournament="tournament"></TournamentForm>
          </TabsContent>
          <TabsContent value="organizers">
            <TournamentOrganizers :tournament="tournament">
            </TournamentOrganizers>
          </TabsContent>
          <TabsContent value="servers">
            <TournamentServers :tournament="tournament"></TournamentServers>
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";
import tournamentTeamFields from "~/graphql/tournamentTeamFields";
import { mapFields } from "~/graphql/mapGraphql";
import { generateMutation } from "~/graphql/graphqlGen";

/**
 * https://codepen.io/eth0lo/pen/dyyrGww
 */
export default {
  data() {
    return {
      myTeam: undefined,
      tournament: undefined,
      tournamentDialog: false,
      teamSearchQuery: undefined,
    };
  },
  apollo: {
    $subscribe: {
      tournaments_by_pk: {
        query: typedGql("subscription")({
          tournaments_by_pk: [
            {
              id: $("tournamentId", "uuid!"),
            },
            {
              id: true,
              name: true,
              start: true,
              status: true,
              description: true,
              is_organizer: true,
              can_join: true,
              can_cancel: true,
              can_open_registration: true,
              can_close_registration: true,
              min_players_per_lineup: true,
              max_players_per_lineup: true,
              admin: {
                name: true,
                country: true,
                steam_id: true,
                avatar_url: true,
              },
              options: {
                id: true,
                type: true,
                mr: true,
                map_veto: true,
                coaches: true,
                knife_round: true,
                overtime: true,
                region_veto: true,
                best_of: true,
                tv_delay: true,
                number_of_substitutes: true,
                timeout_setting: true,
                tech_timeout_setting: true,
                map_pool: [
                  {},
                  {
                    id: true,
                    type: true,
                    e_type: {
                      description: true,
                    },
                    maps: [{}, mapFields],
                  },
                ],
              },
              organizers: [
                {},
                {
                  organizer: {
                    name: true,
                    country: true,
                    steam_id: true,
                    avatar_url: true,
                  },
                },
              ],
              teams: [
                {
                  order_by: [
                    {
                      seed: order_by.asc,
                    },
                    {
                      eligible_at: order_by.asc,
                    },
                  ],
                },
                tournamentTeamFields,
              ],
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ],
              servers: [
                {},
                {
                  server_id: true,
                },
              ],
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
                  min_teams: true,
                  max_teams: true,
                  brackets: [
                    {
                      order_by: [
                        {
                          round: order_by.asc,
                        },
                        {
                          match_number: order_by.asc,
                        },
                      ],
                    },
                    {
                      id: true,
                      round: true,
                      match_number: true,
                      match: {
                        id: true,
                        status: true,
                        winning_lineup_id: true,
                        lineup_1: {
                          id: true,
                          name: true,
                        },
                        lineup_2: {
                          id: true,
                          name: true,
                        },
                        match_maps: [
                          {
                            order_by: [
                              {
                                order: order_by.asc,
                              },
                            ],
                          },
                          {
                            order: true,
                            status: true,
                            lineup_1_score: true,
                            lineup_2_score: true,
                          },
                        ],
                      },
                      team_1: {
                        id: true,
                        name: true,
                        team: {
                          name: true,
                        },
                      },
                      team_2: {
                        id: true,
                        name: true,
                        team: {
                          name: true,
                        },
                      },
                      created_at: true,
                    },
                  ],
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            tournamentId: this.$route.params.tournamentId,
          };
        },
        result: function ({ data }) {
          this.tournament = data.tournaments_by_pk;
        },
      },
      tournament_teams: {
        query: typedGql("subscription")({
          tournament_teams: [
            {
              where: {
                tournament_id: {
                  _eq: $("tournamentId", "uuid!"),
                },
                _or: [
                  {
                    owner_steam_id: {
                      _eq: $("steam_id", "bigint!"),
                    },
                  },
                  {
                    roster: {
                      player_steam_id: {
                        _eq: $("steam_id", "bigint!"),
                      },
                    },
                  },
                ],
              },
            },
            tournamentTeamFields,
          ],
        }),
        variables: function () {
          return {
            steam_id: this.me.steam_id,
            tournamentId: this.$route.params.tournamentId,
          };
        },
        result: function ({ data }) {
          this.myTeam = data.tournament_teams?.[0];
        },
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
  methods: {
    async removeTeam(teamId) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_teams_by_pk: [
            {
              id: teamId,
            },
            {
              id: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
