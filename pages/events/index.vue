<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ArrowRight, PlusCircle, Search, X } from "lucide-vue-next";
import { useSubscription } from "@vue/apollo-composable";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  compactEventFields,
  featuredEventFields,
} from "~/graphql/eventCardFields";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import {
  eventPhase,
  eventPhaseWhere,
  type EventPhase,
} from "~/utilities/eventDisplay";
import { useScrollIntoViewOnChange } from "~/composables/useScrollIntoViewOnChange";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import Pagination from "~/components/Pagination.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import QuickLookSheet from "~/components/common/QuickLookSheet.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import WatchEventCompactCard from "~/components/watch/WatchEventCompactCard.vue";
import EventFeature from "~/components/events/EventFeature.vue";
import EventUpNext from "~/components/events/EventUpNext.vue";
import EventPastTile from "~/components/events/EventPastTile.vue";
import EventQuickLook from "~/components/events/EventQuickLook.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import {
  createButtonClasses,
  listCreateButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionSeparatorClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({
  persistQueryKeys: ["phase", "q", "page", "mine"],
});

// Events are feature-gated (public.events_enabled, default off). Wait for
// settings to load before deciding, so a direct link is not falsely bounced.
const applicationSettingsStore = useApplicationSettingsStore();
watch(
  () => applicationSettingsStore.settings.length,
  () => {
    if (
      applicationSettingsStore.settings.length > 0 &&
      !applicationSettingsStore.eventsEnabled
    ) {
      navigateTo("/");
    }
  },
  { immediate: true },
);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

type PhaseFilter = "all" | "live" | "upcoming" | "past";
const phaseWhere: Record<Exclude<PhaseFilter, "all">, EventPhase> = {
  live: "live",
  upcoming: "upcoming",
  past: "finished",
};

// Captured once so every event lands in exactly one section.
const now = new Date().toISOString();

const phaseFilter = computed<PhaseFilter>(() => {
  const v = route.query.phase;
  return typeof v === "string" && v in phaseWhere ? (v as PhaseFilter) : "all";
});
const nameQuery = computed(() =>
  typeof route.query.q === "string" ? route.query.q : "",
);
const page = computed(() => {
  const n = parseInt(String(route.query.page ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
});
const perPage = 10;

// "Only events I organize": signed-in viewers only.
const me = computed(() => useAuthStore().me);
const mineFilter = computed(() => !!me.value && route.query.mine === "1");

const hasActiveFilter = computed(
  () =>
    phaseFilter.value !== "all" ||
    nameQuery.value.trim().length > 0 ||
    mineFilter.value,
);

function replaceQuery(mutate: (next: Record<string, any>) => void) {
  const next = { ...route.query } as Record<string, any>;
  mutate(next);
  router.replace({ path: route.path, query: next, hash: route.hash });
}

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

const phaseModel = computed<PhaseFilter>({
  get: () => phaseFilter.value,
  set: (v) =>
    replaceQuery((next) => {
      if (v === "all") delete next.phase;
      else next.phase = v;
      delete next.page;
    }),
});

function setPage(p: number) {
  replaceQuery((next) => {
    if (p <= 1) delete next.page;
    else next.page = String(p);
  });
}

const mineModel = computed<boolean>({
  get: () => mineFilter.value,
  set: (v) =>
    replaceQuery((next) => {
      if (v) next.mine = "1";
      else delete next.mine;
      delete next.page;
    }),
});

function clearAllFilters() {
  router.replace({ path: route.path, hash: route.hash });
}

const filterRow = ref<HTMLElement | null>(null);
useScrollIntoViewOnChange(
  filterRow,
  () => `${phaseFilter.value}:${page.value}`,
);

// --- Live and upcoming: small sets, pushed.

function phaseSubscription(
  phase: EventPhase,
  direction: order_by,
  fields: Record<string, unknown>,
) {
  return useSubscription(
    typedGql("subscription")({
      events: [
        {
          where: eventPhaseWhere(phase, $("now", "timestamptz!")),
          order_by: [{ starts_at: direction }],
          limit: 50,
        },
        fields,
      ],
    } as any),
    { now },
  ).result;
}

const liveResult = phaseSubscription(
  "live",
  order_by.desc,
  featuredEventFields,
);
const upcomingResult = phaseSubscription(
  "upcoming",
  order_by.asc,
  compactEventFields,
);

const liveEvents = computed<any[]>(
  () => (liveResult.value as any)?.events ?? [],
);
const upcomingAll = computed<any[]>(
  () => (upcomingResult.value as any)?.events ?? [],
);

const upNext = computed(
  () => upcomingAll.value.find((event) => event.starts_at) ?? null,
);
const featured = computed(() => liveEvents.value[0] ?? null);
const liveRest = computed(() => liveEvents.value.slice(1));
const upcoming = computed(() =>
  upcomingAll.value.filter((event) => event.id !== upNext.value?.id),
);
const UPCOMING_SHOWN = 4;

// Nothing live and nothing else coming: the next event gets the full card.
const upNextHero = computed(
  () => !liveEvents.value.length && !upcoming.value.length,
);

const phaseOptions = computed(() => [
  { key: "all" as const, label: t("pages.events.filter.all") },
  {
    key: "live" as const,
    label: t("pages.events.filter.live"),
    count: liveEvents.value.length || null,
  },
  {
    key: "upcoming" as const,
    label: t("pages.events.filter.upcoming"),
    count: upcomingAll.value.length || null,
  },
  { key: "past" as const, label: t("pages.events.filter.past") },
]);

// --- Past events: paged in as the row scrolls.

const PAST_PAGE = 12;
const past = ref<any[]>([]);
const pastDone = ref(false);
const pastLoaded = ref(false);
let pastInFlight = false;
const pastRow = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);

function eventsQuery(withCount: boolean) {
  return generateQuery({
    events: [
      {
        where: $("where", "events_bool_exp!"),
        order_by: $("order_by", "[events_order_by!]!"),
        limit: $("limit", "Int!"),
        offset: $("offset", "Int!"),
      } as any,
      compactEventFields,
    ],
    ...(withCount
      ? {
          events_aggregate: [
            { where: $("where", "events_bool_exp!") } as any,
            { aggregate: { count: true } },
          ],
        }
      : {}),
  } as any);
}

async function loadPast() {
  if (pastDone.value || pastInFlight) return;
  pastInFlight = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: eventsQuery(false),
      variables: {
        where: eventPhaseWhere("finished", now),
        order_by: [{ starts_at: order_by.desc }],
        limit: PAST_PAGE,
        offset: past.value.length,
      },
      fetchPolicy: "network-only",
    });
    const rows = (data as any)?.events ?? [];
    past.value = [...past.value, ...rows];
    if (rows.length < PAST_PAGE) pastDone.value = true;
  } catch (err) {
    console.error("[events] past fetch error:", err);
    pastDone.value = true;
  } finally {
    pastInFlight = false;
    pastLoaded.value = true;
  }
}

