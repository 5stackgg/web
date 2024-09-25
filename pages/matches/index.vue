<script setup lang="ts">
import { Button } from "@/components/ui/button";
import MyUpcomingMatches from "~/components/MyUpcomingMatches.vue";
import Pagination from "~/components/Pagination.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MatchesTable from "~/components/MatchesTable.vue";
import MatchMaking from "~/components/match-making/MatchMaking.vue";
import { PlusCircle } from "lucide-vue-next";
import PageHeading from "~/components/PageHeading.vue";
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-4">
    <div class="lg:w-3/4 flex flex-col gap-4 overflow-hidden">
      <PageHeading>
        <template #title> Upcoming Matches </template>

        <template #description>
          Your upcoming matches that either you manage or are in the lineup.
        </template>

        <template #actions>
          <NuxtLink to="/matches/create" class="flex gap-4 items-center">
            <template v-if="!canCreateMatch">
              <FiveStackToolTip :size=16 class="text-red-600">Admin is disabled creation of matches</FiveStackToolTip>
            </template>
            <Button size="lg" :disabled="!canCreateMatch">
              <PlusCircle class="w-4 h-4" />
              <span class="hidden md:inline ml-2">Create Match</span>
            </Button>
          </NuxtLink>
        </template>
      </PageHeading>

      <MyUpcomingMatches></MyUpcomingMatches>

      <Separator />

      <Card class="p-4">
        <Tabs default-value="my">
          <TabsList>
            <TabsTrigger value="my"> My Recent Matches </TabsTrigger>
            <TabsTrigger value="other"> Other Matches </TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            <div class="flex gap-4 overflow-x-auto">
              <SimpleMatchDisplay
                :match="match"
                v-for="match of matches"
                :key="match.id"
                class="flex-shrink-0"
                v-if="matches?.length > 0"
              ></SimpleMatchDisplay>
              <template v-else>
                <div class="text-center w-full p-4">
                  <p class="text-muted-foreground">
                    You don't have any recent matches.
                  </p>
                </div>
              </template>
            </div>
          </TabsContent>
          <TabsContent value="other">
            <matches-table
              class="p-3"
              :matches="otherMatches"
              v-if="otherMatches"
            ></matches-table>

            <Teleport defer to="#pagination">
              <Pagination
                :page="page"
                :per-page="perPage"
                @page="
                  (_page) => {
                    page = _page;
                  }
                "
                :total="otherMatchesAggregate?.aggregate?.count"
                v-if="otherMatchesAggregate"
              ></Pagination>
            </Teleport>
          </TabsContent>
        </Tabs>
      </Card>

      <div id="pagination"></div>
    </div>

    <div class="hidden lg:w-1/4 lg:block">
      <Card
        class="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900"
      >
        <CardHeader>
          <CardTitle class="text-xl font-bold text-center">
            Match Making
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="relative">
            <div
              class="absolute -inset-1 bg-gradient-to-r from-pink-400 to-purple-400 rounded-lg blur opacity-15 group-hover:opacity-25 transition duration-1000 group-hover:duration-200 pointer-events-none"
            ></div>
            <MatchMaking class="w-full"></MatchMaking>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { $, e_match_status_enum, e_player_roles_enum, order_by } from "~/generated/zeus";
import SimpleMatchDisplay from "~/components/SimpleMatchDisplay.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
    };
  },
  apollo: {
    matches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        matches: [
          {
            limit: 10,
            where: {
              is_in_lineup: {
                _eq: true,
              },
              status: {
                _nin: $("statuses", "[e_match_status_enum]"),
              },
            },
            order_by: [
              {},
              {
                created_at: order_by.desc,
              },
            ],
          },
          simpleMatchFields,
        ],
      }),
      variables: function () {
        return {
          statuses: [
            e_match_status_enum.Live,
            e_match_status_enum.Veto,
            e_match_status_enum.Scheduled,
            e_match_status_enum.PickingPlayers,
            e_match_status_enum.WaitingForCheckIn,
          ],
        };
      },
    },
    otherMatches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          otherMatches: {
            matches: [
              {
                limit: $("limit", "Int!"),
                offset: $("offset", "Int!"),
                where: {
                  status: {
                    _nin: $("statuses", "[e_match_status_enum]"),
                  },
                },
                order_by: [
                  {},
                  {
                    created_at: order_by.desc,
                  },
                ],
              },
              simpleMatchFields,
            ],
          },
        },
      }),
      variables: function () {
        return {
          limit: this.perPage,
          offset: (this.page - 1) * this.perPage,
          statuses: [e_match_status_enum.PickingPlayers],
        };
      },
    },
    otherMatchesAggregate: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          otherMatchesAggregate: {
            matches_aggregate: [
              {
                where: {
                  status: {
                    _nin: $("statuses", "[e_match_status_enum]"),
                  },
                },
              },
              {
                aggregate: {
                  count: true,
                },
              },
            ],
          },
        },
      }),
      variables: function () {
        return {
          statuses: [e_match_status_enum.PickingPlayers],
        };
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canCreateMatch() {
      const allowedRole = useApplicationSettingsStore().matchCreateRole;

      if(allowedRole === e_player_roles_enum.user) {
        return true;
      }

      if(allowedRole === e_player_roles_enum.match_organizer) {
        return [
        e_player_roles_enum.match_organizer,
        e_player_roles_enum.tournament_organizer,
        e_player_roles_enum.administrator,
        ].includes(this.me.role);
      }


      if(allowedRole === e_player_roles_enum.tournament_organizer) {
        return [
        e_player_roles_enum.tournament_organizer,
        e_player_roles_enum.administrator,
        ].includes(this.me.role);
      }

      if(allowedRole === e_player_roles_enum.administrator) {
        return this.me.role ===  e_player_roles_enum.administrator
      }

      return false;
    }
  }
};
</script>
