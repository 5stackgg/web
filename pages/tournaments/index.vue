<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ArrowRight, CalendarDays, PlusCircle, Search, X } from "lucide-vue-next";
import { useSubscription } from "@vue/apollo-composable";
import { useScrollIntoViewOnChange } from "~/composables/useScrollIntoViewOnChange";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { tournamentCardFields } from "~/graphql/tournamentCardFields";
import { excludeLeagueTournaments } from "~/graphql/tournamentFilters";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Pagination from "~/components/Pagination.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import QuickLookSheet from "~/components/common/QuickLookSheet.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import WatchTournamentCard from "~/components/watch/WatchTournamentCard.vue";
import TournamentNextLan from "~/components/tournament/TournamentNextLan.vue";
import TournamentLiveFeature from "~/components/tournament/TournamentLiveFeature.vue";
import TournamentResultTile from "~/components/tournament/TournamentResultTile.vue";
import TournamentQuickLook from "~/components/tournament/TournamentQuickLook.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionSeparatorClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Keep filter query params out of the NuxtPage page-key (app.vue) so applying a
// filter updates the URL without remounting/refreshing the whole page.
definePageMeta({
  persistQueryKeys: ["status", "since", "q", "page"],
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

const page = computed<number>(() => {
  const v = route.query.page;
  const n = typeof v === "string" ? parseInt(v, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
});

const perPage = 10;

const hasActiveFilter = computed(
  () =>
    statusFilter.value !== "all" ||
    sinceFilter.value !== "all" ||
    nameQuery.value.trim().length > 0,
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

function setPage(p: number) {
  replaceQuery((next) => {
    if (p <= 1) delete next.page;
    else next.page = String(p);
  });
}

// "See all" and paging both land the new list above a scrolled-down reader.
const filterRow = ref<HTMLElement | null>(null);
useScrollIntoViewOnChange(filterRow, () => `${statusFilter.value}:${page.value}`);

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
const openTournaments = computed(() =>
  coming.value.filter(
    (tournament) =>
      tournament.status === e_tournament_status_enum.RegistrationOpen &&
      tournament.id !== nextLan.value?.id,
  ),
);
const upcomingTournaments = computed(() =>
  coming.value.filter(
    (tournament) =>
      tournament.status !== e_tournament_status_enum.RegistrationOpen &&
      tournament.id !== nextLan.value?.id,
  ),
);
const UPCOMING_SHOWN = 4;

// With nothing live and nothing else coming up, the LAN is the page: give it
// the full card so it doesn't sit alone as a thin strip.
const lanHero = computed(
  () =>
    !live.value.length &&
    !openTournaments.value.length &&
    !upcomingTournaments.value.length,
);

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

// --- Recent results: paged in as the row scrolls.

const RECENT_PAGE = 12;
const recent = ref<any[]>([]);
const recentDone = ref(false);
const recentLoaded = ref(false);
let recentInFlight = false;
const recentRow = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);

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
  return where;
});

const filteredOrder = computed(() => [
  { start: statusFilter.value === "finished" ? order_by.desc : order_by.asc },
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
  [hasActiveFilter, statusFilter, sinceFilter, nameQuery, page],
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

const quickLookItems = computed<any[]>(() =>
  hasActiveFilter.value
    ? filteredTournaments.value
    : [
        nextLan.value,
        ...liveRest.value,
        ...openTournaments.value,
        ...upcomingTournaments.value.slice(0, UPCOMING_SHOWN),
        ...recent.value,
      ].filter(Boolean),
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
</script>

<template>
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

      <div class="max-w-full overflow-x-auto [scrollbar-width:none]">
        <WatchSegmented
          v-model="statusModel"
          :options="statusOptions"
          :label="$t('common.status')"
        />
      </div>

      <Select v-model="sinceModel">
        <SelectTrigger
          class="h-8 w-auto gap-2 text-xs"
          :aria-label="$t('common.date')"
        >
          <CalendarDays class="h-3.5 w-3.5 opacity-70" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem
            v-for="option in sinceOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        v-if="hasActiveFilter"
        variant="ghost"
        size="sm"
        class="h-8 text-muted-foreground hover:text-foreground"
        @click="clearAllFilters"
      >
        <X class="h-3.5 w-3.5" />
        {{ $t("common.reset_filters") }}
      </Button>

      <Button
        v-if="canCreateTournament"
        as-child
        size="sm"
        class="ml-auto h-8 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
      >
        <NuxtLink to="/tournaments/create">
          <PlusCircle class="h-4 w-4" />
          {{ $t("pages.tournaments.create") }}
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
        <div v-if="filteredSkeleton" key="loading" :class="gridClasses">
          <Skeleton v-for="i in 4" :key="i" class="h-[11rem] rounded-lg" />
        </div>

        <div
          v-else-if="filteredTournaments.length > 0"
          key="results"
          :class="gridClasses"
        >
          <WatchTournamentCard
            v-for="tournament in filteredTournaments"
            :key="tournament.id"
            :tournament="tournament"
            quick-look
            @quick-look="openQuickLook(tournament)"
          />
        </div>

        <Empty v-else key="empty" class="min-h-[200px]">
          <EmptyTitle>{{
            $t("pages.tournaments.filter.no_results_title")
          }}</EmptyTitle>
          <EmptyDescription>{{
            $t("pages.tournaments.filter.no_results_description")
          }}</EmptyDescription>
        </Empty>
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
      <PageTransition :delay="60" swap>
        <div v-if="!curatedReady" key="loading" class="space-y-6">
          <Skeleton class="h-[4.75rem] rounded-lg" />
          <Skeleton class="h-[34rem] rounded-lg" />
        </div>

        <Empty v-else-if="curatedEmpty" key="empty" class="min-h-[200px]">
          <EmptyTitle>{{ $t("pages.tournaments.empty.title") }}</EmptyTitle>
          <EmptyDescription>{{
            canCreateTournament
              ? $t("pages.tournaments.empty.organizer")
              : $t("pages.tournaments.empty.description")
          }}</EmptyDescription>
        </Empty>

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
            <section v-if="openTournaments.length" :class="sectionClasses">
              <div :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("pages.tournaments.sections.open") }}
                <span class="tabular-nums tracking-normal text-foreground">{{
                  openTournaments.length
                }}</span>
              </div>
              <div :class="gridClasses">
                <WatchTournamentCard
                  v-for="tournament in openTournaments"
                  :key="tournament.id"
                  :tournament="tournament"
                  quick-look
                  @quick-look="openQuickLook(tournament)"
                />
              </div>
            </section>
          </PageTransition>

          <PageTransition :delay="150">
            <section v-if="upcomingTournaments.length" :class="sectionClasses">
              <div
                :class="[
                  tacticalSectionLabelClasses,
                  '!flex w-full items-center gap-3',
                ]"
              >
                <span class="inline-flex items-center gap-2">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("pages.tournaments.sections.upcoming") }}
                  <span class="tabular-nums tracking-normal text-foreground">{{
                    upcomingTournaments.length
                  }}</span>
                </span>
                <button
                  v-if="upcomingTournaments.length > UPCOMING_SHOWN"
                  type="button"
                  :class="seeAllClasses"
                  @click="statusModel = 'upcoming'"
                >
                  {{ $t("common.see_all") }}
                  <ArrowRight class="h-3 w-3" />
                </button>
              </div>
              <div :class="gridClasses">
                <WatchTournamentCard
                  v-for="tournament in upcomingTournaments.slice(
                    0,
                    UPCOMING_SHOWN,
                  )"
                  :key="tournament.id"
                  :tournament="tournament"
                  quick-look
                  @quick-look="openQuickLook(tournament)"
                />
              </div>
            </section>
          </PageTransition>

          <PageTransition :delay="200">
            <section v-if="recent.length" :class="sectionClasses">
              <div
                :class="[
                  tacticalSectionLabelClasses,
                  '!flex w-full items-center justify-between',
                ]"
              >
                <span class="inline-flex items-center gap-3">
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
                </span>
                <ScrollArrows
                  :can-left="recentRow?.state?.canScrollLeft"
                  :can-right="recentRow?.state?.canScrollRight || !recentDone"
                  @scroll="
                    (direction) => {
                      recentRow?.scrollByDirection(direction);
                      if (direction === 'right') loadRecent();
                    }
                  "
                />
              </div>
              <HorizontalScrollRow ref="recentRow" @approaching-end="loadRecent">
                <TournamentResultTile
                  v-for="tournament in recent"
                  :key="tournament.id"
                  :tournament="tournament"
                  @quick-look="openQuickLook(tournament)"
                />
              </HorizontalScrollRow>
            </section>
          </PageTransition>
        </div>
      </PageTransition>
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
