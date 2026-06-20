<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Activity,
  Calendar,
  Check,
  ChevronDown,
  PlusCircle,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Pagination from "~/components/Pagination.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import TournamentFeatureCard from "~/components/tournament/TournamentFeatureCard.vue";
import RecentTournaments from "~/components/tournament/RecentTournaments.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Compact filter-bar trigger buttons — each opens a popover.
const filterTriggerBase =
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] leading-none transition-colors duration-150 cursor-pointer";
const filterTriggerIdle =
  "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground";
const filterTriggerActive =
  "border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]";

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
  ],
  finished: [
    e_tournament_status_enum.Finished,
    e_tournament_status_enum.Cancelled,
    e_tournament_status_enum.CancelledMinTeams,
  ],
};

const statusVariantFor: Record<
  Exclude<StatusFilter, "all">,
  "live" | "registration" | "default" | "finished"
> = {
  live: "live",
  registration: "registration",
  upcoming: "default",
  finished: "finished",
};

const sinceMillis: Record<SincePreset, number> = {
  all: 0,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "6m": 182 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
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

function commitSearch() {
  const next = { ...route.query } as Record<string, any>;
  const trimmed = searchInput.value.trim();
  if (trimmed) next.q = trimmed;
  else delete next.q;
  delete next.page;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function clearSearch() {
  searchInput.value = "";
  commitSearch();
}

function setStatus(v: StatusFilter) {
  const next = { ...route.query } as Record<string, any>;
  if (v === "all") delete next.status;
  else next.status = v;
  delete next.page;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function setSince(v: SincePreset) {
  const next = { ...route.query } as Record<string, any>;
  if (v === "all") delete next.since;
  else next.since = v;
  delete next.page;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function setPage(p: number) {
  const next = { ...route.query } as Record<string, any>;
  if (p <= 1) delete next.page;
  else next.page = String(p);
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function clearAllFilters() {
  router.replace({ path: route.path, hash: route.hash });
}

const statusOptions = computed<Array<{ value: StatusFilter; label: string }>>(
  () => [
    { value: "all", label: t("pages.tournaments.filter.status_all") },
    { value: "live", label: t("pages.tournaments.filter.status_live") },
    {
      value: "registration",
      label: t("pages.tournaments.filter.status_registration"),
    },
    { value: "upcoming", label: t("pages.tournaments.filter.status_upcoming") },
    { value: "finished", label: t("pages.tournaments.filter.status_finished") },
  ],
);

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

const currentStatusLabel = computed(
  () =>
    statusOptions.value.find((o) => o.value === statusFilter.value)?.label ??
    "",
);
const currentSinceLabel = computed(
  () =>
    sinceOptions.value.find((o) => o.value === sinceFilter.value)?.label ?? "",
);

// --- Drilldown / filtered list ---

const filteredTournaments = ref<any[]>([]);
const filteredTotal = ref(0);
const filteredLoading = ref(false);

function sinceCutoffIso(preset: SincePreset): string | null {
  const ms = sinceMillis[preset];
  if (!ms) return null;
  return new Date(Date.now() - ms).toISOString();
}

const filterWhere = computed<Record<string, any>>(() => {
  const where: Record<string, any> = {};
  if (statusFilter.value !== "all") {
    where.status = { _in: statusGroups[statusFilter.value] };
  }
  const q = nameQuery.value.trim();
  if (q) {
    where.name = { _ilike: `%${q}%` };
  }
  const cutoff = sinceCutoffIso(sinceFilter.value);
  if (cutoff) {
    where.start = { _gte: cutoff };
  }
  return where;
});

const filteredOrder = computed(() => {
  if (statusFilter.value === "finished") {
    return [{ start: order_by.desc }];
  }
  return [{ start: order_by.asc }];
});

let filterFetchId = 0;
async function fetchFiltered() {
  if (!hasActiveFilter.value) return;
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
          simpleTournamentFields,
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

const drilldownVariant = computed(() => {
  if (statusFilter.value === "all") return "default" as const;
  return statusVariantFor[statusFilter.value];
});

const drilldownLabel = computed(() => {
  switch (statusFilter.value) {
    case "live":
      return t("common.live");
    case "registration":
      return t("pages.tournaments.open_for_registration");
    case "upcoming":
      return t("pages.tournaments.tabs.upcoming");
    case "finished":
      return t("common.finished");
    default:
      return undefined;
  }
});

const seeAllRegistration = {
  path: "/tournaments",
  query: { status: "registration" },
};
const seeAllUpcoming = { path: "/tournaments", query: { status: "upcoming" } };
const seeAllFinished = { path: "/tournaments", query: { status: "finished" } };
</script>

<template>
  <PageTransition>
    <TacticalPageHeader inline-actions>
      <template #title>{{ $t("pages.tournaments.title") }}</template>
      <template #actions>
        <NuxtLink
          v-if="canCreateTournament"
          to="/tournaments/create"
          :class="[
            tacticalCtaButtonClasses,
            tacticalHeaderActionClasses,
            'max-lg:aspect-square max-lg:!px-0',
          ]"
          :title="$t('pages.tournaments.create')"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden lg:inline">{{
            $t("pages.tournaments.create")
          }}</span>
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="60" class="mt-6">
    <div
      class="relative rounded-md border border-border bg-card/40 [backdrop-filter:blur(6px)] px-3 py-2.5 transition-shadow duration-200"
      :class="
        hasActiveFilter &&
        '[box-shadow:0_0_0_1px_hsl(var(--tac-amber)/0.18),0_0_28px_-14px_hsl(var(--tac-amber)/0.5)]'
      "
    >
      <!-- Primary bar: name search + status inline, the rest behind Filters. -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Name search (always visible) -->
        <div class="relative min-w-[12rem] flex-1">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
          />
          <Input
            :model-value="searchInput"
            @update:model-value="onSearchInput"
            @keydown.enter.prevent="commitSearch"
            :placeholder="$t('pages.tournaments.filter.search_placeholder')"
            class="h-9 pl-8 pr-8 text-sm"
          />
          <button
            v-if="searchInput"
            type="button"
            @click="clearSearch"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :aria-label="$t('common.reset_filters')"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>

        <!-- Status (always visible) -->
        <Popover>
          <PopoverTrigger as-child>
            <button
              type="button"
              :class="[
                filterTriggerBase,
                'h-9',
                statusFilter !== 'all'
                  ? filterTriggerActive
                  : filterTriggerIdle,
              ]"
            >
              <Activity class="h-3.5 w-3.5" />
              {{ $t("common.status") }}
              <span
                v-if="statusFilter !== 'all'"
                class="font-sans text-[0.6rem] font-bold normal-case tracking-normal text-[hsl(var(--tac-amber))]"
              >
                {{ currentStatusLabel }}
              </span>
              <ChevronDown class="h-3 w-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-48 p-1">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              type="button"
              @click="setStatus(opt.value)"
              class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
            >
              <span>{{ opt.label }}</span>
              <Check
                v-if="statusFilter === opt.value"
                class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
              />
            </button>
          </PopoverContent>
        </Popover>

        <!-- Filters (the rest: date) -->
        <Popover>
          <PopoverTrigger as-child>
            <button
              type="button"
              :class="[
                filterTriggerBase,
                'h-9',
                sinceFilter !== 'all' ? filterTriggerActive : filterTriggerIdle,
              ]"
            >
              <SlidersHorizontal class="h-3.5 w-3.5" />
              {{ $t("common.filters") }}
              <span
                v-if="sinceFilter !== 'all'"
                class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[hsl(var(--tac-amber)/0.25)] px-1 font-sans text-[0.6rem] font-bold leading-none text-[hsl(var(--tac-amber))]"
              >
                1
              </span>
              <ChevronDown class="h-3 w-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-52 p-2 space-y-1">
            <span
              class="block px-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {{ $t("common.date") }}
            </span>
            <button
              v-for="opt in sinceOptions"
              :key="opt.value"
              type="button"
              @click="setSince(opt.value)"
              class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
            >
              <span>{{ opt.label }}</span>
              <Check
                v-if="sinceFilter === opt.value"
                class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
              />
            </button>
          </PopoverContent>
        </Popover>

        <div class="ml-auto flex items-center gap-3 pl-2">
          <span
            v-if="hasActiveFilter"
            class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground/80"
          >
            {{ filteredTotal }} {{ $t("common.results") }}
          </span>
          <button
            type="button"
            :disabled="!hasActiveFilter"
            @click="clearAllFilters"
            class="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
          >
            <X class="h-3 w-3" />
            {{ $t("common.reset_filters") }}
          </button>
        </div>
      </div>

      <!-- Active filters — removable chips -->
      <div
        v-if="hasActiveFilter"
        class="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5"
      >
        <span v-if="statusFilter !== 'all'" class="tac-chip">
          <span class="text-xs text-foreground/90">{{
            currentStatusLabel
          }}</span>
          <button type="button" @click="setStatus('all')" class="tac-chip-x">
            <X class="h-3 w-3" />
          </button>
        </span>
        <span v-if="sinceFilter !== 'all'" class="tac-chip">
          <span class="text-xs text-foreground/90">{{
            currentSinceLabel
          }}</span>
          <button type="button" @click="setSince('all')" class="tac-chip-x">
            <X class="h-3 w-3" />
          </button>
        </span>
        <span v-if="nameQuery" class="tac-chip">
          <span class="text-xs text-foreground/90 truncate max-w-[180px]">
            "{{ nameQuery }}"
          </span>
          <button type="button" @click="clearSearch" class="tac-chip-x">
            <X class="h-3 w-3" />
          </button>
        </span>
      </div>
    </div>
  </PageTransition>

  <!-- Drilldown / filtered view -->
  <template v-if="hasActiveFilter">
    <PageTransition :delay="100" class="mt-6">
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.tournaments.section_results") }}
      </div>
    </PageTransition>

    <PageTransition v-if="filteredLoading" :delay="120" class="mt-3">
      <div class="space-y-4">
        <Skeleton v-for="i in 4" :key="i" class="h-40 w-full rounded-md" />
      </div>
    </PageTransition>

    <PageTransition
      v-else-if="filteredTournaments.length > 0"
      :delay="120"
      class="mt-3"
    >
      <div class="space-y-4">
        <TournamentFeatureCard
          v-for="tournament in filteredTournaments"
          :key="tournament.id"
          :tournament="tournament"
          :status-variant="drilldownVariant"
          :status-label="drilldownLabel"
        />
      </div>
    </PageTransition>

    <PageTransition v-else :delay="120" class="mt-3">
      <Empty class="min-h-[200px]">
        <EmptyTitle>{{
          $t("pages.tournaments.filter.no_results_title")
        }}</EmptyTitle>
        <EmptyDescription>{{
          $t("pages.tournaments.filter.no_results_description")
        }}</EmptyDescription>
      </Empty>
    </PageTransition>

    <Pagination
      v-if="!filteredLoading && filteredTotal > perPage"
      class="mt-6"
      :page="page"
      :per-page="perPage"
      :total="filteredTotal"
      @page="setPage"
    />
  </template>

  <!-- Curated section view (no active filters) -->
  <template v-else>
    <PageTransition
      v-if="
        !loadingLive &&
        liveTournaments.length === 0 &&
        registrationOpenTournaments.length === 0
      "
      :delay="100"
      class="mt-6"
    >
      <Empty class="min-h-[180px]">
        <EmptyTitle>{{
          $t("pages.tournaments.no_tournaments_title")
        }}</EmptyTitle>
        <EmptyDescription>{{
          $t("pages.tournaments.no_tournaments_description")
        }}</EmptyDescription>
      </Empty>
    </PageTransition>

    <PageTransition v-if="liveTournaments.length > 0" :delay="100" class="mt-6">
      <section class="space-y-4">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.tournaments.section_live") }}
        </div>
        <div class="space-y-4">
          <TournamentFeatureCard
            v-for="tournament in liveTournaments"
            :key="tournament.id"
            :tournament="tournament"
            status-variant="live"
            :status-label="$t('common.live')"
          />
        </div>
      </section>
    </PageTransition>

    <PageTransition
      v-if="registrationOpenTournaments.length > 0"
      :delay="125"
      class="mt-6"
    >
      <section class="space-y-4">
        <div
          :class="[
            tacticalSectionLabelClasses,
            '!flex w-full items-center justify-between',
          ]"
        >
          <span class="inline-flex items-center gap-2">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.tournaments.section_registration") }}
          </span>
          <NuxtLink
            :to="seeAllRegistration"
            class="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors normal-case"
          >
            {{ $t("tournament.recent.see_all") }}
          </NuxtLink>
        </div>
        <div class="space-y-4">
          <TournamentFeatureCard
            v-for="tournament in registrationOpenTournaments"
            :key="tournament.id"
            :tournament="tournament"
            status-variant="registration"
            :status-label="$t('pages.tournaments.open_for_registration')"
          />
        </div>
      </section>
    </PageTransition>

    <PageTransition :delay="150" class="mt-6">
      <RecentTournaments
        :section-label="$t('pages.tournaments.section_upcoming')"
        :statuses="[
          e_tournament_status_enum.RegistrationClosed,
          e_tournament_status_enum.Setup,
        ]"
        status-variant="registration"
        :status-label="$t('pages.tournaments.tabs.upcoming')"
        order-direction="asc"
        hide-when-empty
        :limit="4"
        :see-all-to="seeAllUpcoming"
      />
    </PageTransition>

    <PageTransition :delay="175" class="mt-6">
      <RecentTournaments
        :section-label="$t('pages.tournaments.section_recent')"
        :statuses="[
          e_tournament_status_enum.Finished,
          e_tournament_status_enum.Cancelled,
          e_tournament_status_enum.CancelledMinTeams,
        ]"
        status-variant="finished"
        :status-label="$t('common.finished')"
        order-direction="desc"
        horizontal
        hide-when-empty
        :limit="12"
        :see-all-to="seeAllFinished"
      />
    </PageTransition>
  </template>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";

