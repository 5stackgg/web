<template>
  <NuxtLink to="/matches/create">
    <five-stack-button>Create Match</five-stack-button>
  </NuxtLink>

  <tabs>
    <tab title="My Matches">
      <my-matches></my-matches>
    </tab>
    <tab title="Matches">
      <matches-table :matches="matches" v-if="matches"></matches-table>
      <pagination
        :page="page"
        @page="
          (_page) => {
            page = _page;
          }
        "
        :total="Math.ceil(matches_aggregate.aggregate.count / per_page)"
        v-if="matches_aggregate"
      ></pagination>
    </tab>
  </tabs>
</template>
<script setup lang="ts">
import FiveStackButton from "~/components/FiveStackButton.vue";
import MyMatches from "~/components/MyMatches.vue";
import Tab from "~/components/tabs/Tab.vue";
</script>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { matchFields } from "~/graphql/matchesGraphql";
import { $, order_by } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      per_page: 10,
    };
  },
  apollo: {
    matches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        matches: [
          {
            limit: $("limit", "Int!"),
            offset: $("offset", "Int!"),
            order_by: [
              {},
              {
                created_at: order_by.desc,
              },
            ],
          },
          matchFields,
        ],
      }),
      variables: function () {
        return {
          limit: this.per_page,
          offset: (this.page - 1) * this.per_page,
        };
      },
    },
    matches_aggregate: {
      fetchPolicy: "network-only",
      query: generateQuery({
        matches_aggregate: [
          {},
          {
            aggregate: {
              count: [{}, true],
            },
          },
        ],
      }),
    },
  },
};
</script>