onMounted(loadPast);

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
      upcomingResult.value !== undefined &&
      pastLoaded.value),
);
const curatedEmpty = computed(
  () =>
    !liveEvents.value.length && !upcomingAll.value.length && !past.value.length,
);

// --- Filtered view

const filteredEvents = ref<any[]>([]);
const filteredTotal = ref(0);
const filteredLoading = ref(false);

// Shapes on the first filtered load only; a refetch keeps the results up, dimmed.
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

let filterFetchId = 0;
async function fetchFiltered() {
  const myId = ++filterFetchId;
  filteredLoading.value = true;
  const where: Record<string, any> =
    phaseFilter.value === "all"
      ? {}
      : eventPhaseWhere(phaseWhere[phaseFilter.value], now);
  const q = nameQuery.value.trim();
  if (q) {
    Object.assign(where, { name: { _ilike: `%${q}%` } });
  }
  if (mineFilter.value && me.value) {
    where._and = [
      ...(where._and ?? []),
      {
        _or: [
          { organizer_steam_id: { _eq: me.value.steam_id } },
          { organizers: { steam_id: { _eq: me.value.steam_id } } },
        ],
      },
    ];
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: eventsQuery(true),
      variables: {
        where,
        order_by: [
          {
            starts_at:
              phaseFilter.value === "live" || phaseFilter.value === "upcoming"
                ? order_by.asc
                : order_by.desc,
          },
        ],
        limit: perPage,
        offset: (page.value - 1) * perPage,
      },
      fetchPolicy: "network-only",
    });
    if (myId !== filterFetchId) return;
    filteredEvents.value = (data as any)?.events ?? [];
    filteredTotal.value =
      (data as any)?.events_aggregate?.aggregate?.count ?? 0;
  } catch (err) {
    if (myId === filterFetchId) {
      console.error("[events] filtered fetch error:", err);
      filteredEvents.value = [];
      filteredTotal.value = 0;
    }
  } finally {
    if (myId === filterFetchId) filteredLoading.value = false;
  }
}

