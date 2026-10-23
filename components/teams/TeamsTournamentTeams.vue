<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { Search, Users, X } from "lucide-vue-next";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import FilterBar from "~/components/common/FilterBar.vue";
import Pagination from "~/components/Pagination.vue";
import TeamsEmblem from "~/components/teams/TeamsEmblem.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import { useAuthStore } from "~/stores/AuthStore";
import { usePerPage } from "~/composables/usePerPage";
import { useRestoredRefs } from "~/composables/useRestoredState";
import {
  filterTriggerActive,
  filterTriggerBase,
  filterTriggerIdle,
} from "~/utilities/tacticalClasses";

type Segment = "running" | "finished";

// Running / finished go to `headerTo` (the page's tab row) when given, else
// above the list.
defineProps<{ headerTo?: HTMLElement | null }>();
// Whether there is anything to show, told after every load.
const emit = defineEmits<{ (e: "available", has: boolean): void }>();

const { t } = useI18n();
const { client } = useApolloClient();
const auth = useAuthStore();

const search = ref("");
const query = ref("");
const mine = ref(false);
const segment = ref<Segment>("running");
const page = ref(1);
const perPage = usePerPage("tournament-teams");
useRestoredRefs("teams-tournament-teams", {
  search,
  query,
  mine,
  segment,
  page,
});

const teams = ref<any[]>([]);
const counts = ref<Record<Segment, number>>({ running: 0, finished: 0 });
const fetching = ref(false);
const loaded = ref(false);

const signedIn = computed(() => !!auth.me);
const anyFilter = computed(() => !!search.value || mine.value);
const available = computed(
  () =>
    loaded.value &&
    (counts.value.running + counts.value.finished > 0 || anyFilter.value),
);
const total = computed(() => counts.value[segment.value]);
const otherSegment = computed<Segment>(() =>
  segment.value === "running" ? "finished" : "running",
);
const otherCount = computed(() => counts.value[otherSegment.value]);

const segmentModel = computed<Segment>({
  get: () => segment.value,
  set: (value) => {
    segment.value = value;
    page.value = 1;
  },
});

const segmentOptions = computed(() => [
  {
    key: "running" as Segment,
    label: t("pages.teams.tournament_teams.running"),
    count: counts.value.running,
  },
  {
    key: "finished" as Segment,
    label: t("pages.teams.tournament_teams.finished"),
    count: counts.value.finished,
  },
]);

const SEGMENT_STATUS: Record<Segment, any> = {
  running: {
    _nin: [
      e_tournament_status_enum.Finished,
      e_tournament_status_enum.Cancelled,
      e_tournament_status_enum.CancelledMinTeams,
    ],
  },
  finished: { _eq: e_tournament_status_enum.Finished },
};

// Teams made with "New team" inside a tournament (pickup teams included) have
// no `teams` row, so the directory can never list them.
const listQuery = generateQuery({
  tournament_teams: [
    {
      where: $("where", "tournament_teams_bool_exp!"),
      order_by: $("orderBy", "[tournament_teams_order_by!]"),
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
    },
    {
      id: true,
      name: true,
      short_name: true,
      tournament: {
        id: true,
        name: true,
        status: true,
        e_tournament_status: { description: true },
      },
      roster: [
        {},
        {
          player: {
            steam_id: true,
            name: true,
            avatar_url: true,
          },
        },
      ],
    },
  ],
  __alias: {
    running: {
      tournament_teams_aggregate: [
        { where: $("runningWhere", "tournament_teams_bool_exp!") },
        { aggregate: { count: true } },
      ],
    },
    finished: {
      tournament_teams_aggregate: [
        { where: $("finishedWhere", "tournament_teams_bool_exp!") },
        { aggregate: { count: true } },
      ],
    },
  },
} as any);

// Every team in a tournament shares its start, so the id breaks the tie or
// LIMIT/OFFSET pages repeat some teams and skip others.
const ORDER = [
  { tournament: { start: order_by.desc_nulls_last } },
  { name: order_by.asc },
  { id: order_by.asc },
];

const filters = computed(() => {
  const and: any[] = [{ team_id: { _is_null: true } }];
  const raw = query.value.trim();
  const term = raw.replace(/[\\%_]/g, (c) => `\\${c}`);
  if (term) {
    const or: any[] = [
      { name: { _ilike: `%${term}%` } },
      { short_name: { _ilike: `%${term}%` } },
      { tournament: { name: { _ilike: `%${term}%` } } },
      { roster: { player: { name: { _ilike: `%${term}%` } } } },
    ];
    if (/^\d{1,18}$/.test(raw)) {
      or.push({ roster: { player_steam_id: { _eq: raw } } });
    }
    and.push({ _or: or });
  }
  // Not owner or captain: both fall back to the organizer who added the team.
  if (mine.value && auth.me?.steam_id) {
    and.push({ roster: { player_steam_id: { _eq: auth.me.steam_id } } });
  }
  return and;
});

