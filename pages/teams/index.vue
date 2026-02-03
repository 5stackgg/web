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
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import Empty from "~/components/ui/empty/Empty.vue";

const { isMobile } = useSidebar();
</script>

<template>
  <div class="flex-grow flex flex-col gap-6">
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

    <PageTransition :delay="100">
      <div
        v-if="me"
        class="flex items-center space-x-2 justify-end cursor-pointer"
        @click="showOnlyMyTeams = !showOnlyMyTeams"
      >
        <Switch :model-value="showOnlyMyTeams" />
        <Label class="text-sm">
          {{ $t("team.search.my_teams_only") }}
        </Label>
      </div>
    </PageTransition>

    <PageTransition :delay="200">
      <AnimatedCard variant="gradient" class="p-4">
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

        <Empty
          v-if="
            (showOnlyMyTeams ? myTeams : teams) &&
            (showOnlyMyTeams ? myTeams : teams).length === 0
          "
        >
          <p class="text-muted-foreground">
            {{ $t("pages.teams.no_teams") }}
          </p>
        </Empty>
        <teams-table
          :teams="showOnlyMyTeams ? myTeams : teams"
          v-else-if="showOnlyMyTeams ? myTeams : teams"
        ></teams-table>
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
            v-if="!showOnlyMyTeams && teams_aggregate"
          ></pagination>
        </Teleport>
      </AnimatedCard>
    </PageTransition>

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
      // Provide initial shapes so template type inference knows these exist
      teams: undefined as any,
      teams_aggregate: undefined as any,
      myTeams: undefined as any,
      showOnlyMyTeams: false,
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
  },
};
</script>