watch(
  [hasActiveFilter, phaseFilter, nameQuery, mineFilter, page],
  () => {
    if (hasActiveFilter.value) {
      fetchFiltered();
    } else {
      filteredEvents.value = [];
      filteredTotal.value = 0;
    }
  },
  { immediate: true },
);

// --- Quick look (past events link straight to their page)

const quickLookOpen = ref(false);
const quickLookIndex = ref(0);

const quickLookItems = computed<any[]>(() =>
  hasActiveFilter.value
    ? filteredEvents.value.filter((event) => eventPhase(event) !== "finished")
    : [
        upNext.value,
        ...liveRest.value,
        ...upcoming.value.slice(0, UPCOMING_SHOWN),
      ].filter(Boolean),
);
const quickLookEvent = computed(
  () => quickLookItems.value[quickLookIndex.value] ?? null,
);

function openQuickLook(event: any) {
  quickLookIndex.value = Math.max(
    0,
    quickLookItems.value.findIndex((item) => item.id === event.id),
  );
  quickLookOpen.value = true;
}

function stepQuickLook(direction: -1 | 1) {
  const next = quickLookIndex.value + direction;
  if (next >= 0 && next < quickLookItems.value.length) {
    quickLookIndex.value = next;
  }
}

// Gate on the same setting the backend authorizes event inserts with
// (public.create_events_role), so the button's visibility matches the
// server's actual permission.
const canCreateEvent = computed(() => {
  const authStore = useAuthStore();
  if (!authStore.me) return false;
  return authStore.isRoleAbove(applicationSettingsStore.eventCreateRole);
});

const sectionClasses = ["mt-8 first:mt-0", tacticalSectionSeparatorClasses];
const seeAllClasses =
  "inline-flex items-center gap-1 text-xs normal-case tracking-normal text-muted-foreground transition-colors hover:text-foreground";
