<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ArrowRight, PlusCircle, Search, X } from "lucide-vue-next";
import { useSubscription } from "@vue/apollo-composable";
import { useScrollIntoViewOnChange } from "~/composables/useScrollIntoViewOnChange";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { tournamentCardFields } from "~/graphql/tournamentCardFields";
import { excludeLeagueTournaments } from "~/graphql/tournamentFilters";
import { tournamentRowState } from "~/utilities/watchEventCard";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "~/components/ui/label";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import CategorySelect from "~/components/tournament/CategorySelect.vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import Pagination from "~/components/Pagination.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { rememberTournaments } from "~/composables/useTournamentPreview";
import QuickLookSheet from "~/components/common/QuickLookSheet.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import WatchTournamentCard from "~/components/watch/WatchTournamentCard.vue";
import TournamentNextLan from "~/components/tournament/TournamentNextLan.vue";
import TournamentLiveFeature from "~/components/tournament/TournamentLiveFeature.vue";
import TournamentAgendaRow from "~/components/tournament/TournamentAgendaRow.vue";
import TournamentQuickLook from "~/components/tournament/TournamentQuickLook.vue";
import {
  createButtonClasses,
  listCreateButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionSeparatorClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Keep filter query params out of the NuxtPage page-key (app.vue) so applying a
// filter updates the URL without remounting/refreshing the whole page.
definePageMeta({
  persistQueryKeys: ["status", "since", "q", "page", "mine", "category"],
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

type StatusFilter = "all" | "live" | "registration" | "upcoming" | "finished";
type SincePreset = "all" | "7d" | "30d" | "90d" | "6m" | "1y";

const statusGroups: Record<
  Exclude<StatusFilter, "all">,
  e_tournament_status_enum[]
> = {
  live: [e_tournament_status_enum.Live, e_tournament_status_enum.Paused],
  registration: [e_tournament_status_enum.RegistrationOpen],
  upcoming: [
    e_tournament_status_enum.RegistrationClosed,
    e_tournament_status_enum.Setup,
    // Held at the check-in cutoff: registration is over and it has not started,
    // so it belongs here. Omitting it drops a held tournament out of every
    // filter tab, which is exactly when an organizer goes looking for it.
    e_tournament_status_enum.CheckInReview,
  ],
  finished: [
    e_tournament_status_enum.Finished,
    e_tournament_status_enum.Cancelled,
    e_tournament_status_enum.CancelledMinTeams,
  ],
};

const sinceMillis: Record<SincePreset, number> = {
  all: 0,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "6m": 182 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

// The card plus what the next-LAN strip and the prize split read.
const tournamentListFields = {
  ...tournamentCardFields,
  invite_only: true,
  prizes: [
    { order_by: [{ order: order_by.asc }] },
    { place: true, prize: true },
  ],
};

const statusFilter = computed<StatusFilter>(() => {
  const v = route.query.status;
  if (typeof v === "string" && v in statusGroups) {
    return v as StatusFilter;
  }
  return "all";
});

const sinceFilter = computed<SincePreset>(() => {
  const v = route.query.since;
  if (typeof v === "string" && v in sinceMillis && v !== "all") {
    return v as SincePreset;
  }
  return "all";
});

const nameQuery = computed<string>(() => {
  const v = route.query.q;
  return typeof v === "string" ? v : "";
});

const signedIn = computed(() => !!useAuthStore().me);

// Tournaments the viewer organizes (what the old manage page was for).
const mineFilter = computed(() => signedIn.value && route.query.mine === "1");

const categoryFilter = computed<string[]>(() => {
  const v = route.query.category;
  return typeof v === "string" && v ? v.split(",") : [];
});

const page = computed<number>(() => {
  const v = route.query.page;
  const n = typeof v === "string" ? parseInt(v, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
});

const perPage = 10;

// What the Filters menu holds, for its badge.
const menuFilterCount = computed(
  () =>
    (sinceFilter.value !== "all" ? 1 : 0) +
    categoryFilter.value.length +
    (mineFilter.value ? 1 : 0),
);

const hasActiveFilter = computed(
  () =>
    statusFilter.value !== "all" ||
    nameQuery.value.trim().length > 0 ||
    menuFilterCount.value > 0,
);

const searchInput = ref(nameQuery.value);
watch(nameQuery, (v) => {
  if (searchInput.value !== v) searchInput.value = v;
});

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
function onSearchInput(value: string | number) {
  searchInput.value = String(value ?? "");
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(commitSearch, 250);
}

function replaceQuery(mutate: (next: Record<string, any>) => void) {
  const next = { ...route.query } as Record<string, any>;
  mutate(next);
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function commitSearch() {
  const trimmed = searchInput.value.trim();
  replaceQuery((next) => {
    if (trimmed) next.q = trimmed;
    else delete next.q;
    delete next.page;
  });
}

function clearSearch() {
  searchInput.value = "";
  commitSearch();
}

const statusModel = computed<StatusFilter>({
  get: () => statusFilter.value,
  set: (v) =>
    replaceQuery((next) => {
      if (v === "all") delete next.status;
      else next.status = v;
      delete next.page;
    }),
});

const sinceModel = computed<SincePreset>({
  get: () => sinceFilter.value,
  set: (v) =>
    replaceQuery((next) => {
      if (v === "all") delete next.since;
      else next.since = v;
      delete next.page;
    }),
});

const mineModel = computed<boolean>({
  get: () => mineFilter.value,
  set: (v) =>
    replaceQuery((next) => {
      if (v) next.mine = "1";
      else delete next.mine;
      delete next.page;
    }),
});

const categoryModel = computed<string[]>({
  get: () => categoryFilter.value,
  set: (v) =>
    replaceQuery((next) => {
      if (v.length) next.category = v.join(",");
      else delete next.category;
      delete next.page;
    }),
});

function setPage(p: number) {
  replaceQuery((next) => {
    if (p <= 1) delete next.page;
    else next.page = String(p);
  });
}

// "See all" and paging both land the new list above a scrolled-down reader.
const filterRow = ref<HTMLElement | null>(null);
useScrollIntoViewOnChange(
  filterRow,
  () => `${statusFilter.value}:${page.value}`,
);

function clearAllFilters() {
  router.replace({ path: route.path, hash: route.hash });
}

const sinceOptions = computed<Array<{ value: SincePreset; label: string }>>(
  () => [
    { value: "all", label: t("pages.tournaments.filter.date_all") },
    { value: "7d", label: t("pages.tournaments.filter.date_7d") },
    { value: "30d", label: t("pages.tournaments.filter.date_30d") },
    { value: "90d", label: t("pages.tournaments.filter.date_90d") },
    { value: "6m", label: t("pages.tournaments.filter.date_6m") },
    { value: "1y", label: t("pages.tournaments.filter.date_1y") },
  ],
);

// --- Live, open and upcoming: small sets, pushed so a bracket going live
// shows up without a refresh. They also feed the filter counts.

function statusSubscription(statuses: e_tournament_status_enum[]) {
  return useSubscription(
    typedGql("subscription")({
      tournaments: [
        {
          where: $("where", "tournaments_bool_exp!"),
          order_by: [{ start: order_by.asc }],
        },
        tournamentListFields,
      ],
    } as any),
    { where: excludeLeagueTournaments({ status: { _in: statuses } }) },
  ).result;
}

const liveResult = statusSubscription(statusGroups.live);
const comingResult = statusSubscription([
  ...statusGroups.registration,
  ...statusGroups.upcoming,
]);

const live = computed<any[]>(
  () => (liveResult.value as any)?.tournaments ?? [],
);
const coming = computed<any[]>(
  () => (comingResult.value as any)?.tournaments ?? [],
);

// One LAN gets the strip on top: the soonest one that hasn't started.
const nextLan = computed(
  () =>
    coming.value.find((tournament) =>
      (tournament.categories || []).some(
        (category: any) => category.category === "LAN",
      ),
    ) ?? null,
);

const featured = computed(() => live.value[0] ?? null);
const liveRest = computed(() => live.value.slice(1));

// Everything else still to come, soonest first, for the agenda.
const agendaComing = computed(() =>
  coming.value.filter((tournament) => tournament.id !== nextLan.value?.id),
);

// With nothing live the LAN leads the page as the full card; a live bracket
// takes that spot and the LAN drops to the thin strip above it.
const lanHero = computed(() => !live.value.length);

// The agenda's month headings, in the order the list already runs.
function byMonth(tournaments: any[]) {
  const months: Array<{ key: string; label: string; tournaments: any[] }> = [];
  const format = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  });
  for (const tournament of tournaments) {
    const date = tournament.start ? new Date(tournament.start) : null;
    const key = date ? `${date.getFullYear()}-${date.getMonth()}` : "none";
    const last = months[months.length - 1];
    if (last?.key === key) {
      last.tournaments.push(tournament);
    } else {
      months.push({
        key,
        label: date ? format.format(date) : "",
        tournaments: [tournament],
      });
    }
  }
  return months;
}

const statusOptions = computed(() => {
  const openCount = coming.value.filter(
    (tournament) =>
      tournament.status === e_tournament_status_enum.RegistrationOpen,
  ).length;
  return [
    { key: "all" as const, label: t("pages.tournaments.filter.status_all") },
    {
      key: "live" as const,
      label: t("pages.tournaments.filter.status_live"),
      count: live.value.length || null,
    },
    {
      key: "registration" as const,
      label: t("pages.tournaments.filter.status_registration"),
      count: openCount || null,
    },
    {
      key: "upcoming" as const,
      label: t("pages.tournaments.filter.status_upcoming"),
      count: coming.value.length - openCount || null,
    },
    {
      key: "finished" as const,
      label: t("pages.tournaments.filter.status_finished"),
    },
  ];
});

// --- Recent results: the agenda's latest finished page; See all opens the
// finished filter for the rest.

const RECENT_PAGE = 12;
const recent = ref<any[]>([]);
const recentDone = ref(false);
const recentLoaded = ref(false);
let recentInFlight = false;

async function loadRecent() {
  if (recentDone.value || recentInFlight) return;
  recentInFlight = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        tournaments: [
          {
            where: $("where", "tournaments_bool_exp!"),
            order_by: [{ start: order_by.desc }],
            limit: $("limit", "Int!"),
            offset: $("offset", "Int!"),
          } as any,
          tournamentListFields,
        ],
      } as any),
      variables: {
        where: excludeLeagueTournaments({
          status: { _in: statusGroups.finished },
        }),
        limit: RECENT_PAGE,
        offset: recent.value.length,
      },
      fetchPolicy: "network-only",
    });
    const rows = (data as any)?.tournaments ?? [];
    recent.value = [...recent.value, ...rows];
    if (rows.length < RECENT_PAGE) recentDone.value = true;
  } catch (err) {
    console.error("[tournaments] recent fetch error:", err);
    recentDone.value = true;
  } finally {
    recentInFlight = false;
    recentLoaded.value = true;
  }
}

