<script setup lang="ts">
import { Search, X, PlusCircle } from "lucide-vue-next";
import { FormItem, FormControl } from "@/components/ui/form";
import TeamsTable from "~/components/TeamsTable.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import Pagination from "@/components/Pagination.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import { Switch } from "~/components/ui/switch";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #title>{{ $t("pages.teams.title") }}</template>
      <template #actions>
        <NuxtLink
          v-if="me"
          :to="{ name: 'teams-create' }"
          :class="tacticalCtaButtonClasses"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden md:inline">{{ $t("pages.teams.create") }}</span>
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <!-- Filters -->
  <PageTransition :delay="100" class="mt-6">
    <div>
      <form @submit.prevent="viewTopTeam">
        <FormField v-slot="{ componentField }" name="teamQuery">
          <FormItem>
            <FormControl>
              <InputGroup class="h-12 bg-card/60 backdrop-blur border-border">
                <InputGroupAddon class="pl-4">
                  <Search class="w-5 h-5" />
                </InputGroupAddon>

                <InputGroupInput
                  type="text"
                  :placeholder="$t('pages.teams.search')"
                  class="h-full text-base"
                  v-bind="componentField"
                />

                <InputGroupAddon align="inline-end" class="gap-3 pr-2">
                  <button
                    v-if="form.values.teamQuery"
                    type="button"
                    @click="form.setFieldValue('teamQuery', '')"
                    class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X class="w-4 h-4" />
                  </button>

                  <div
                    v-if="me"
                    class="flex h-8 items-center gap-2 rounded-md border border-border bg-background/70 px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer whitespace-nowrap"
                    :class="{
                      'text-foreground border-primary/50 bg-primary/10':
                        showOnlyMyTeams,
                    }"
                    @click="showOnlyMyTeams = !showOnlyMyTeams"
                  >
                    <Switch v-model="showOnlyMyTeams" @click.stop />
                    <button
                      type="button"
                      class="text-left"
                      :aria-pressed="showOnlyMyTeams"
                      @click.stop="showOnlyMyTeams = !showOnlyMyTeams"
                    >
                      {{ $t("team.search.my_teams_only") }}
                    </button>
                  </div>
                </InputGroupAddon>
              </InputGroup>
            </FormControl>
          </FormItem>
        </FormField>
      </form>
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
import { toTypedSchema } from "~/utilities/vee-validate-zod";
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
              short_name: true,
              avatar_url: true,
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
                    short_name: true,
                    avatar_url: true,
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
