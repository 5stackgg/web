<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { PlusCircle, Search, Swords, Trophy, Users, X } from "lucide-vue-next";
import { $, order_by } from "~/generated/zeus";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { teamResultMatchFields } from "~/graphql/teamPulseFields";
import FilterBar from "~/components/common/FilterBar.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import Pagination from "~/components/Pagination.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import TeamsDirectoryRow from "~/components/teams/TeamsDirectoryRow.vue";
import type { TeamAwardEntry } from "~/components/teams/teamAwards";
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { useLiveTeamMatches } from "~/composables/useLiveTeamMatches";
import { usePerPage } from "~/composables/usePerPage";
import { schemaHasField } from "~/utilities/schemaHasType";
import {
  filterTriggerActive,
  filterTriggerBase,
  filterTriggerIdle,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// The page shows "Create team" here only when the viewer has no team of
// their own; otherwise it sits on "Your teams".
defineProps<{ showCreate: boolean }>();

type Sort = "active" | "rating" | "name";

const { t } = useI18n();
const { client } = useApolloClient();
const auth = useAuthStore();
const { liveTeamIds } = useLiveTeamMatches();

const search = ref("");
const query = ref("");
const mine = ref(false);
const winnersOnly = ref(false);
const scrimsOnly = ref(false);
const sort = ref<Sort | null>(null);
const page = ref(1);
const perPage = usePerPage("teams");

const teams = ref<any[]>([]);
const total = ref(0);
// Starts pending: the first fetch waits on the schema check for its sort.
const fetching = ref(true);
const { skeleton, refreshing } = useDeferredLoading(() => fetching.value);

const signedIn = computed(() => !!auth.me);

// "Recently active" needs the API's last_match_at; until it ships the sort
// is left out rather than failing.
const hasLastMatchAt = ref(false);
if (typeof window !== "undefined") {
  schemaHasField(client, "teams", "last_match_at").then((has) => {
    hasLastMatchAt.value = has;
    sort.value ??= has ? "active" : "name";
  });
}

const sortOptions = computed(() => [
  ...(hasLastMatchAt.value
    ? [{ key: "active" as Sort, label: t("pages.teams.directory.sort_active") }]
    : []),
  { key: "rating" as Sort, label: t("pages.teams.directory.sort_rating") },
  { key: "name" as Sort, label: t("pages.teams.directory.sort_name") },
]);

const sortModel = computed<Sort>({
  get: () => sort.value ?? "name",
  set: (value) => {
    sort.value = value;
    page.value = 1;
  },
});

const ORDER: Record<Sort, any[]> = {
  active: [{ last_match_at: "desc_nulls_last" }, { name: "asc" }],
  rating: [{ ranks: { avg_elo: "desc_nulls_last" } }, { name: "asc" }],
  name: [{ name: "asc" }],
};

// Every team award; the rows show them and "Tournament winners" filters on
// them.
const teamAwards = ref<TeamAwardEntry[]>([]);
const awardsSub = generateSubscription({
  award_recipients: [
    { where: { player_steam_id: { _is_null: true } } },
    {
      id: true,
      team_id: true,
      source: true,
      placement: true,
      placement_tier: true,
      tournament_id: true,
      created_at: true,
      award: {
        id: true,
        name: true,
        tier: true,
        silhouette: true,
        image_url: true,
      },
      tournament: {
        id: true,
        name: true,
        start: true,
        stages: [
          { order_by: [{ order: order_by.desc }], limit: 1 },
          { type: true },
        ],
      },
      tournament_award: {
        custom_name: true,
        silhouette: true,
        image_url: true,
      },
    },
  ],
} as any);
const awardsSubscription =
  typeof window !== "undefined"
    ? client.subscribe({ query: awardsSub }).subscribe({
        next: ({ data }: any) => {
          teamAwards.value = data?.award_recipients ?? [];
        },
        error: (error: any) => {
          console.error("[teams] awards subscription error", error);
        },
      })
    : null;

const awardsByTeamId = computed(() => {
  const map: Record<string, TeamAwardEntry[]> = {};
  for (const grant of teamAwards.value as any[]) {
    if (grant.team_id) (map[grant.team_id] ??= []).push(grant);
  }
  return map;
});
const winnerTeamIds = computed(() => [
  ...new Set(
    (teamAwards.value as any[])
      .filter((grant) => grant.team_id && grant.source === "tournament")
      .map((grant) => grant.team_id as string),
  ),
]);

const rowFields = {
  id: true,
  name: true,
  short_name: true,
  avatar_url: true,
  is_organization: true,
  ranks: { avg_elo: true },
  roster: [
    {},
    {
      status: true,
      roster_image_url: true,
      player: { steam_id: true, name: true, avatar_url: true, country: true },
    },
  ],
  __alias: {
    recent_results: {
      matches: [
        {
          where: { status: { _eq: $("finished", "e_match_status_enum!") } },
          order_by: [{ ended_at: order_by.desc_nulls_last }],
          limit: 5,
        },
        teamResultMatchFields,
      ],
    },
  },
};

function teamsQuery(withLastMatch: boolean) {
  return generateQuery({
    teams: [
      {
        where: $("where", "teams_bool_exp!"),
        order_by: $("orderBy", "[teams_order_by!]"),
        limit: $("limit", "Int!"),
        offset: $("offset", "Int!"),
      },
      withLastMatch ? { ...rowFields, last_match_at: true } : rowFields,
    ],
    teams_aggregate: [
      { where: $("where", "teams_bool_exp!") },
      { aggregate: { count: true } },
    ],
  } as any);
}
const queries = { with: teamsQuery(true), without: teamsQuery(false) };

const filterCount = computed(
  () => Number(winnersOnly.value) + Number(scrimsOnly.value),
);
const anyFilter = computed(
  () => !!search.value || mine.value || filterCount.value > 0,
);

const where = computed(() => {
  const and: any[] = [];
  const term = query.value.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  if (term) {
    and.push({
      _or: [
        { name: { _ilike: `%${term}%` } },
        { short_name: { _ilike: `%${term}%` } },
      ],
    });
  }
  if (winnersOnly.value) and.push({ id: { _in: winnerTeamIds.value } });
  if (scrimsOnly.value)
    and.push({ scrim_settings: { enabled: { _eq: true } } });
  if (mine.value && auth.me?.steam_id) {
    and.push({
      _or: [
        { owner_steam_id: { _eq: auth.me.steam_id } },
        { roster: { player_steam_id: { _eq: auth.me.steam_id } } },
      ],
    });
  }
  return and.length ? { _and: and } : {};
});

// Bumped on every fetch so a slow response for an old filter can't land
// over a newer one.
let generation = 0;
async function load() {
  if (!sort.value || typeof window === "undefined") return;
  const current = ++generation;
  fetching.value = true;
  try {
    const { data } = await client.query({
      query: hasLastMatchAt.value ? queries.with : queries.without,
      variables: {
        where: where.value,
        orderBy: ORDER[sort.value],
        limit: mine.value ? 100 : perPage.value,
        offset: mine.value ? 0 : (page.value - 1) * perPage.value,
        finished: "Finished",
      },
      fetchPolicy: "network-only",
    });
    if (current !== generation) return;
    teams.value = (data as any)?.teams ?? [];
    total.value = (data as any)?.teams_aggregate?.aggregate?.count ?? 0;
  } catch (error) {
    console.error("[teams] directory query error", error);
  } finally {
    if (current === generation) fetching.value = false;
  }
}

watch(
  [where, sort, page, perPage, mine],
  () => {
    void load();
  },
  { immediate: true, deep: true },
);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    query.value = value;
    page.value = 1;
  }, 250);
});
watch([mine, winnersOnly, scrimsOnly], () => {
  page.value = 1;
});
watch(signedIn, (value) => {
  if (!value) mine.value = false;
});

