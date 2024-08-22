<script setup lang="ts">
import TournamentsTable from "~/components/TournamentsTable.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Button } from "~/components/ui/button";
</script>

<template>
  <PageHeading>
    Game Server Nodes
    <NuxtLink to="/server-nodes/create">
      <Button>Create Game Server Node</Button>
    </NuxtLink>
  </PageHeading>

  <pre>{{ server_nodes }}</pre>

  <pagination
    :page="page"
    :per-page="perPage"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="server_nodes_aggregate.aggregate.count"
    v-if="server_nodes_aggregate"
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
    };
  },
  apollo: {
    server_nodes: {
      fetchPolicy: "network-only",
      query: function () {
        return generateQuery({
          server_nodes: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
            },
            {
              id: true,
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
    server_nodes_aggregate: {
      fetchPolicy: "network-only",
      query: generateQuery({
        server_nodes_aggregate: [
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
