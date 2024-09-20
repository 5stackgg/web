<script setup lang="ts">
import { Button } from "@/components/ui/button";
import MyMatches from "~/components/MyMatches.vue";
import Pagination from "~/components/Pagination.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MatchesTable from "~/components/MatchesTable.vue";
import MatchMaking from "~/components/match-making/MatchMaking.vue";
import { PlusCircle } from "lucide-vue-next";
</script>

<template>
  <div class="flex flex-col md:flex-row gap-4">
    <div class="flex-grow flex flex-col gap-4">
      <div class="space-y-0.5 flex justify-between items-start items-center">
        <div>
          <h2 class="text-2xl font-bold tracking-tight">Upcoming Matches</h2>
          <p class="text-muted-foreground">
            Your upcoming matches that either you manage or are in the lineup.
          </p>
        </div>

        <NuxtLink to="/matches/create">
          <Button size="lg">
            <PlusCircle class="w-4 h-4" />
            <span class="hidden md:inline ml-2">Create Match</span>
          </Button>
        </NuxtLink>
      </div>
      <my-matches :upcoming="true"></my-matches>

      <Separator />

      <Card class="p-4">
        <Tabs default-value="my">
          <TabsList>
            <TabsTrigger value="my"> My Matches </TabsTrigger>
            <TabsTrigger value="other"> Other Matches </TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            <my-matches></my-matches>
          </TabsContent>
          <TabsContent value="other">
            <matches-table
              class="p-3"
              :matches="matches"
              v-if="matches"
            ></matches-table>
          </TabsContent>
        </Tabs>
      </Card>

      <Pagination
        :page="page"
        :per-page="perPage"
        @page="
          (_page) => {
            page = _page;
          }
        "
        :total="matches_aggregate?.aggregate?.count"
        v-if="matches_aggregate"
      ></Pagination>
    </div>

    <div class="md:w-1/4 hidden lg:block">
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
