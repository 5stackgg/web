<template>
  <NuxtLink to="/teams/create">
    <five-stack-button>Create Team</five-stack-button>
  </NuxtLink>

  <tabs>
    <tab title="Teams">
      <form @submit.prevent>
        <five-stack-text-input
          label="Filter Teams"
          v-model="teamQuery"
        ></five-stack-text-input>
      </form>
      <teams-table :teams="teams" v-if="teams"></teams-table>
      <pagination
        :per-page="10"
        :offset="teamsOffset"
        @offset="
          (offset) => {
            teamsOffset = offset;
          }
        "
        :total="teams_aggregate.aggregate.count"
        v-if="teams_aggregate"
      ></pagination>
    </tab>
    <tab title="My Teams">
      <teams-table
        :teams="meWithTeams.player.teams"
        v-if="meWithTeams"
      ></teams-table>
      <pagination
        :per-page="10"
        :offset="myTeamsOffset"
        @offset="
          (offset) => {
            myTeamsOffset = offset;
          }
        "
        :total="my_teams_aggregate.aggregate.count"
        v-if="my_teams_aggregate"
      ></pagination>
    </tab>
  </tabs>
</template>
<script setup lang="ts">
import FiveStackButton from "~/components/FiveStackButton.vue";
import TeamsTable from "~/components/TeamsTable.vue";
import Tab from "~/components/tabs/Tab.vue";
import FiveStackTextInput from "~/components/forms/FiveStackTextInput.vue";
</script>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $, order_by } from "~/generated/zeus";
import { useAuthStore } from "#imports";

export default {
  data() {
    return {
      teamsOffset: 0,
      myTeamsOffset: 0,
      teamQuery: undefined,
    };
  },
  apollo: {
    teams: {
      fetchPolicy: "network-only",
      query: function () {
        return generateQuery({
          teams: [
            {
              limit: 10,
              offset: $("offset", "Int!"),
              order_by: [
                {},
                {
                  name: order_by.asc,
                },
              ],
              ...(this.teamQuery?.length >= 3 && {
                where: {
                  name: {
                    _ilike: $("teamQuery", "String"),
                  },
                },
              }),
            },
            {
              id: true,
              name: true,
            },
          ],
        });
      },
      variables: function () {
        return {
          offset: this.teamsOffset,
          teamQuery: `%${this.teamQuery}%`,
        };
      },
    },
    teams_aggregate: {
      fetchPolicy: "network-only",
      query: generateQuery({
        teams_aggregate: [
          {},
          {
            aggregate: {
              count: true,
            },
          },
        ],
      }),
    },
    meWithTeams: {
      fetchPolicy: "network-only",
      query: function () {
        return generateQuery({
          __alias: {
            meWithTeams: {
              me: {
                player: {
                  teams: [
                    {
                      limit: 10,
                      offset: $("offset", "Int!"),
                      order_by: [
                        {},
                        {
                          name: order_by.asc,
                        },
                      ],
                      ...(this.teamQuery?.length >= 3 && {
                        where: {
                          name: {
                            _ilike: $("teamQuery", "String"),
                          },
                        },
                      }),
                    },
                    {
                      id: true,
                      name: true,
                    },
                  ],
                },
              },
            },
          },
        });
      },
      variables: function () {
        return {
          offset: this.myTeamsOffset,
          teamQuery: `%${this.teamQuery}%`,
        };
      },
    },
    my_teams_aggregate: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          my_teams_aggregate: {
            team_roster_aggregate: [
              {
                where: {
                  player_steam_id: {
                    _eq: $("steam_id", "bigint!"),
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
          steam_id: useAuthStore().me.steam_id,
        };
      },
    },
  },
};
</script>