export default {
  data() {
    return {
      liveTournaments: [] as any[],
      registrationOpenTournaments: [] as any[],
      loadingLive: true,
    };
  },
  apollo: {
    $subscribe: {
      liveTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              where: {
                status: {
                  _eq: $("status", "e_tournament_status_enum"),
                },
              },
              order_by: [
                {},
                {
                  start: order_by.asc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            status: e_tournament_status_enum.Live,
          };
        },
        skip(this: any) {
          const q = this.$route?.query || {};
          return !!(q.status || q.q || q.since);
        },
        result: function ({ data }: { data: any }) {
          this.liveTournaments = data?.tournaments || [];
          this.loadingLive = false;
        },
      },
      registrationOpenTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              where: {
                status: {
                  _eq: $("status", "e_tournament_status_enum"),
                },
              },
              order_by: [
                {},
                {
                  start: order_by.asc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            status: e_tournament_status_enum.RegistrationOpen,
          };
        },
        skip(this: any) {
          const q = this.$route?.query || {};
          return !!(q.status || q.q || q.since);
        },
        result: function ({ data }: { data: any }) {
          this.registrationOpenTournaments = data?.tournaments || [];
        },
      },
    },
  },
  computed: {
    canCreateTournament() {
      const me = useAuthStore().me;
      if (!me) {
        return false;
      }
      return useAuthStore().isRoleAbove(
        useApplicationSettingsStore().tournamentCreateRole,
      );
    },
  },
};
</script>

<style scoped>
/* Soft amber chip — no border, fill-only. */
.tac-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.45rem 0.2rem 0.55rem;
  background: hsl(var(--tac-amber) / 0.08);
  border-radius: 2px;
  font-feature-settings:
    "tnum" on,
    "cv11" on;
  transition: background 150ms ease;
}
.tac-chip:hover {
  background: hsl(var(--tac-amber) / 0.14);
}
.tac-chip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--tac-amber) / 0.55);
  margin-left: 0.1rem;
  border-radius: 2px;
  padding: 1px;
  transition:
    color 150ms ease,
    background 150ms ease;
}
.tac-chip-x:hover {
  color: hsl(var(--tac-amber));
  background: hsl(var(--tac-amber) / 0.12);
}
</style>