onBeforeUnmount(() => {
  awardsSubscription?.unsubscribe();
  if (searchTimer) clearTimeout(searchTimer);
});

function clearSearch() {
  search.value = "";
  query.value = "";
  page.value = 1;
}

function resetFilters() {
  clearSearch();
  mine.value = false;
  winnersOnly.value = false;
  scrimsOnly.value = false;
}

function onPerPage(value: number) {
  perPage.value = value;
  page.value = 1;
}

const headerCell = "text-[11px] font-semibold uppercase tracking-[0.1em]";
</script>

<template>
  <section aria-labelledby="teams-all-label">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 id="teams-all-label" :class="[tacticalSectionLabelClasses, '!mb-0']">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.teams.directory.title") }}
      </h2>
      <div class="flex flex-wrap items-center gap-2">
        <WatchSegmented
          v-if="sort"
          v-model="sortModel"
          :options="sortOptions"
          :label="$t('pages.teams.directory.sort_label')"
        />
        <Button
          v-if="showCreate && signedIn"
          as-child
          size="sm"
          variant="outline"
          class="relative h-8 gap-1.5 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden"
        >
          <NuxtLink :to="{ name: 'teams-create' }">
            <PlusCircle class="size-3.5" />
            {{ $t("pages.teams.create") }}
          </NuxtLink>
        </Button>
      </div>
    </div>

    <FilterBar>
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          v-model="search"
          :placeholder="$t('pages.teams.search')"
          :aria-label="$t('pages.teams.directory.search_label')"
          class="h-full text-sm"
        />
        <InputGroupAddon align="inline-end" class="pr-2">
          <button
            v-if="search"
            type="button"
            class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :aria-label="$t('pages.teams.directory.clear_search')"
            @click="clearSearch"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>

      <button
        v-if="signedIn"
        type="button"
        :aria-pressed="mine"
        :class="[
          filterTriggerBase,
          mine ? filterTriggerActive : filterTriggerIdle,
        ]"
        @click="mine = !mine"
      >
        <Users class="h-3.5 w-3.5" />
        {{ $t("team.search.my_teams_only") }}
      </button>

      <FilterMenu
        class="ml-auto"
        :count="filterCount"
        :active="filterCount > 0"
        :show-reset="anyFilter"
        content-class="w-64 space-y-0.5 p-2"
        @reset="resetFilters"
      >
        <FilterToggle
          v-model="winnersOnly"
          :label="$t('team.search.tournament_winners')"
        >
          <template #icon><Trophy class="h-3.5 w-3.5" /></template>
        </FilterToggle>
        <FilterToggle
          v-model="scrimsOnly"
          :label="$t('team.search.scrims_only')"
        >
          <template #icon><Swords class="h-3.5 w-3.5" /></template>
        </FilterToggle>
      </FilterMenu>
    </FilterBar>

    <div
      class="mt-3 overflow-hidden rounded-lg border border-border bg-muted/10 transition-opacity duration-150"
      :class="{ 'opacity-60': refreshing }"
      :aria-busy="fetching"
    >
      <div
        aria-hidden="true"
        class="hidden items-center gap-x-4 border-b border-border px-4 py-2 text-muted-foreground lg:grid lg:[grid-template-columns:2.5rem_minmax(0,1.6fr)_8.5rem_5.5rem_6.5rem_8.5rem_minmax(0,9rem)]"
      >
        <span></span>
        <span :class="headerCell">{{ $t("team.table.team") }}</span>
        <span :class="headerCell">{{
          $t("pages.teams.directory.col_roster")
        }}</span>
        <span :class="headerCell">{{
          $t("pages.teams.directory.col_elo")
        }}</span>
        <span :class="headerCell">{{
          $t("pages.teams.directory.col_form")
        }}</span>
        <span :class="headerCell">{{
          $t("pages.teams.directory.col_last")
        }}</span>
        <span :class="[headerCell, 'text-right']">{{
          $t("pages.teams.directory.col_awards")
        }}</span>
      </div>

      <div v-if="skeleton" class="divide-y divide-border/60">
        <div
          v-for="i in Math.min(perPage, 10)"
          :key="i"
          class="flex items-center gap-3 px-4 py-3"
        >
          <Skeleton class="size-10 shrink-0 rounded-md" />
          <div class="grid flex-1 gap-1.5">
            <Skeleton class="h-4 w-40" />
            <Skeleton class="h-3 w-24" />
          </div>
          <Skeleton class="hidden h-4 w-24 lg:block" />
          <Skeleton class="h-4 w-20" />
        </div>
      </div>

      <div
        v-else-if="!teams.length"
        class="grid justify-items-center gap-1.5 px-6 py-10 text-center"
      >
        <p class="m-0 text-sm font-semibold">
          {{ $t("pages.teams.no_teams_title") }}
        </p>
        <p class="m-0 text-[13px] text-muted-foreground">
          {{
            anyFilter
              ? $t("pages.teams.directory.no_match")
              : $t("pages.teams.no_teams")
          }}
        </p>
        <Button
          v-if="anyFilter"
          size="sm"
          variant="outline"
          class="mt-2 h-8"
          @click="resetFilters"
        >
          {{ $t("pages.teams.directory.clear_filters") }}
        </Button>
      </div>

      <div v-else role="list" class="divide-y divide-border/60">
        <TeamsDirectoryRow
          v-for="team in teams"
          :key="team.id"
          :team="team"
          :awards="awardsByTeamId[team.id] ?? []"
          :live="liveTeamIds.has(team.id)"
        />
      </div>
    </div>

    <Pagination
      v-if="!mine && total > 0"
      class="mt-3"
      :page="page"
      :per-page="perPage"
      :total="total"
      :show-per-page-selector="true"
      @page="page = $event"
      @update:per-page="onPerPage"
    />
  </section>
</template>