onMounted(loadRecent);

// Live and upcoming arrive over the websocket, which can lose the race to the
// HTTP results row or never connect at all; reveal after this long regardless.
const REVEAL_TIMEOUT = 2500;
const revealTimedOut = ref(false);
let revealTimer: ReturnType<typeof setTimeout> | null = null;
onMounted(() => {
  revealTimer = setTimeout(() => (revealTimedOut.value = true), REVEAL_TIMEOUT);
});
onBeforeUnmount(() => {
  if (revealTimer) clearTimeout(revealTimer);
  if (searchDebounce) clearTimeout(searchDebounce);
});

const curatedReady = computed(
  () =>
    revealTimedOut.value ||
    (liveResult.value !== undefined &&
      comingResult.value !== undefined &&
      recentLoaded.value),
);

const curatedEmpty = computed(
  () => !live.value.length && !coming.value.length && !recent.value.length,
);

// --- Filtered view

const filteredTournaments = ref<any[]>([]);

// Lets a tournament page draw its header from what this list already has.
watch(
  () => [live.value, coming.value, recent.value, filteredTournaments.value],
  (lists) => rememberTournaments(lists.flat()),
  { immediate: true },
);

const filteredTotal = ref(0);
const filteredLoading = ref(false);

// Shapes on the first filtered load only; a refetch after that keeps the
// current results up and dims them instead of flashing skeletons.
const {
  skeleton: filteredSkeleton,
  refreshing: filteredRefreshing,
  reset: resetFilteredLoading,
} = useDeferredLoading(() => filteredLoading.value);
watch(
  hasActiveFilter,
  (filtered) => {
    if (filtered) resetFilteredLoading();
  },
  { immediate: true },
);

