<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("pages.tournaments.title") }}</template>

      <template #actions>
        <div class="flex gap-4 items-center">
          <NuxtLink v-if="canCreateTournament" to="/tournaments/create">
            <Button :size="isMobile ? 'default' : 'lg'">
              <PlusCircle class="w-4 h-4" />
              <span class="hidden md:inline ml-2">{{
                $t("pages.tournaments.create")
              }}</span>
            </Button>
          </NuxtLink>
        </div>
      </template>
    </PageHeading>

    <MyUpcomingTournaments></MyUpcomingTournaments>

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
          <div
            v-if="!tournaments || tournaments.length === 0"
            class="text-center py-8"
          >
            <p class="text-muted-foreground">
              {{ $t("tournament.table.no_tournaments_found") }}
            </p>
          </div>
          <div v-else class="space-y-4">
            <TournamentTableRow
              v-for="tournament in tournaments"
              :key="tournament.id"
              :tournament="tournament"
              :e-match-types="eMatchTypes"
            ></TournamentTableRow>
          </div>

          <Teleport defer to="#pagination">
            <pagination
              :page="page"
              :items-per-page="perPage"
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
          <div
            v-if="!myRecentTournaments || myRecentTournaments.length === 0"
            class="text-center py-8"
          >
            <p class="text-muted-foreground">
              {{ $t("pages.tournaments.no_recent") }}
            </p>
          </div>
          <div v-else class="space-y-4">
            <TournamentTableRow
              v-for="tournament in myRecentTournaments"
              :key="tournament.id"
              :tournament="tournament"
              :e-match-types="eMatchTypes"
            ></TournamentTableRow>
          </div>
        </TabsContent>
      </Tabs>
    </Card>

    <div id="pagination"></div>
  </div>
</template>

<script lang="ts">
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Button } from "~/components/ui/button";
import { PlusCircle } from "lucide-vue-next";
import MyUpcomingTournaments from "~/components/tournament/MyUpcomingTournaments.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import SimpleTournamentDisplay from "~/components/tournament/SimpleTournamentDisplay.vue";
import { mapFields } from "~/graphql/mapGraphql";
import { generateQuery } from "~/graphql/graphqlGen";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import { useSidebar } from "~/components/ui/sidebar/utils";

export default {
  components: {
    TournamentTableRow,
    PageHeading,
    Button,
    PlusCircle,
    MyUpcomingTournaments,
    Separator,
    SimpleTournamentDisplay,
  },
  setup() {
    const { isMobile } = useSidebar();
    return { isMobile };
  },
  data() {
    return {
      page: 1,
      perPage: 10,
      eMatchTypes: [],
    };
  },
  apollo: {
    eMatchTypes: {
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
        this.eMatchTypes = data.e_match_types;
      },
    },
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
                  start: order_by.desc,
                },
              ],
            },
            {
              id: true,
              name: true,
              start: true,
              description: true,
              e_tournament_status: {
                description: true,
              },
              options: {
                type: true,
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
                description: true,
                e_tournament_status: {
                  description: true,
                },
                options: {
                  type: true,
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
      const me = useAuthStore().me;
      if (!me) {
        return false;
      }

      return useAuthStore().isRoleAbove(
        useApplicationSettingsStore().tournamentCreateRole,
      );
    },
  },
};
</script>