function whereFor(value: Segment) {
  return {
    _and: [...filters.value, { tournament: { status: SEGMENT_STATUS[value] } }],
  };
}

const where = computed(() => whereFor(segment.value));

let generation = 0;
async function load() {
  if (typeof window === "undefined") {
    return;
  }
  const current = ++generation;
  fetching.value = true;
  try {
    const { data } = await client.query({
      query: listQuery,
      variables: {
        where: where.value,
        runningWhere: whereFor("running"),
        finishedWhere: whereFor("finished"),
        orderBy: ORDER,
        limit: perPage.value,
        offset: (page.value - 1) * perPage.value,
      },
      fetchPolicy: "network-only",
    });
    if (current !== generation) {
      return;
    }
    teams.value = (data as any)?.tournament_teams ?? [];
    counts.value = {
      running: (data as any)?.running?.aggregate?.count ?? 0,
      finished: (data as any)?.finished?.aggregate?.count ?? 0,
    };
    loaded.value = true;
    emit("available", available.value);
  } catch (error) {
    console.error("[teams] tournament teams query error", error);
  } finally {
    if (current === generation) {
      fetching.value = false;
    }
  }
}

watch(
  [where, page, perPage],
  () => {
    void load();
  },
  { immediate: true, deep: true },
);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    query.value = value;
    page.value = 1;
  }, 250);
});
watch(mine, () => {
  page.value = 1;
});
watch(signedIn, (value) => {
  if (!value) {
    mine.value = false;
  }
});

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

function clearSearch() {
  search.value = "";
  query.value = "";
  page.value = 1;
}

function resetFilters() {
  clearSearch();
  mine.value = false;
}

function onPerPage(value: number) {
  perPage.value = value;
  page.value = 1;
}

function faces(team: any) {
  return (team.roster ?? []).slice(0, 5);
}

function extraFaces(team: any) {
  return Math.max(0, (team.roster?.length ?? 0) - 5);
}

const headerCell = "text-[11px] font-semibold uppercase tracking-[0.1em]";
const chipClasses =
  "inline-flex h-5 shrink-0 items-center rounded-[5px] border px-1.5 text-[11px] font-semibold";
</script>