const filterWhere = computed<Record<string, any>>(() => {
  const where: Record<string, any> = excludeLeagueTournaments();
  if (statusFilter.value !== "all") {
    where.status = { _in: statusGroups[statusFilter.value] };
  }
  const q = nameQuery.value.trim();
  if (q) {
    where.name = { _ilike: `%${q}%` };
  }
  const ms = sinceMillis[sinceFilter.value];
  if (ms) {
    where.start = { _gte: new Date(Date.now() - ms).toISOString() };
  }
  if (mineFilter.value) {
    where.is_organizer = { _eq: true };
  }
  if (categoryFilter.value.length) {
    where.categories = { category: { _in: categoryFilter.value } };
  }
  return where;
});

// Still to come reads soonest first; anything that can include finished
// ones reads newest first.
const filteredOrder = computed(() => [
  {
    start: ["finished", "all"].includes(statusFilter.value)
      ? order_by.desc
      : order_by.asc,
  },
]);

let filterFetchId = 0;
async function fetchFiltered() {
  const myId = ++filterFetchId;
  filteredLoading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        tournaments: [
          {
            where: $("where", "tournaments_bool_exp!"),
            order_by: $("order_by", "[tournaments_order_by!]!"),
            limit: $("limit", "Int!"),
            offset: $("offset", "Int!"),
          } as any,
          tournamentListFields,
        ],
        tournaments_aggregate: [
          { where: $("where", "tournaments_bool_exp!") } as any,
          { aggregate: { count: true } },
        ],
      } as any),
      variables: {
        where: filterWhere.value,
        order_by: filteredOrder.value,
        limit: perPage,
        offset: (page.value - 1) * perPage,
      },
      fetchPolicy: "network-only",
    });
    if (myId !== filterFetchId) return;
    filteredTournaments.value = (data as any)?.tournaments ?? [];
    filteredTotal.value =
      (data as any)?.tournaments_aggregate?.aggregate?.count ?? 0;
  } catch (err) {
    if (myId === filterFetchId) {
      console.error("[tournaments] filtered fetch error:", err);
      filteredTournaments.value = [];
      filteredTotal.value = 0;
    }
  } finally {
    if (myId === filterFetchId) {
      filteredLoading.value = false;
    }
  }
}

