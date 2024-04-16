<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormItem, FormControl, FormLabel, Form } from "@/components/ui/form";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <div class="space-y-0.5">
    <h2 class="text-2xl font-bold tracking-tight">
      Teams
      <NuxtLink to="/teams/create">
        <Button>Create Team</Button>
      </NuxtLink>
    </h2>
    <p class="text-muted-foreground">Manage teams and rosters.</p>
  </div>
  <Separator class="my-6" />

  <Tabs default-value="my-teams" class="w-[400px]">
    <TabsList>
      <TabsTrigger value="my-teams"> my teams </TabsTrigger>
      <TabsTrigger value="teams"> teams </TabsTrigger>
    </TabsList>
    <TabsContent value="teams">
      <Form @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="username">
          <FormItem>
            <FormLabel>Username</FormLabel>
            <FormControl>
              <div class="relative w-full max-w-sm items-center">
                <Input
                  type="text"
                  placeholder="Search..."
                  v-model="teamQuery"
                  class="pl-10"
                ></Input>
                <span
                  class="absolute start-0 inset-y-0 flex items-center justify-center px-2"
                >
                  <Search class="size-6 text-muted-foreground" />
                </span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </Form>

      <teams-table :teams="teams" v-if="teams"></teams-table>
      <pagination
        :page="page"
        :per-page="perPage"
        @page="
          (_page) => {
            page = _page;
          }
        "
        :total="Math.ceil(teams_aggregate.aggregate.count / perPage)"
        v-if="teams_aggregate"
      ></pagination>
    </TabsContent>
    <TabsContent value="my-teams">
      <teams-table :teams="myTeams" v-if="myTeams"></teams-table>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $, order_by } from "~/generated/zeus";
import { useAuthStore } from "#imports";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
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
          limit: this.perPage,
          offset: (this.page - 1) * this.perPage,
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