<template>
  <section v-if="available">
    <div
      :class="
        headerTo ? 'contents' : 'mb-3 flex flex-wrap items-center justify-end'
      "
    >
      <Teleport :to="headerTo" :disabled="!headerTo">
        <WatchSegmented
          v-model="segmentModel"
          :options="segmentOptions"
          :label="$t('pages.teams.tournament_teams.segment_label')"
        />
      </Teleport>
    </div>

    <FilterBar>
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          v-model="search"
          :placeholder="$t('pages.teams.tournament_teams.search')"
          :aria-label="$t('pages.teams.tournament_teams.search_label')"
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
        :title="$t('team.search.my_teams_only')"
        :class="[
          filterTriggerBase,
          mine ? filterTriggerActive : filterTriggerIdle,
        ]"
        @click="mine = !mine"
      >
        <Users class="h-3.5 w-3.5" />
        <span class="max-md:sr-only">{{
          $t("team.search.my_teams_only")
        }}</span>
      </button>
    </FilterBar>

    <div
      class="mt-3 overflow-hidden rounded-lg border border-border bg-muted/10 transition-opacity duration-150"
      :class="{ 'opacity-60': fetching }"
      :aria-busy="fetching"
    >
      <div
        aria-hidden="true"
        class="hidden items-center gap-x-4 border-b border-border px-4 py-2 text-muted-foreground lg:grid lg:[grid-template-columns:2.5rem_minmax(0,1.4fr)_8.5rem_minmax(0,1.4fr)_9rem]"
      >
        <span></span>
        <span :class="headerCell">{{ $t("team.table.team") }}</span>
        <span :class="headerCell">{{
          $t("pages.teams.directory.col_roster")
        }}</span>
        <span :class="headerCell">{{
          $t("pages.teams.tournament_teams.col_tournament")
        }}</span>
        <span :class="[headerCell, 'text-right']">{{
          $t("pages.teams.tournament_teams.col_status")
        }}</span>
      </div>

      <div
        v-if="!teams.length"
        class="grid justify-items-center gap-1.5 px-6 py-10 text-center"
      >
        <p class="m-0 text-sm font-semibold">
          {{ $t("pages.teams.no_teams_title") }}
        </p>
        <p class="m-0 text-[13px] text-muted-foreground">
          <template v-if="anyFilter && otherCount">
            {{
              otherSegment === "finished"
                ? $t("pages.teams.tournament_teams.found_in_finished", {
                    count: otherCount,
                  })
                : $t("pages.teams.tournament_teams.found_in_running", {
                    count: otherCount,
                  })
            }}
          </template>
          <template v-else>
            {{
              anyFilter
                ? $t("pages.teams.directory.no_match")
                : $t("pages.teams.no_teams")
            }}
          </template>
        </p>
        <Button
          v-if="otherCount"
          size="sm"
          variant="outline"
          class="mt-2 h-8"
          @click="segmentModel = otherSegment"
        >
          {{
            otherSegment === "finished"
              ? $t("pages.teams.tournament_teams.show_finished")
              : $t("pages.teams.tournament_teams.show_running")
          }}
        </Button>
        <Button
          v-else-if="anyFilter"
          size="sm"
          variant="outline"
          class="mt-2 h-8"
          @click="resetFilters"
        >
          {{ $t("pages.teams.directory.clear_filters") }}
        </Button>
      </div>

      <div v-else role="list" class="divide-y divide-border/60">
        <div
          v-for="team in teams"
          :key="team.id"
          role="listitem"
          class="group relative grid items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors duration-150 [grid-template-areas:'em_id_st'_'em_tr_tr'] [grid-template-columns:2.5rem_minmax(0,1fr)_auto] has-[a.team-link:focus-visible]:ring-2 has-[a.team-link:focus-visible]:ring-inset has-[a.team-link:focus-visible]:ring-[hsl(var(--tac-amber))] hover:bg-muted/25 lg:gap-x-4 lg:[grid-template-areas:'em_id_ro_tr_st'] lg:[grid-template-columns:2.5rem_minmax(0,1.4fr)_8.5rem_minmax(0,1.4fr)_9rem]"
        >
          <TeamsEmblem
            :team="team"
            :size="40"
            class="self-start [grid-area:em] lg:self-center"
          />

          <div class="grid min-w-0 gap-0.5 [grid-area:id]">
            <div class="flex min-w-0 items-center gap-2">
              <NuxtLink
                :to="{
                  name: 'tournaments-tournamentId',
                  params: { tournamentId: team.tournament.id },
                  query: { tab: 'teams' },
                }"
                class="team-link min-w-0 truncate text-[14.5px] font-bold outline-none after:absolute after:inset-0 after:content-['']"
                >{{ team.name }}</NuxtLink
              >
              <span
                v-if="team.short_name"
                :class="[
                  chipClasses,
                  'border-border bg-muted/40 tracking-[0.06em] text-foreground/80',
                ]"
                >{{ team.short_name }}</span
              >
            </div>
            <span class="text-[12.5px] text-muted-foreground">{{
              team.roster?.length
                ? $t("pages.teams.players", team.roster.length)
                : $t("team.table.no_roster")
            }}</span>
          </div>

          <div class="hidden items-center [grid-area:ro] lg:flex">
            <div v-if="faces(team).length" class="flex -space-x-1.5">
              <Avatar
                v-for="member in faces(team)"
                :key="member.player?.steam_id"
                class="size-6 rounded-full border-2 border-background"
                :title="member.player?.name"
              >
                <AvatarImage
                  :src="member.player?.avatar_url ?? undefined"
                  :alt="member.player?.name"
                />
                <AvatarFallback class="text-[10px]">
                  {{ member.player?.name?.slice(0, 1) ?? "?" }}
                </AvatarFallback>
              </Avatar>
            </div>
            <span
              v-if="extraFaces(team)"
              class="ml-1.5 text-xs tabular-nums text-muted-foreground"
              >+{{ extraFaces(team) }}</span
            >
          </div>

          <span
            class="min-w-0 truncate text-[12.5px] text-foreground/80 [grid-area:tr] lg:text-[13px]"
            :title="team.tournament.name"
            >{{ team.tournament.name }}</span
          >

          <div class="flex justify-end [grid-area:st]">
            <span
              :class="[
                chipClasses,
                team.tournament.status === e_tournament_status_enum.Live
                  ? 'border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                  : 'border-border bg-muted/40 text-foreground/80',
              ]"
              >{{
                team.tournament.e_tournament_status?.description ??
                team.tournament.status
              }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <Pagination
      v-if="total > 0"
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