watch(
  [
    hasActiveFilter,
    statusFilter,
    sinceFilter,
    nameQuery,
    mineFilter,
    categoryFilter,
    page,
  ],
  () => {
    if (hasActiveFilter.value) {
      fetchFiltered();
    } else {
      filteredTournaments.value = [];
      filteredTotal.value = 0;
    }
  },
  { immediate: true },
);

// --- Quick look: steps through every card on the page in reading order.

const quickLookOpen = ref(false);
const quickLookIndex = ref(0);

// Past tournaments open their page instead, so they aren't stepped through.
const quickLookItems = computed<any[]>(() =>
  hasActiveFilter.value
    ? filteredTournaments.value.filter(
        (tournament) => tournamentRowState(tournament.status) !== "finished",
      )
    : [nextLan.value, ...liveRest.value, ...agendaComing.value].filter(Boolean),
);

const quickLookTournament = computed(
  () => quickLookItems.value[quickLookIndex.value] ?? null,
);

function openQuickLook(tournament: any) {
  quickLookIndex.value = Math.max(
    0,
    quickLookItems.value.findIndex((item) => item.id === tournament.id),
  );
  quickLookOpen.value = true;
}

function stepQuickLook(direction: -1 | 1) {
  const next = quickLookIndex.value + direction;
  if (next >= 0 && next < quickLookItems.value.length) {
    quickLookIndex.value = next;
  }
}

const canCreateTournament = computed(() => {
  const authStore = useAuthStore();
  if (!authStore.me) {
    return false;
  }
  return authStore.isRoleAbove(
    useApplicationSettingsStore().tournamentCreateRole,
  );
});

const sectionClasses = ["mt-8 first:mt-0", tacticalSectionSeparatorClasses];
const seeAllClasses =
  "inline-flex items-center gap-1 text-xs normal-case tracking-normal text-muted-foreground transition-colors hover:text-foreground";
const gridClasses = "grid gap-3 lg:grid-cols-2";
const agendaMonthClasses = "mt-4 grid gap-1.5 first-of-type:mt-0";
const filterOptionClasses =
  "rounded-md border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors duration-150";
const filterOptionActiveClasses =
  "border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)_/_0.12)] text-[hsl(var(--tac-amber))]";
