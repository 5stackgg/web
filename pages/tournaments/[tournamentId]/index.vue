<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import TournamentOrganizers from "~/components/tournament/TournamentOrganizers.vue";
import TournamentResults from "~/components/tournament/TournamentResults.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchOptionsDisplay from "~/components/match/MatchOptionsDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import {
  Settings,
  Users,
  ChevronDown,
  Lock,
  Unlock,
  Ban,
  UserPlus,
  Trash,
  Play,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NuxtLink } from "#components";
import MatchTableRow from "~/components/MatchTableRow.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
</script>

<template>
  <div v-if="tournament">
    <Tabs v-model="activeTab" default-value="overview">
      <div class="flex items-center gap-2">
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
          <TabsTrigger
            v-if="
              tournament.status === e_tournament_status_enum.Live ||
              tournament.status === e_tournament_status_enum.Finished
            "
            value="results"
          >
            {{ $t("tournament.results.title") }}
          </TabsTrigger>
          <TabsTrigger v-if="tournament?.is_organizer" value="match-options">
            Match Options
          </TabsTrigger>
          <TabsTrigger v-if="tournament?.is_organizer" value="organizers">
            Organizers
          </TabsTrigger>
        </TabsList>

        <!-- Combined Admin Actions Dropdown - Next to Organizers tab -->
        <DropdownMenu v-if="tournament?.is_organizer">
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              :title="$t('tournament.settings')"
              class="hover:bg-accent shrink-0"
            >
              <Settings class="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56" align="end">
            <DropdownMenuItem
              v-if="tournament.can_open_registration"
              @click="openRegistration"
              class="cursor-pointer"
            >
              <Unlock class="mr-2 h-4 w-4" />
              <span>{{ $t("tournament.actions.open_registration") }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="tournament.can_close_registration"
              @click="closeRegistration"
              class="cursor-pointer"
            >
              <Lock class="mr-2 h-4 w-4" />
              <span>{{ $t("tournament.actions.close_registration") }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              v-if="tournament.can_start"
              @click="startTournament"
              class="cursor-pointer"
            >
              <Play class="mr-2 h-4 w-4" />
              <span>{{ $t("tournament.actions.start") }}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator
              v-if="
                (tournament.can_open_registration ||
                  tournament.can_close_registration ||
                  tournament.can_start) &&
                (tournament.can_cancel || tournament.is_organizer)
              "
            />

            <DropdownMenuItem
              v-if="tournament.can_cancel"
              @click="cancelTournament"
              class="text-destructive cursor-pointer"
            >
              <Ban class="mr-2 h-4 w-4" />
              <span>{{ $t("tournament.actions.cancel") }}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator
              v-if="tournament.can_cancel && tournament.is_organizer"
            />

            <DropdownMenuItem
              v-if="tournament.is_organizer"
              @click="deleteDialogOpen = true"
              class="text-destructive cursor-pointer"
            >
              <Trash class="mr-2 h-4 w-4" />
              <span>{{ $t("tournament.actions.delete") }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        class="bg-muted/40 rounded-xl px-6 py-4 mt-2 mb-6 shadow-sm border border-border"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
        >
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-3 min-w-0">
              <h1 class="truncate text-2xl sm:text-3xl font-bold leading-tight">
                {{ tournament.name }}
              </h1>
            </div>
            <!-- Tournament Type Badge and Stage Info -->
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                class="text-xs font-semibold h-6 flex items-center shrink-0 w-fit"
              >
                {{ tournament.options.type }}: {{ tournamentTypeDescription }}
              </Badge>
              <Badge
                v-if="stageCount > 1"
                variant="outline"
                class="text-xs font-semibold h-6 flex items-center shrink-0 w-fit"
              >
                {{ stageCount }} {{ $t("tournament.stage.stages") }}
              </Badge>
              <Badge
                v-if="singleStageType"
                variant="outline"
                class="text-xs font-semibold h-6 flex items-center shrink-0 w-fit"
              >
                {{ singleStageType }}
              </Badge>
            </div>
          </div>

          <div class="flex flex-col items-end gap-2 flex-shrink-0 sm:pt-1">
            <!-- Status Badge and Join Button -->
            <div class="flex flex-wrap items-center gap-2 justify-end">
              <Badge
                v-if="tournament"
                class="text-sm font-semibold h-7 px-3 flex items-center shrink-0 hover:bg-primary"
              >
                {{ tournament.e_tournament_status.description }}
              </Badge>
              <Button
                v-if="
                  tournament.status ===
                    e_tournament_status_enum.RegistrationOpen &&
                  tournament.can_join
                "
                size="sm"
                class="h-7 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold text-sm border-0 hover:scale-105 active:scale-95"
                @click="handleJoinTournament"
              >
                <UserPlus class="h-3.5 w-3.5 mr-1.5" />
                {{ $t("tournament.join.title") }}
              </Button>
            </div>
            <!-- Date/Time Info -->
            <div
              class="flex items-center gap-2 justify-end text-xs text-muted-foreground"
            >
              <TimeAgo :date="tournament.start" />
            </div>
          </div>
        </div>

        <!-- Collapsible Description and Overview -->
        <Collapsible v-model:open="overviewExpanded" class="mt-2">
          <div v-if="tournament.description" class="w-full">
            <CollapsibleTrigger as-child>
              <Button
                variant="ghost"
                class="w-full justify-between p-0 h-auto hover:bg-transparent text-left text-sm text-muted-foreground hover:text-foreground"
              >
                <span
                  :class="{ 'line-clamp-2': !overviewExpanded }"
                  class="flex-1 break-words text-wrap pr-2"
                  style="word-wrap: break-word; overflow-wrap: break-word"
                >
                  {{ tournament.description }}
                </span>
                <ChevronDown
                  class="h-3 w-3 transition-transform duration-200 shrink-0"
                  :class="{ 'rotate-180': overviewExpanded }"
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div class="mt-2 pt-3 border-t border-border space-y-6">
              <!-- Match Options -->
              <MatchOptionsDisplay
                :show-details-by-default="false"
                :options="tournament.options"
              ></MatchOptionsDisplay>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Organized By - Bottom Right -->
        <div
          class="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-border"
        >
          <span class="text-xs text-muted-foreground">{{
            $t("tournament.organizer.organized_by")
          }}</span>
          <template
            v-for="(organizer, index) in organizersList"
            :key="organizer.steam_id"
          >
            <Popover v-model:open="organizerPopoversOpen[index]">
              <PopoverTrigger as-child>
                <button
                  class="relative group"
                  @mouseenter="organizerPopoversOpen[index] = true"
                  @mouseleave="organizerPopoversOpen[index] = false"
                >
                  <Avatar
                    shape="square"
                    class="h-7 w-7 border-2 border-background cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <AvatarImage
                      :src="organizer.avatar_url"
                      :alt="organizer.name"
                      v-if="organizer?.avatar_url"
                    />
                    <AvatarFallback class="text-xs">
                      {{ organizer?.name.slice(0, 2) }}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              <PopoverContent
                class="w-64 p-0"
                @mouseenter="organizerPopoversOpen[index] = true"
                @mouseleave="organizerPopoversOpen[index] = false"
              >
                <div class="p-4">
                  <PlayerDisplay
                    :player="organizer"
                    :linkable="true"
                    :tooltip="false"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </template>
        </div>
      </div>

      <TabsContent value="overview">
        <div class="space-y-6">
          <!-- Show results table if tournament is finished -->
          <template
            v-if="tournament.status === e_tournament_status_enum.Finished"
          >
            <TournamentResults :tournament="tournament" :show-matches="false" />
            <Separator class="my-4" />
          </template>

          <!-- Full-width Bracket -->
          <TournamentStageBuilder
            class="w-full"
            :tournament="tournament"
          ></TournamentStageBuilder>
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
      <TabsContent
        v-if="
          tournament.status === e_tournament_status_enum.Live ||
          tournament.status === e_tournament_status_enum.Finished
        "
        value="results"
      >
        <TournamentResults :tournament="tournament" />
      </TabsContent>
      <TabsContent value="match-options" v-if="tournament?.is_organizer">
        <Card class="p-6">
          <TournamentForm :tournament="tournament"></TournamentForm>
        </Card>
      </TabsContent>
      <TabsContent value="organizers" v-if="tournament?.is_organizer">
        <TournamentOrganizers :tournament="tournament"></TournamentOrganizers>
      </TabsContent>
    </Tabs>

    <!-- Join Tournament Sheet - Available for all tabs -->
    <Sheet
      :open="joinSheetOpen"
      @update:open="(open) => (joinSheetOpen = open)"
    >
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle class="text-2xl">
            {{ $t("tournament.join.title") }}
          </SheetTitle>
          <SheetDescription>
            {{
              $t("tournament.join.requirements", {
                count: tournament.min_players_per_lineup,
              })
            }}
          </SheetDescription>
        </SheetHeader>

        <div class="mt-6">
          <TournamentJoinForm
            :tournament="tournament"
            @close="joinSheetOpen = false"
          />
        </div>
      </SheetContent>
    </Sheet>

    <!-- Delete Tournament Dialog -->
    <AlertDialog
      :open="deleteDialogOpen"
      @update:open="(open) => (deleteDialogOpen = open)"
    >
      <AlertDialogTrigger class="w-full"> </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("tournament.actions.confirm_delete")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("tournament.actions.delete_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction
            @click="deleteTournament"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {{ $t("tournament.actions.delete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script lang="ts">
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";
import tournamentTeamFields from "~/graphql/tournamentTeamFields";
import { mapFields } from "~/graphql/mapGraphql";
import { playerFields } from "~/graphql/playerFields";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";

export default {
  data() {
    return {
      myTeam: undefined,
      tournament: undefined,
      tournamentDialog: false,
      teamSearchQuery: undefined,
      settingsDialogOpen: false,
      organizersDialogOpen: false,
      joinSheetOpen: false,
      overviewExpanded: true,
      deleteDialogOpen: false,
      organizerPopoversOpen: {},
      activeTab: "overview",
      e_match_types: [],
    };
  },
  apollo: {
    e_match_types: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        e_match_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
      result({
        data,
      }: {
        data: { e_match_types: Array<{ value: string; description: string }> };
      }) {
        this.e_match_types = data.e_match_types;
      },
    },
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
              can_start: true,
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
                check_in_setting: true,
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
                  results: [
                    {},
                    {
                      wins: true,
                      losses: true,
                      rounds_won: true,
                      rounds_lost: true,
                      matches_played: true,
                      matches_remaining: true,
                      team: {
                        name: true,
                      },
                    },
                  ],
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
                        ended_at: true,
                        e_match_status: {
                          description: true,
                        },
                        winning_lineup_id: true,
                        lineup_1_id: true,
                        lineup_2_id: true,
                        created_at: true,
                        started_at: true,
                        scheduled_at: true,
                        options: {
                          mr: true,
                          best_of: true,
                          type: true,
                          lobby_access: true,
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
                            map: mapFields,
                            lineup_1_score: true,
                            lineup_2_score: true,
                            winning_lineup_id: true,
                            order: true,
                            status: true,
                            vetos: {
                              side: true,
                              type: true,
                              match_lineup_id: true,
                            },
                          },
                        ],
                        lineup_1: {
                          id: true,
                          name: true,
                          is_on_lineup: true,
                          team_id: true,
                          lineup_players: [
                            {},
                            {
                              checked_in: true,
                              placeholder_name: true,
                              player: playerFields,
                            },
                          ],
                        },
                        lineup_2: {
                          id: true,
                          name: true,
                          is_on_lineup: true,
                          team_id: true,
                          lineup_players: [
                            {},
                            {
                              checked_in: true,
                              placeholder_name: true,
                              player: playerFields,
                            },
                          ],
                        },
                        max_players_per_lineup: true,
                        min_players_per_lineup: true,
                        lineup_counts: [{}, true],
                        streams: [
                          {
                            order_by: [
                              {
                                priority: order_by.asc,
                              },
                            ],
                          },
                          {
                            id: true,
                            link: true,
                            title: true,
                            priority: true,
                          },
                        ],
                        elo_changes: [
                          {},
                          {
                            player_steam_id: true,
                            elo_change: true,
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
            steam_id: this.me?.steam_id,
            tournamentId: this.$route.params.tournamentId,
          };
        },
        skip: function () {
          return !this.me?.steam_id;
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
    tournamentTypeDescription() {
      if (!this.tournament?.options?.type || !this.e_match_types) {
        return this.tournament?.options?.type || "";
      }
      const matchType = this.e_match_types.find(
        (type) => type.value === this.tournament.options.type,
      );
      return matchType?.description || this.tournament.options.type;
    },
    organizersList() {
      if (!this.tournament) return [];
      const list = [];
      if (this.tournament.admin) {
        list.push(this.tournament.admin);
      }
      if (this.tournament.organizers) {
        this.tournament.organizers.forEach((item) => {
          if (item.organizer) {
            list.push(item.organizer);
          }
        });
      }
      return list;
    },
    stageCount() {
      return this.tournament?.stages?.length || 0;
    },
    singleStageType() {
      if (
        this.stageCount === 1 &&
        this.tournament?.stages?.[0]?.e_tournament_stage_type
      ) {
        return this.tournament.stages[0].e_tournament_stage_type.description;
      }
      return null;
    },
    e_tournament_status_enum() {
      return e_tournament_status_enum;
    },
  },
  methods: {
    openSettingsDialog() {
      this.settingsDialogOpen = true;
    },
    openOrganizersDialog() {
      this.organizersDialogOpen = true;
    },
    handleJoinTournament() {
      if (!this.me) {
        this.$router.push({
          path: "/login",
          query: { redirect: this.$route.fullPath },
        });
        return;
      }
      this.joinSheetOpen = true;
    },
    async cancelTournament() {
      await this.updateTournamentStatus(e_tournament_status_enum.Cancelled);
    },
    async startTournament() {
      await this.updateTournamentStatus(e_tournament_status_enum.Live);
    },
    async openRegistration() {
      await this.updateTournamentStatus(
        e_tournament_status_enum.RegistrationOpen,
      );
    },
    async closeRegistration() {
      await this.updateTournamentStatus(
        e_tournament_status_enum.RegistrationClosed,
      );
    },
    async updateTournamentStatus(status) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_tournaments_by_pk: [
            {
              pk_columns: {
                id: this.tournament.id,
              },
              _set: {
                status,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async deleteTournament() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournaments_by_pk: [
            {
              id: this.tournament.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
      this.deleteDialogOpen = false;
      // Redirect to tournaments list
      this.$router.push({ name: "tournaments" });
    },
  },
  watch: {
    tournament: {
      handler(newTournament) {
        if (newTournament) {
          // Collapse overview by default when tournament is Live, expand otherwise
          this.overviewExpanded =
            newTournament.status !== e_tournament_status_enum.Live;
        }
      },
      immediate: true,
    },
    organizersList: {
      handler(newList) {
        // Initialize organizer popovers state based on the combined list
        if (newList && newList.length > 0) {
          this.organizerPopoversOpen = newList.reduce((acc, _, index) => {
            acc[index] = false;
            return acc;
          }, {});
        }
      },
      immediate: true,
    },
    activeTab: {
      handler(newTab) {
        // Collapse overview when on match-options or organizers tabs
        if (newTab === "match-options" || newTab === "organizers") {
          this.overviewExpanded = false;
        } else if (newTab === "overview") {
          // Expand overview when switching back to overview tab
          // unless tournament is Live
          if (this.tournament) {
            this.overviewExpanded =
              this.tournament.status !== e_tournament_status_enum.Live;
          }
        }
      },
    },
  },
};
</script>
