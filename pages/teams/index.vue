<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { FormItem, FormControl } from "@/components/ui/form";
import { Button } from "~/components/ui/button";
import TeamsTable from "~/components/TeamsTable.vue";
import PageHeading from "~/components/PageHeading.vue";
import { PlusCircle } from "lucide-vue-next";
import Pagination from "@/components/Pagination.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";

const { isMobile } = useSidebar();
</script>

<template>
  <PageTransition>
    <PageHeading>
      <template #title>{{ $t("pages.teams.title") }}</template>
      <template #description>{{ $t("pages.teams.description") }}</template>
      <template #actions>
        <NuxtLink v-if="me" :to="{ name: 'teams-create' }">
          <Button :size="isMobile ? 'default' : 'lg'">
            <PlusCircle class="w-4 h-4" />
            <span class="hidden md:inline ml-2">{{
              $t("pages.teams.create")
            }}</span>
          </Button>
        </NuxtLink>
      </template>
    </PageHeading>
  </PageTransition>

  <!-- Filters -->
  <PageTransition :delay="100" class="mt-6">
    <div
      class="flex flex-col md:flex-row gap-4 mb-4 items-center justify-between"
    >
      <form class="flex-1" @submit.prevent="viewTopTeam">
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
      <div
        v-if="me"
        class="flex items-center space-x-2 cursor-pointer"
        @click="showOnlyMyTeams = !showOnlyMyTeams"
      >
        <Switch :model-value="showOnlyMyTeams" />
        <Label class="text-sm cursor-pointer">
          {{ $t("team.search.my_teams_only") }}
        </Label>
      </div>
    </div>
  </PageTransition>

  <!-- Results -->
  <PageTransition :delay="200" class="mt-2">
    <div>
      <div class="p-4">
        <!-- Loading -->
        <div
          v-if="loading"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div
            v-for="i in perPage"
            :key="i"
            class="bg-muted/30 p-4 rounded-lg space-y-3"
          >
            <Skeleton class="h-5 w-32" />
            <div class="flex flex-col gap-2">
              <Skeleton v-for="j in 5" :key="j" class="h-5 w-full" />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <Empty
          v-else-if="
            !(showOnlyMyTeams ? myTeams : teams) ||
            (showOnlyMyTeams ? myTeams : teams).length === 0
          "
          class="min-h-[200px]"
        >
          <EmptyTitle>{{ $t("pages.teams.no_teams_title") }}</EmptyTitle>
          <EmptyDescription>{{ $t("pages.teams.no_teams") }}</EmptyDescription>
        </Empty>

        <!-- Teams Table -->
        <teams-table
          v-else
          :teams="showOnlyMyTeams ? myTeams : teams"
        ></teams-table>
      </div>

      <!-- Pagination -->
      <Pagination
        v-if="
          !showOnlyMyTeams &&
          teams_aggregate &&
          teams_aggregate.aggregate.count > 0
        "
        :page="page"
        :per-page="perPage"
        :total="teams_aggregate.aggregate.count"
        :show-per-page-selector="true"
        @page="onPageChange"
        @update:perPage="onPerPageChange"
      />
    </div>
  </PageTransition>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $, order_by } from "~/generated/zeus";
import { useAuthStore } from "#imports";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useForm } from "vee-validate";
import { playerFields } from "~/graphql/playerFields";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      // Provide initial shapes so template type inference knows these exist
      teams: undefined as any,
      teams_aggregate: undefined as any,
      myTeams: undefined as any,
      showOnlyMyTeams: false,
      loading: true,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            teamQuery: z.string(),
          }),
        ),
      }),
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
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
      result: function () {
        this.loading = false;
      },
      query: function (this: any) {
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
              ...(this.form.values.teamQuery?.length >= 3
                ? {
                    where: {
                      name: {
                        _ilike: $("teamQuery", "String"),
                      },
                    },
                  }
                : {}),
            },
            {
              id: true,
              name: true,
              roster: [
                {},
                {
                  player: playerFields,
                },
              ],
            },
          ],
        });
      },
      variables: function (this: any): Record<string, any> {
        return {
          teamQuery: `%${this.form.values.teamQuery}%`,
          limit: this.perPage,
          offset: (this.page - 1) * this.perPage,
        };
      },
    },
    teams_aggregate: {
      fetchPolicy: "network-only",
      query: function (this: any) {
        return generateQuery({
          teams_aggregate: [
            {
              ...(this.form.values.teamQuery?.length >= 3
                ? {
                    where: {
                      name: {
                        _ilike: $("teamQuery", "String"),
                      },
                    },
                  }
                : {}),
            },
            {
              aggregate: {
                count: [{}, true],
              },
            },
          ],
        });
      },
      variables: function (this: any): Record<string, any> {
        return {
          teamQuery: `%${this.form.values.teamQuery}%`,
        };
      },
    },
    $subscribe: {
      myTeams: {
        query: function () {
          return typedGql("subscription")({
            players: [
              {
                where: {
                  steam_id: {
                    _eq: useAuthStore().me?.steam_id,
                  },
                },
              },
              {
                teams: [
                  {},
                  {
                    id: true,
                    name: true,
                    roster: [
                      {},
                      {
                        player: playerFields,
                      },
                    ],
                  },
                ],
              },
            ],
          });
        },
        skip: function () {
          return !useAuthStore().me?.steam_id;
        },
        result: function (this: any, { data }: { data: any }) {
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
    onPageChange(newPage: number) {
      this.page = newPage;
    },
    onPerPageChange(value: number) {
      this.perPage = value;
      this.page = 1;
    },
  },
};
</script>
