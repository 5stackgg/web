<script setup lang="ts">
import {
  Search,
  X,
  PlusCircle,
  Users,
  Trophy,
  Swords,
  SlidersHorizontal,
  ChevronDown,
  Check,
} from "lucide-vue-next";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import FilterBar from "~/components/common/FilterBar.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import TeamsTable from "~/components/TeamsTable.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import Pagination from "@/components/Pagination.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
  filterTriggerBase,
  filterTriggerIdle,
  filterTriggerActive,
  filterBadgeClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <PageTransition>
    <TacticalPageHeader inline-actions>
      <template #title>{{ $t("pages.teams.title") }}</template>
      <template #actions>
        <NuxtLink
          v-if="me"
          :to="{ name: 'teams-create' }"
          :class="[
            tacticalCtaButtonClasses,
            tacticalHeaderActionClasses,
            'max-md:aspect-square max-md:!px-0',
          ]"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden md:inline">{{ $t("pages.teams.create") }}</span>
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <!-- Filters -->
  <PageTransition :delay="100" class="mt-6">
    <FilterBar>
      <!-- Search (always visible — type instantly) -->
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          :model-value="form.values.teamQuery"
          @update:model-value="
            (value) => form.setFieldValue('teamQuery', String(value ?? ''))
          "
          :placeholder="$t('pages.teams.search')"
          class="h-full text-sm"
        />
        <InputGroupAddon align="inline-end" class="pr-2">
          <button
            v-if="form.values.teamQuery"
            type="button"
            class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="form.setFieldValue('teamQuery', '')"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>

      <!-- My Teams Only — used frequently, kept on the left -->
      <button
        v-if="me"
        type="button"
        @click="toggleShowOnlyMyTeams"
        :class="[
          filterTriggerBase,
          showOnlyMyTeams ? filterTriggerActive : filterTriggerIdle,
        ]"
      >
        <Users class="h-3.5 w-3.5" />
        {{ $t("team.search.my_teams_only") }}
      </button>

      <!-- Filters (bundled, pinned right) + grouped reset -->
      <FilterMenu
        class="ml-auto"
        :count="teamsFilterCount"
        :active="teamsFilterCount > 0"
        :show-reset="hasActiveTeamFilters"
        content-class="w-64 space-y-0.5 p-2"
        @reset="resetTeamFilters"
      >
          <button
            type="button"
            @click="toggleTournamentWinners"
            class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
            :class="
              tournamentWinnersOnly
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-foreground/90'
            "
          >
            <span class="flex items-center gap-2">
              <Trophy class="h-3.5 w-3.5" />
              {{ $t("team.search.tournament_winners") }}
            </span>
            <Check
              v-if="tournamentWinnersOnly"
              class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
            />
          </button>
          <button
            type="button"
            @click="toggleScrimsOnly"
            class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
            :class="
              scrimsOnly ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground/90'
            "
          >
            <span class="flex items-center gap-2">
              <Swords class="h-3.5 w-3.5" />
              {{ $t("team.search.scrims_only") }}
            </span>
            <Check
              v-if="scrimsOnly"
              class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
            />
          </button>
      </FilterMenu>
    </FilterBar>
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
      scrimsOnly: false,
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
    teamsFilterCount(): number {
      let n = 0;
      if (this.tournamentWinnersOnly) n++;
      if (this.scrimsOnly) n++;
      return n;
    },
    hasActiveTeamFilters(): boolean {
      return !!this.form.values.teamQuery || this.teamsFilterCount > 0;
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
    scrimsOnly() {
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
        const scrimFilter = this.scrimsOnly
          ? { scrim_settings: { enabled: { _eq: true } } }
          : {};
        const where = { ...nameFilter, ...championFilter, ...scrimFilter };
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
        const scrimFilter = this.scrimsOnly
          ? { scrim_settings: { enabled: { _eq: true } } }
          : {};
        const where = { ...nameFilter, ...championFilter, ...scrimFilter };
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
    toggleScrimsOnly() {
      this.scrimsOnly = !this.scrimsOnly;
    },
    resetTeamFilters() {
      this.form.setFieldValue("teamQuery", "");
      this.tournamentWinnersOnly = false;
      this.scrimsOnly = false;
      this.showOnlyMyTeams = false;
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
