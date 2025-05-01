<script setup lang="ts">
import TournamentsTable from "~/components/TournamentsTable.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Button } from "~/components/ui/button";
import { PlusCircle } from "lucide-vue-next";
import MyUpcomingTournaments from "~/components/tournament/MyUpcomingTournaments.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import SimpleTournamentDisplay from "~/components/tournament/SimpleTournamentDisplay.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("pages.tournaments.title") }}</template>

      <template #actions>
        <div class="flex gap-4 items-center">
          <template v-if="!canCreateTournament">
            <FiveStackToolTip :size="16" class="text-red-600">{{
              $t("pages.tournaments.admin_disabled")
            }}</FiveStackToolTip>
          </template>
          <NuxtLink v-if="canCreateTournament" to="/tournaments/create">
            <Button size="lg">
              <PlusCircle class="w-4 h-4" />
              <span class="hidden md:inline ml-2">{{
                $t("pages.tournaments.create")
              }}</span>
            </Button>
          </NuxtLink>
          <Button v-else size="lg" disabled>
            <PlusCircle class="w-4 h-4" />
            <span class="hidden md:inline ml-2">{{
              $t("pages.tournaments.create")
            }}</span>
          </Button>
        </div>
      </template>
    </PageHeading>

    <MyUpcomingTournaments></MyUpcomingTournaments>

    <Separator></Separator>

    <Card class="p-4">
      <Tabs default-value="other">
        <TabsList>
          <TabsTrigger value="other">{{
            $t("pages.tournaments.tabs.tournaments")
          }}</TabsTrigger>
          <TabsTrigger value="my">{{
            $t("pages.tournaments.tabs.my_recent")
          }}</TabsTrigger>
        </TabsList>

        <TabsContent value="other">
          <TournamentsTable :tournaments="tournaments || []"></TournamentsTable>

          <Teleport defer to="#pagination">
            <pagination
              :page="page"
              :per-page="perPage"
              @page="
                (_page: number) => {
                  page = _page;
                }
              "
              :total="tournaments?.aggregate?.count"
            ></pagination>
          </Teleport>
        </TabsContent>

        <TabsContent value="my">
          <div class="flex gap-4 overflow-x-auto">
            <template v-if="myRecentTournaments?.length > 0">
              <SimpleTournamentDisplay
                :key="tournament.id"
                :tournament="tournament"
                class="flex-shrink-0"
                v-for="tournament of myRecentTournaments"
              ></SimpleTournamentDisplay>
            </template>
            <template v-else>
              <div class="text-center w-full p-4">
                <p class="text-muted-foreground">
                  {{ $t("pages.tournaments.no_recent") }}
                </p>
              </div>
            </template>
          </div>
        </TabsContent>
      </Tabs>
    </Card>

    <div id="pagination"></div>
  </div>
</template>

<script lang="ts">
import { mapFields } from "~/graphql/mapGraphql";
import { generateQuery } from "~/graphql/graphqlGen";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import { e_player_roles_enum } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
    };
  },
  apollo: {
    tournaments: {
      fetchPolicy: "network-only",
      query: function () {
        return generateQuery({
          tournaments: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: [
                {},
                {
                  name: order_by.asc,
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
              },
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
        });
      },
      variables: function () {
        return {
          limit: this.perPage,
          offset: (this.page - 1) * this.perPage,
        };
      },
    },
    tournaments_aggregate: {
      fetchPolicy: "network-only",
      query: generateQuery({
        tournaments_aggregate: [
          {},
          {
            aggregate: {
              count: true,
            },
          },
        ],
      }),
    },
    myRecentTournaments: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          myRecentTournaments: {
            tournaments: [
              {
                limit: 10,
                where: {
                  status: {
                    _in: $("statuses", "[e_tournament_status_enum]"),
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
          },
        },
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
  computed: {
    me() {
      return useAuthStore().me;
    },
    canCreateTournament() {
      const allowedRole = useApplicationSettingsStore().tournamentCreateRole;

      if (allowedRole === e_player_roles_enum.user) {
        return true;
      }

      if (allowedRole === e_player_roles_enum.verified_user) {
        return [
          e_player_roles_enum.verified_user,
          e_player_roles_enum.match_organizer,
          e_player_roles_enum.tournament_organizer,
          e_player_roles_enum.administrator,
        ].includes(this.me.role);
      }

      if (allowedRole === e_player_roles_enum.match_organizer) {
        return [
          e_player_roles_enum.match_organizer,
          e_player_roles_enum.tournament_organizer,
          e_player_roles_enum.administrator,
        ].includes(this.me.role);
      }

      if (allowedRole === e_player_roles_enum.tournament_organizer) {
        return [
          e_player_roles_enum.tournament_organizer,
          e_player_roles_enum.administrator,
        ].includes(this.me.role);
      }

      if (allowedRole === e_player_roles_enum.administrator) {
        return this.me.role === e_player_roles_enum.administrator;
      }

      return false;
    },
  },
};
</script>
