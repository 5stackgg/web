<script setup lang="ts">
import TournamentsTable from "~/components/TournamentsTable.vue";
import PageHeading from "~/components/PageHeading.vue";
</script>

<template>
  <PageHeading>
    Tournaments
    <template v-slot:description> Manage tournaments. </template>
  </PageHeading>
  <TournamentsTable
    :tournaments="tournaments"
    v-if="tournaments"
  ></TournamentsTable>
  <pagination
    :page="page"
    :per-page="perPage"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="Math.ceil(tournaments_aggregate.aggregate.count / perPage)"
    v-if="tournaments_aggregate"
  ></pagination>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $, order_by } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      teamQuery: undefined,
      mytournaments: undefined,
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
              type: true,
              start: true,
              status: true,
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ]
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
  },
};
</script>
