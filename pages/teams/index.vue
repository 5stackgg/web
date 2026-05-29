<script setup lang="ts">
import { Search, X, PlusCircle, Users, Trophy } from "lucide-vue-next";
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
                    class="flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs tracking-[0.06em] transition-colors duration-150 whitespace-nowrap"
                    :class="
                      tournamentWinnersOnly
                        ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.13)] text-[hsl(var(--tac-amber))]'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    "
                    @click="toggleTournamentWinners"
                  >
                    <Trophy class="h-3.5 w-3.5" />
                    <span id="teams-tournament-winners-label">
                      {{ $t("team.search.tournament_winners") }}
                    </span>
                    <Switch
                      v-model="tournamentWinnersOnly"
                      aria-labelledby="teams-tournament-winners-label"
                      class="ml-1 data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=unchecked]:bg-muted/70"
                      @click.stop
                    />
                  </div>

                  <div
                    v-if="me"
                    class="flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs tracking-[0.06em] transition-colors duration-150 whitespace-nowrap"
                    :class="
                      showOnlyMyTeams
                        ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.13)] text-[hsl(var(--tac-amber))]'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    "
                    @click="toggleShowOnlyMyTeams"
                  >
                    <Users class="h-3.5 w-3.5" />
                    <span id="teams-my-teams-only-label">
                      {{ $t("team.search.my_teams_only") }}
                    </span>
                    <Switch
                      v-model="showOnlyMyTeams"
                      aria-labelledby="teams-my-teams-only-label"
                      class="ml-1 data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=unchecked]:bg-muted/70"
                      @click.stop
                    />
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
          :trophies-by-team-id="trophiesByTeamId"
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
      perPage: usePerPage("teams"),
      // Provide initial shapes so template type inference knows these exist
      teams: undefined as any,
      teams_aggregate: undefined as any,
      myTeams: undefined as any,
      teamTrophies: [] as Array<any>,
      showOnlyMyTeams: false,
      tournamentWinnersOnly: false,
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
    trophiesByTeamId(): Record<string, any[]> {
      const map: Record<string, any[]> = {};
      for (const t of this.teamTrophies) {
        const teamId = t.tournament_team?.team_id;
        if (!teamId) continue;
        (map[teamId] ??= []).push(t);
      }
      return map;
    },
    winnerTeamIds(): string[] {
      return Object.keys(this.trophiesByTeamId);
    },
  },
  watch: {
    "form.values.teamQuery": {
      immediate: true,
      handler() {
        this.page = 1;
      },
    },
    tournamentWinnersOnly() {
      this.page = 1;
    },
  },
  apollo: {
    teams: {
      fetchPolicy: "network-only",
      result: function () {
        this.loading = false;
      },
      query: function (this: any) {
        const nameFilter =
          this.form.values.teamQuery?.length >= 3
            ? { name: { _ilike: $("teamQuery", "String") } }
            : {};
        const championFilter = this.tournamentWinnersOnly
          ? { id: { _in: $("winnerTeamIds", "[uuid!]!") } }
          : {};
        const where = { ...nameFilter, ...championFilter };
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
              ...(Object.keys(where).length ? { where } : {}),
            },
            {
              id: true,
              name: true,
              short_name: true,
              avatar_url: true,
              roster: [
                {},
                {
                  roster_image_url: true,
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
          winnerTeamIds: this.winnerTeamIds,
        };
      },
    },
    teams_aggregate: {
      fetchPolicy: "network-only",
      query: function (this: any) {
        const nameFilter =
          this.form.values.teamQuery?.length >= 3
            ? { name: { _ilike: $("teamQuery", "String") } }
            : {};
        const championFilter = this.tournamentWinnersOnly
          ? { id: { _in: $("winnerTeamIds", "[uuid!]!") } }
          : {};
        const where = { ...nameFilter, ...championFilter };
        return generateQuery({
          teams_aggregate: [
            {
              ...(Object.keys(where).length ? { where } : {}),
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
          winnerTeamIds: this.winnerTeamIds,
        };
      },
    },
    $subscribe: {
      teamTrophies: {
        query: function () {
          return typedGql("subscription")({
            tournament_trophies: [
              {
                where: {
                  player_steam_id: { _is_null: true },
                },
              },
              {
                id: true,
                placement: true,
                placement_tier: true,
                tournament_id: true,
                tournament: {
                  id: true,
                  name: true,
                  start: true,
                  stages: [
                    {
                      order_by: [{ order: order_by.desc }],
                      limit: 1,
                    },
                    { type: true },
                  ],
                },
                trophy_config: {
                  custom_name: true,
                  silhouette: true,
                  image_url: true,
                },
                tournament_team: {
                  team_id: true,
                },
              },
            ],
          });
        },
        result: function (this: any, { data }: { data: any }) {
          this.teamTrophies = data.tournament_trophies || [];
        },
      },
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
    toggleShowOnlyMyTeams() {
      this.showOnlyMyTeams = !this.showOnlyMyTeams;
    },
    toggleTournamentWinners() {
      this.tournamentWinnersOnly = !this.tournamentWinnersOnly;
    },
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
