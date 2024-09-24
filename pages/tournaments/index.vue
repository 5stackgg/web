<script setup lang="ts">
import TournamentsTable from "~/components/TournamentsTable.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Button } from "~/components/ui/button";
import { PlusCircle } from "lucide-vue-next";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>Tournaments</template>
      <template #description>Manage tournaments.</template>
      <template #actions>
        <NuxtLink to="/tournaments/create">
          <Button size="lg">
            <PlusCircle class="w-4 h-4 mr-2" />
            <span class="hidden md:inline">Create Tournament</span>
          </Button>
        </NuxtLink>
      </template>
    </PageHeading>

    <Card class="p-4">
      <TournamentsTable :tournaments="tournaments || []"></TournamentsTable>
    </Card>

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
  </div>
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
  },
};
</script>
