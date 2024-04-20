<script setup lang="ts">
import { Button } from "@/components/ui/button";
import MyMatches from "~/components/MyMatches.vue";
import Pagination from "~/components/Pagination.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "~/components/ui/separator";
import MatchesTable from "~/components/MatchesTable.vue";
import PageHeading from "~/components/PageHeading.vue";
</script>

<template>
  <PageHeading>
    Matches
    <NuxtLink to="/matches/create">
      <Button>Create Match</Button>
    </NuxtLink>

    <template v-slot:description>
      Manage and View upcoming matches that you are assigned to.
    </template>
  </PageHeading>

  <Separator class="my-6" />

  <Tabs default-value="my">
    <TabsList>
      <TabsTrigger value="my"> My Matches </TabsTrigger>
      <TabsTrigger value="other"> Other Matches </TabsTrigger>
    </TabsList>
    <TabsContent value="my">
      <my-matches></my-matches>
    </TabsContent>
    <TabsContent value="other">
      <matches-table :matches="matches" v-if="matches"></matches-table>
      <Pagination
        :page="page"
        :per-page="perPage"
        @page="
          (_page) => {
            page = _page;
          }
        "
        :total="Math.ceil(matches_aggregate.aggregate.count / perPage)"
        v-if="matches_aggregate"
      ></Pagination>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { matchFields } from "~/graphql/matchesGraphql";
import { $, order_by } from "~/generated/zeus";

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
          limit: this.perPage,
          offset: (this.page - 1) * this.perPage,
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
