<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormItem, FormControl, Form } from "@/components/ui/form";
import { Button } from "~/components/ui/button";
import TeamsTable from "~/components/TeamsTable.vue";
import PageHeading from "~/components/PageHeading.vue";
import { PlusCircle } from "lucide-vue-next";
import Pagination from "@/components/Pagination.vue";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("pages.teams.title") }}</template>
      <template #description>{{ $t("pages.teams.description") }}</template>
      <template #actions>
        <NuxtLink :to="{ name: 'teams-create' }">
          <Button size="lg">
            <PlusCircle class="w-4 h-4" />
            <span class="hidden md:inline ml-2">{{
              $t("pages.teams.create")
            }}</span>
          </Button>
        </NuxtLink>
      </template>
    </PageHeading>

    <Card class="p-4">
      <Tabs default-value="my-teams">
        <TabsList>
          <TabsTrigger value="my-teams">{{
            $t("pages.teams.tabs.my_teams")
          }}</TabsTrigger>
          <TabsTrigger value="teams">{{
            $t("pages.teams.tabs.other_teams")
          }}</TabsTrigger>
        </TabsList>

        <TabsContent value="teams">
          <form class="flex justify-end" @submit.prevent="viewTopTeam">
            <FormField v-slot="{ componentField }" name="teamQuery">
              <FormItem>
                <FormControl>
                  <div class="relative w-full max-w-sm">
                    <Input
                      type="text"
                      :placeholder="$t('pages.teams.search')"
                      class="pl-10"
                      v-bind="componentField"
                    />
                    <Search
                      class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5"
                    />
                  </div>
                </FormControl>
              </FormItem>
            </FormField>
          </form>

          <teams-table :teams="teams" v-if="teams"></teams-table>
          <Teleport defer to="#pagination">
            <pagination
              :page="page"
              :per-page="perPage"
              @page="
                (_page) => {
                  page = _page;
                }
              "
              :total="teams_aggregate.aggregate.count"
              v-if="teams_aggregate"
            ></pagination>
          </Teleport>
        </TabsContent>
        <TabsContent value="my-teams">
          <teams-table :teams="myTeams" v-if="myTeams"></teams-table>
        </TabsContent>
      </Tabs>
    </Card>

    <div id="pagination"></div>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $, order_by } from "~/generated/zeus";
import { useAuthStore } from "#imports";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      myTeams: undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            teamQuery: z.string(),
          }),
        ),
      }),
    };
  },
  watch: {
    "form.values.teamQuery": {
      immediate: true,
      handler() {
        this.page = 1;
      },
    },
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
              ...(this.form.values.teamQuery?.length >= 3 && {
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
          teamQuery: `%${this.form.values.teamQuery}%`,
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
  methods: {
    viewTopTeam() {
      const team = this.teams?.at(0);
      if (!team) {
        return;
      }

      this.$router.push(`/teams/${team.id}`);
    },
  },
};
</script>