const gridClasses = "grid gap-3 sm:grid-cols-2";
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.events.title") }}</h1>

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
          :placeholder="$t('pages.events.filter.search_placeholder')"
          :aria-label="$t('pages.events.filter.search_placeholder')"
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
          v-model="phaseModel"
          :options="phaseOptions"
          :label="$t('common.status')"
        />
      </div>

      <Button
        v-if="hasActiveFilter"
        variant="ghost"
        size="sm"
        class="h-8 text-muted-foreground hover:text-foreground max-md:w-8 max-md:px-0"
        :title="$t('common.reset_filters')"
        @click="clearAllFilters"
      >
        <X class="h-3.5 w-3.5" />
        <span class="max-md:sr-only">{{ $t("common.reset_filters") }}</span>
      </Button>

      <FilterMenu
        v-if="me"
        class="ml-auto"
        :count="mineFilter ? 1 : 0"
        :active="mineFilter"
        :show-reset="mineFilter"
        content-class="w-[min(90vw,320px)] p-4"
        @reset="mineModel = false"
      >
        <FilterToggle
          v-model="mineModel"
          :label="$t('pages.events.filter.mine')"
        />
      </FilterMenu>

      <Button
        v-if="canCreateEvent"
        as-child
        size="sm"
        :class="listCreateButtonClasses"
      >
        <NuxtLink
          :to="{ name: 'events-create' }"
          :title="$t('pages.events.create')"
        >
          <PlusCircle class="h-4 w-4" />
          <span class="max-md:sr-only">{{ $t("pages.events.create") }}</span>
        </NuxtLink>
      </Button>
    </div>
  </PageTransition>

  <FadeSwap class="mt-6">
    <section v-if="hasActiveFilter" key="filtered">
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.events.sections.results") }}
      </div>

      <FadeSwap
        class="transition-opacity duration-200 motion-reduce:transition-none"
        :class="filteredRefreshing && 'pointer-events-none opacity-50'"
      >
        <div v-if="filteredSkeleton" key="loading" :class="gridClasses">
          <Skeleton v-for="i in 4" :key="i" class="h-[7.75rem] rounded-lg" />
        </div>
        <div
          v-else-if="filteredEvents.length > 0"
          key="results"
          :class="gridClasses"
        >
          <WatchEventCompactCard
            v-for="event in filteredEvents"
            :key="event.id"
            :event="event"
            :quick-look="eventPhase(event) !== 'finished'"
            @quick-look="openQuickLook(event)"
          />
        </div>
        <SectionEmpty
          v-else
          key="empty"
          :title="$t('pages.events.filter.no_results_title')"
          :description="$t('pages.events.filter.no_results_description')"
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
           skeleton is the Up next strip + a card grid. -->
      <FadeSwap>
        <div v-if="!curatedReady" key="loading" aria-busy="true">
          <Skeleton class="h-[5.25rem] rounded-xl" />
          <div :class="sectionClasses">
            <Skeleton class="mb-4 h-3 w-28 rounded-sm" />
            <div :class="gridClasses">
              <Skeleton
                v-for="i in 4"
                :key="i"
                class="h-[7.75rem] rounded-lg"
              />
            </div>
          </div>
        </div>

        <SectionEmpty
          v-else-if="curatedEmpty"
          key="empty"
          :title="$t('pages.events.no_events_title')"
          :description="$t('pages.events.no_events_description')"
        >
          <Button
            v-if="canCreateEvent"
            as-child
            size="sm"
            :class="createButtonClasses"
          >
            <NuxtLink :to="{ name: 'events-create' }">
              <PlusCircle class="h-4 w-4" />
              {{ $t("pages.events.create") }}
            </NuxtLink>
          </Button>
        </SectionEmpty>

        <div v-else key="curated">
          <PageTransition>
            <EventUpNext
              v-if="upNext"
              :event="upNext"
              :hero="upNextHero"
              @quick-look="openQuickLook(upNext)"
            />
          </PageTransition>

          <PageTransition :delay="50">
            <section v-if="featured" :class="sectionClasses">
              <div :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("pages.events.sections.live") }}
                <span class="tabular-nums tracking-normal text-foreground">{{
                  liveEvents.length
                }}</span>
              </div>
              <EventFeature :event="featured" />
              <div v-if="liveRest.length" :class="[gridClasses, 'mt-3']">
                <WatchEventCompactCard
                  v-for="event in liveRest"
                  :key="event.id"
                  :event="event"
                  quick-look
                  @quick-look="openQuickLook(event)"
                />
              </div>
            </section>
          </PageTransition>

          <PageTransition :delay="100">
            <section v-if="upcoming.length" :class="sectionClasses">
              <div
                :class="[
                  tacticalSectionLabelClasses,
                  '!flex w-full items-center gap-3',
                ]"
              >
                <span class="inline-flex items-center gap-2">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("pages.events.sections.upcoming") }}
                  <span class="tabular-nums tracking-normal text-foreground">{{
                    upcoming.length
                  }}</span>
                </span>
                <button
                  v-if="upcoming.length > UPCOMING_SHOWN"
                  type="button"
                  :class="seeAllClasses"
                  @click="phaseModel = 'upcoming'"
                >
                  {{ $t("common.see_all") }}
                  <ArrowRight class="h-3 w-3" />
                </button>
              </div>
              <div :class="gridClasses">
                <WatchEventCompactCard
                  v-for="event in upcoming.slice(0, UPCOMING_SHOWN)"
                  :key="event.id"
                  :event="event"
                  quick-look
                  @quick-look="openQuickLook(event)"
                />
              </div>
            </section>
          </PageTransition>

          <PageTransition :delay="150">
            <section v-if="past.length" :class="sectionClasses">
              <div
                :class="[
                  tacticalSectionLabelClasses,
                  '!flex w-full items-center justify-between',
                ]"
              >
                <span class="inline-flex items-center gap-3">
                  <span class="inline-flex items-center gap-2">
                    <span :class="tacticalSectionTickClasses"></span>
                    {{ $t("pages.events.sections.past") }}
                  </span>
                  <button
                    type="button"
                    :class="seeAllClasses"
                    @click="phaseModel = 'past'"
                  >
                    {{ $t("common.see_all") }}
                    <ArrowRight class="h-3 w-3" />
                  </button>
                </span>
                <ScrollArrows
                  :can-left="pastRow?.state?.canScrollLeft"
                  :can-right="pastRow?.state?.canScrollRight || !pastDone"
                  @scroll="
                    (direction) => {
                      pastRow?.scrollByDirection(direction);
                      if (direction === 'right') loadPast();
                    }
                  "
                />
              </div>
              <HorizontalScrollRow ref="pastRow" @approaching-end="loadPast">
                <EventPastTile
                  v-for="event in past"
                  :key="event.id"
                  :event="event"
                />
              </HorizontalScrollRow>
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
    :title="quickLookEvent?.name ?? ''"
    @step="stepQuickLook"
  >
    <EventQuickLook
      v-if="quickLookEvent"
      :key="quickLookEvent.id"
      :event="quickLookEvent"
    />
  </QuickLookSheet>
</template>
