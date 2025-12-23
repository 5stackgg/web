<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";
import TournamentActions from "~/components/tournament/TournamentActions.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchOptionsDisplay from "~/components/match/MatchOptionsDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { Settings, Users } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NuxtLink } from "#components";
</script>

<template>
  <div v-if="tournament">
    <Tabs default-value="overview">
      <div class="flex justify-between">
        <TabsList class="lg:inline-flex grid grid-cols-1 w-full lg:w-fit">
          <TabsTrigger value="overview">{{
            $t("tournament.overview")
          }}</TabsTrigger>
          <TabsTrigger v-if="myTeam" value="my-team">
            {{ $t("tournament.teams.my_teams") }}
          </TabsTrigger>
          <TabsTrigger value="teams">
            {{
              $t("tournament.teams.count", {
                count: tournament?.teams_aggregate?.aggregate?.count || 0,
              })
            }}
          </TabsTrigger>
        </TabsList>
      </div>

      <div
        class="bg-muted/40 rounded-xl px-6 py-4 mt-2 mb-6 shadow-sm border border-border"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 min-w-0">
              <h1 class="truncate text-2xl sm:text-3xl font-bold">
                {{ tournament.name }}
              </h1>
              <Badge
                variant="secondary"
                class="text-xs font-semibold h-6 flex items-center"
              >
                {{ tournament.options.type }}
              </Badge>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <TimeAgo
                :date="tournament.start"
                class="text-xs text-muted-foreground"
              />
            </div>
            <div
              v-if="tournament.description"
              class="mt-2 text-sm text-muted-foreground line-clamp-3"
            >
              {{ tournament.description }}
            </div>
          </div>

          <div class="flex items-center gap-3 flex-shrink-0">
            <Badge v-if="tournament" class="text-xs h-6 flex items-center">
              {{ tournament.e_tournament_status.description }}
            </Badge>
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="icon"
                  v-if="tournament.is_organizer"
                  :title="$t('tournament.settings')"
                  class="hover:bg-accent"
                >
                  <Settings class="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-80">
                <div class="grid gap-4">
                  <div class="space-y-2">
                    <h4 class="font-medium">Tournament Settings</h4>
                    <p class="text-sm text-muted-foreground">
                      Manage tournament settings and options
                    </p>
                  </div>
                  <Separator />
                  <div class="grid gap-2">
                    <NuxtLink
                      :to="{
                        name: 'tournaments-tournamentId-match-options',
                        params: { tournamentId: tournament.id },
                      }"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                    >
                      <Settings class="mr-2 h-4 w-4" />
                      Match Options
                    </NuxtLink>
                    <NuxtLink
                      :to="{
                        name: 'tournaments-tournamentId-organizers',
                        params: { tournamentId: tournament.id },
                      }"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                    >
                      <Users class="mr-2 h-4 w-4" />
                      Organizers
                    </NuxtLink>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <TournamentActions
              :tournament="tournament"
              class="ml-2"
            ></TournamentActions>
          </div>
        </div>
      </div>

      <TabsContent value="overview">
        <div class="flex flex-col md:flex-row gap-6">
          <Card class="h-fit p-6 md:w-1/3">
            <CardContent>
              <MatchOptionsDisplay
                :show-details-by-default="false"
                :options="tournament.options"
              ></MatchOptionsDisplay>

              <div class="mt-4 space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold">
                    {{ $t("tournament.admin") }}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    @click="showOrganizers = !showOrganizers"
                    v-if="tournament.organizers.length > 0"
                  >
                    {{
                      showOrganizers
                        ? $t("tournament.hide_organizers")
                        : $t("tournament.show_organizers")
                    }}
                  </Button>
                </div>
                <PlayerDisplay :player="tournament.admin" />

                <template
                  v-if="tournament.organizers.length > 0 && showOrganizers"
                >
                  <Separator class="my-4" />
                  <div
                    class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                  >
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
            </CardContent>
          </Card>

          <div class="w-full md:w-2/3 space-y-4">
            <div
              v-if="
                tournament.status === e_tournament_status_enum.RegistrationOpen
              "
            >
              <Card class="p-4">
                <CardHeader>
                  <CardTitle class="text-xl">{{
                    $t("tournament.join.title")
                  }}</CardTitle>
                </CardHeader>
                <CardContent>
                  <template v-if="tournament.can_join">
                    <TournamentJoinForm
                      :tournament="tournament"
                      @close="tournamentDialog = false"
                    />
                  </template>
                  <template v-else-if="myTeam">
                    {{
                      $t("tournament.join.joined_with", { name: myTeam.name })
                    }}
                  </template>
                </CardContent>
              </Card>
            </div>
            <TournamentStageBuilder
              class="border-2 border-dashed p-6"
              :tournament="tournament"
            ></TournamentStageBuilder>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="my-team" v-if="myTeam">
        <div class="flex flex-col md:flex-row gap-6">
          <div class="flex-grow md:w-2/3">
            <Card class="p-4">
              <TournamentTeam
                :tournament="tournament"
                :team="myTeam"
              ></TournamentTeam>
            </Card>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="teams">
        <div class="flex flex-col md:flex-row gap-6">
          <div class="flex-grow md:w-2/3">
            <div class="grid gap-4">
              <Card class="p-4" v-for="team of tournament.teams" :key="team.id">
                <TournamentTeam
                  :tournament="tournament"
                  :team="team"
                ></TournamentTeam>
              </Card>
            </div>
          </div>

          <div class="w-full md:w-1/3 space-y-4" v-if="tournament.is_organizer">
            <Card class="p-4">
              <CardHeader>
                <CardTitle class="text-xl">{{
                  $t("tournament.add_team.title")
                }}</CardTitle>
              </CardHeader>
              <CardContent>
                <TournamentJoinForm
                  :tournament="tournament"
                ></TournamentJoinForm>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script lang="ts">
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";
import tournamentTeamFields from "~/graphql/tournamentTeamFields";
import { mapFields } from "~/graphql/mapGraphql";
import { playerFields } from "~/graphql/playerFields";

