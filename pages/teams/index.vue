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
        :page="page"
        @page="
          (_page) => {
            page = _page;
          }
        "
        :total="Math.ceil(teams_aggregate.aggregate.count / per_page)"
        v-if="teams_aggregate"
      ></pagination>
    </tab>
    <tab title="My Teams">
      <teams-table :teams="myTeams" v-if="myTeams"></teams-table>
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
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  data() {
    return {
      page: 1,
      per_page: 10,
      teamQuery: undefined,
      myTeams: undefined,
    };
  },
  apollo: {
    teams: {
      fetchPolicy: "network-only",
      query: function () {
        return generateQuery({
          teams: [
            {
              limit: $("limit", "Int!"),
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
          teamQuery: `%${this.teamQuery}%`,
          limit: this.per_page,
          offset: (this.page - 1) * this.per_page,
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
    $subscribe: {
      myTeams: {
        query: function () {
          return typedGql("subscription")({
            players: [
              {
                where: {
                  steam_id: {
                    _eq: useAuthStore().me.steam_id,
                  },
                },
              },
              {
                teams: [
                  {},
                  {
                    id: true,
                    name: true,
                  },
                ],
              },
            ],
          });
        },
        result: function ({ data }) {
          this.myTeams = data.players?.[0].teams;
        },
      },
    },
  },
};
</script>