const filterOptionIdleClasses =
  "border-border bg-background/40 text-muted-foreground hover:text-foreground";
const agendaMonthLabelClasses =
  "mb-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground";
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.tournaments.title") }}</h1>

  <PageTransition>
    <div ref="filterRow" class="flex flex-wrap items-center gap-2">
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          :model-value="searchInput"
          @update:model-value="onSearchInput"
          @keydown.enter.prevent="commitSearch"
          :placeholder="$t('pages.tournaments.filter.search_placeholder')"
          :aria-label="$t('pages.tournaments.filter.search_placeholder')"
          class="h-full text-sm"
        />
        <InputGroupAddon align="inline-end" class="pr-2">
          <button
            v-if="searchInput"
            type="button"
            @click="clearSearch"
            class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :aria-label="$t('common.reset_filters')"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>

      <div
        class="max-w-full overflow-x-auto [scrollbar-width:none] max-md:order-last"
      >
        <WatchSegmented
          v-model="statusModel"
          :options="statusOptions"
          :label="$t('common.status')"
        />
      </div>

      <FilterMenu
        class="ml-auto"
        :count="menuFilterCount"
        :active="menuFilterCount > 0"
        :show-reset="hasActiveFilter"
        @reset="clearAllFilters"
      >
        <div class="grid gap-5">
          <div class="grid gap-2">
            <Label>{{ $t("common.date") }}</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in sinceOptions"
                :key="option.value"
                type="button"
                :class="[
                  filterOptionClasses,
                  sinceModel === option.value
                    ? filterOptionActiveClasses
                    : filterOptionIdleClasses,
                ]"
                @click="sinceModel = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="grid gap-2">
            <Label>{{ $t("pages.tournaments.filter.category") }}</Label>
            <CategorySelect v-model="categoryModel" />
          </div>
          <FilterToggle
            v-if="signedIn"
            v-model="mineModel"
            :label="$t('pages.tournaments.filter.mine')"
          />
        </div>
      </FilterMenu>

      <Button
        v-if="canCreateTournament"
        as-child
        size="sm"
        :class="listCreateButtonClasses"
      >
        <NuxtLink
          to="/tournaments/create"
          :title="$t('pages.tournaments.create')"
        >
          <PlusCircle class="h-4 w-4" />
          <span class="max-md:sr-only">{{
            $t("pages.tournaments.create")
          }}</span>
        </NuxtLink>
      </Button>
    </div>
  </PageTransition>

  <FadeSwap class="mt-6">
    <section v-if="hasActiveFilter" key="filtered">
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.tournaments.sections.results") }}
      </div>

      <FadeSwap
        class="transition-opacity duration-200 motion-reduce:transition-none"
        :class="filteredRefreshing && 'pointer-events-none opacity-50'"
      >
        <div v-if="filteredSkeleton" key="loading" class="grid gap-1.5">
          <Skeleton v-for="i in 4" :key="i" class="h-[3.75rem] rounded-lg" />
        </div>

        <div v-else-if="filteredTournaments.length > 0" key="results">
          <div
            v-for="month in byMonth(filteredTournaments)"
            :key="month.key"
            :class="agendaMonthClasses"
          >
            <h3 :class="agendaMonthLabelClasses">{{ month.label }}</h3>
            <TournamentAgendaRow
              v-for="tournament in month.tournaments"
              :key="tournament.id"
              :tournament="tournament"
              @quick-look="openQuickLook(tournament)"
            />
          </div>
        </div>

        <SectionEmpty
          v-else
          key="empty"
          :title="$t('pages.tournaments.filter.no_results_title')"
          :description="$t('pages.tournaments.filter.no_results_description')"
        >
          <Button
            variant="outline"
            size="sm"
            class="h-8"
            @click="clearAllFilters"
          >
            <X class="h-3.5 w-3.5" />
            {{ $t("common.reset_filters") }}
          </Button>
        </SectionEmpty>
      </FadeSwap>

      <Pagination
        v-if="!filteredSkeleton && filteredTotal > perPage"
        class="mt-6"
        :page="page"
        :per-page="perPage"
        :total="filteredTotal"
        @page="setPage"
      />
    </section>

    <div v-else key="curated">
      <!-- Crossfade, not out-in: the old swap faded the skeleton out before
           the sections came in, so the page sat empty in between. The
           skeleton is the strip + agenda rows, the shape most loads land on. -->
      <FadeSwap>
        <div v-if="!curatedReady" key="loading" aria-busy="true">
          <Skeleton class="h-[5.25rem] rounded-xl" />
          <div :class="sectionClasses">
            <Skeleton class="mb-4 h-3 w-28 rounded-sm" />
            <div class="grid gap-1.5">
              <Skeleton
                v-for="i in 4"
                :key="i"
                class="h-[3.75rem] rounded-lg"
              />
            </div>
          </div>
        </div>

        <SectionEmpty
          v-else-if="curatedEmpty"
          key="empty"
          :title="$t('pages.tournaments.empty.title')"
          :description="
            canCreateTournament
              ? $t('pages.tournaments.empty.organizer')
              : $t('pages.tournaments.empty.description')
          "
        >
          <Button
            v-if="canCreateTournament"
            as-child
            size="sm"
            :class="createButtonClasses"
          >
            <NuxtLink to="/tournaments/create">
              <PlusCircle class="h-4 w-4" />
              {{ $t("pages.tournaments.create") }}
            </NuxtLink>
          </Button>
        </SectionEmpty>

        <div v-else key="curated">
          <PageTransition>
            <TournamentNextLan
              v-if="nextLan"
              :tournament="nextLan"
              :hero="lanHero"
              @quick-look="openQuickLook(nextLan)"
            />
          </PageTransition>

          <PageTransition :delay="50">
            <section v-if="live.length" :class="sectionClasses">
              <div :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("pages.tournaments.sections.live") }}
                <span class="tabular-nums tracking-normal text-foreground">{{
                  live.length
                }}</span>
              </div>
              <TournamentLiveFeature :tournament="featured" />
              <div v-if="liveRest.length" :class="[gridClasses, 'mt-3']">
                <WatchTournamentCard
                  v-for="tournament in liveRest"
                  :key="tournament.id"
                  :tournament="tournament"
                  quick-look
                  @quick-look="openQuickLook(tournament)"
                />
              </div>
            </section>
          </PageTransition>

          <PageTransition :delay="100">
            <section v-if="agendaComing.length" :class="sectionClasses">
              <div :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("pages.tournaments.sections.upcoming") }}
                <span class="tabular-nums tracking-normal text-foreground">{{
                  agendaComing.length
                }}</span>
              </div>
              <div
                v-for="month in byMonth(agendaComing)"
                :key="month.key"
                :class="agendaMonthClasses"
              >
                <h3 :class="agendaMonthLabelClasses">{{ month.label }}</h3>
                <TournamentAgendaRow
                  v-for="tournament in month.tournaments"
                  :key="tournament.id"
                  :tournament="tournament"
                  @quick-look="openQuickLook(tournament)"
                />
              </div>
            </section>
          </PageTransition>

          <PageTransition :delay="150">
            <section v-if="recent.length" :class="sectionClasses">
              <div
                :class="[
                  tacticalSectionLabelClasses,
                  '!flex w-full items-center gap-3',
                ]"
              >
                <span class="inline-flex items-center gap-2">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("pages.tournaments.sections.recent") }}
                </span>
                <button
                  type="button"
                  :class="seeAllClasses"
                  @click="statusModel = 'finished'"
                >
                  {{ $t("common.see_all") }}
                  <ArrowRight class="h-3 w-3" />
                </button>
              </div>
              <div
                v-for="month in byMonth(recent)"
                :key="month.key"
                :class="agendaMonthClasses"
              >
                <h3 :class="agendaMonthLabelClasses">{{ month.label }}</h3>
                <TournamentAgendaRow
                  v-for="tournament in month.tournaments"
                  :key="tournament.id"
                  :tournament="tournament"
                />
              </div>
            </section>
          </PageTransition>
        </div>
      </FadeSwap>
    </div>
  </FadeSwap>

  <QuickLookSheet
    v-model:open="quickLookOpen"
    :index="quickLookIndex"
    :total="quickLookItems.length"
    :title="quickLookTournament?.name ?? ''"
    @step="stepQuickLook"
  >
    <TournamentQuickLook
      v-if="quickLookTournament"
      :key="quickLookTournament.id"
      :tournament="quickLookTournament"
    />
  </QuickLookSheet>
</template>