export default {
  data() {
    return {
      myTeam: undefined,
      tournament: undefined,
      tournamentDialog: false,
      teamSearchQuery: undefined,
      settingsDialogOpen: false,
      organizersDialogOpen: false,
      showOrganizers: false,
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
              e_tournament_status: {
                description: true,
              },
              description: true,
              is_organizer: true,
              can_join: true,
              can_cancel: true,
              can_open_registration: true,
              can_close_registration: true,
              min_players_per_lineup: true,
              max_players_per_lineup: true,
              admin: playerFields,
              options: {
                id: true,
                type: true,
                mr: true,
                map_veto: true,
                coaches: true,
                knife_round: true,
                default_models: true,
                overtime: true,
                region_veto: true,
                best_of: true,
                tv_delay: true,
                number_of_substitutes: true,
                timeout_setting: true,
                tech_timeout_setting: true,
                ready_setting: true,
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
                  organizer: playerFields,
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
                    {
                      created_at: order_by.asc,
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
                  groups: true,
                  min_teams: true,
                  max_teams: true,
                  brackets: [
                    {
                      order_by: [
                        {
                          round: order_by.asc,
                        },
                        {
                          group: order_by.asc,
                        },
                        {
                          path: order_by.desc,
                        },
                        {
                          match_number: order_by.asc,
                        },
                      ],
                    },
                    {
                      id: true,
                      round: true,
                      group: true,
                      bye: true,
                      match_number: true,
                      scheduled_eta: true,
                      team_1_seed: true,
                      team_2_seed: true,
                      path: true,
                      loser_parent_bracket_id: true,
                      parent_bracket: {
                        id: true,
                        round: true,
                        group: true,
                        match_number: true,
                        path: true,
                      },
                      loser_bracket: {
                        id: true,
                        round: true,
                        group: true,
                        match_number: true,
                        path: true,
                      },
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
            Object.assign({}, tournamentTeamFields, {
              invites: [
                {},
                {
                  id: true,
                  player: playerFields,
                },
              ],
            }),
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
    openSettingsDialog() {
      this.settingsDialogOpen = true;
    },
    openOrganizersDialog() {
      this.organizersDialogOpen = true;
    },
  },
};
</script>
