<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Search,
  TriangleAlert,
  X,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import FilterBar from "~/components/common/FilterBar.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import Pagination from "~/components/Pagination.vue";
import BanRow from "~/components/bans/BanRow.vue";
import BanRecordSheet from "~/components/bans/BanRecordSheet.vue";
import BanPlayedWithMenu from "~/components/bans/BanPlayedWithMenu.vue";
import { banColumns } from "~/components/bans/banColumns";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";
import { schemaHasType } from "~/utilities/schemaHasType";
import debounce from "~/utilities/debounce";
import {
  RECENT_BANS_QUERY,
  RECENT_BAN_GAPS_QUERY,
  RECENT_BANS_TYPE,
} from "~/graphql/bansGraphql";
import {
  BAN_WINDOWS,
  banQueryArgs,
  defaultBanFilters,
  FIVESTACK_KINDS,
  hasBanFilters,
  menuFilterCount,
  playedWithArg,
  playedWithOn,
  sharedSummary,
  STEAM_KINDS,
  type BanEntry,
  type BanKind,
  type BanSource,
  type BanStatus,
  type BanTiming,
} from "~/utilities/bans";
import {
  filterTriggerActive,
  filterTriggerBase,
  filterTriggerIdle,
} from "~/utilities/tacticalClasses";

const PER_PAGE = 25;

const { t } = useI18n();
const { client } = useApolloClient();
const auth = useAuthStore();

const signedIn = computed(() => !!auth.me);
const moderator = computed(() =>
  auth.isRoleAbove(e_player_roles_enum.moderator),
);

const filters = reactive(defaultBanFilters());
const page = ref(1);
const sort = ref<{ key: "banned" | "name" | "last"; dir: "asc" | "desc" }>({
  key: "banned",
  dir: "desc",
});

const rows = ref<BanEntry[]>([]);
const total = ref(0);
const gaps = ref(0);
const loading = ref(true);
const available = ref<boolean | null>(null);
const now = ref(new Date());
const menuOpen = ref(false);
const windowOpen = ref(false);

const { skeleton, refreshing, loaded } = useDeferredLoading(
  () => loading.value,
);

const source = computed({
  get: () => filters.source,
  set: (value: string) => {
    filters.source = value as BanSource;
  },
});
const sourceOptions = computed(() => [
  { key: "all", label: t("pages.bans.source.all") },
  { key: "steam", label: t("pages.bans.source.steam") },
  { key: "5stack", label: t("pages.bans.source.fivestack") },
]);

const kindGroups = computed(() => [
  {
    key: "steam",
    label: t("pages.bans.filters.steam"),
    disabled: filters.source === "5stack",
    note: t("pages.bans.filters.source_is", {
      source: t("pages.bans.source.fivestack"),
    }),
    kinds: STEAM_KINDS.map((kind) => kindOption(kind)),
  },
  {
    key: "5stack",
    label: t("pages.bans.filters.fivestack"),
    disabled: filters.source === "steam",
    note: t("pages.bans.filters.source_is", {
      source: t("pages.bans.source.steam"),
    }),
    kinds: FIVESTACK_KINDS.map((kind) => kindOption(kind)),
  },
]);
function kindOption(kind: BanKind) {
  return {
    kind,
    label: t(`pages.bans.filters.${kind}`),
    hint: t(`pages.bans.filters.${kind}_hint`),
  };
}
const statusOptions = computed<{ key: BanStatus; label: string }[]>(() => [
  { key: "any", label: t("pages.bans.filters.any") },
  { key: "banned_here", label: t("pages.bans.filters.banned_here_now") },
  { key: "not_banned_here", label: t("pages.bans.filters.not_banned_here") },
]);
const timingOptions = computed<{ key: BanTiming; label: string }[]>(() => [
  { key: "any", label: t("pages.bans.filters.any") },
  { key: "played_first", label: t("pages.bans.filters.played_first") },
  { key: "arrived_banned", label: t("pages.bans.filters.arrived_banned") },
]);

const menuCount = computed(() => menuFilterCount(filters));
const filtered = computed(() => hasBanFilters(filters));

function resetMenu() {
  const fresh = defaultBanFilters();
  filters.kinds = fresh.kinds;
  filters.status = fresh.status;
  filters.timing = fresh.timing;
}
function resetFilters() {
  Object.assign(filters, defaultBanFilters());
}
function showGaps() {
  resetMenu();
  filters.source = "all";
  filters.status = "not_banned_here";
}

const orderBy = computed(() => {
  const { key, dir } = sort.value;
  if (key === "name") return [{ player: { name: dir } }, { banned_at: "desc" }];
  if (key === "last") {
    return [
      { last_match_at: dir === "desc" ? "desc_nulls_last" : "asc_nulls_last" },
      { banned_at: "desc" },
    ];
  }
  return [{ banned_at: dir }, { steam_id: "asc" }];
});
function toggleSort(key: "banned" | "name" | "last") {
  if (sort.value.key === key) {
    sort.value = { key, dir: sort.value.dir === "asc" ? "desc" : "asc" };
  } else {
    sort.value = { key, dir: key === "name" ? "asc" : "desc" };
  }
}

let token = 0;
async function load() {
  const mine = ++token;
  loading.value = true;
  if (available.value === null) {
    available.value = await schemaHasType(client, RECENT_BANS_TYPE);
  }
  if (!available.value) {
    rows.value = [];
    total.value = 0;
    loading.value = false;
    return;
  }
  try {
    const { data } = await client.query({
      query: RECENT_BANS_QUERY,
      variables: {
        args: banQueryArgs(filters),
        limit: PER_PAGE,
        offset: (page.value - 1) * PER_PAGE,
        order_by: orderBy.value,
        moderator: moderator.value,
      },
      fetchPolicy: "network-only",
      context: { optional: true },
    });
    if (mine !== token) return;
    rows.value = (data as any)?.recently_banned_players ?? [];
    total.value =
      (data as any)?.recently_banned_players_aggregate?.aggregate?.count ?? 0;
    now.value = new Date();
  } catch (error) {
    if (mine !== token) return;
    console.error("Failed to load recent bans:", error);
    rows.value = [];
    total.value = 0;
  } finally {
    if (mine === token) loading.value = false;
  }
  void loadGaps();
}

async function loadGaps() {
  if (!moderator.value || !available.value) {
    gaps.value = 0;
    return;
  }
  try {
    const { data } = await client.query({
      query: RECENT_BAN_GAPS_QUERY,
      variables: {
        args: {
          _window_days: filters.windowDays,
          _status: "not_banned_here",
        },
      },
      fetchPolicy: "network-only",
      context: { optional: true },
    });
    gaps.value =
      (data as any)?.recently_banned_players_aggregate?.aggregate?.count ?? 0;
  } catch {
    gaps.value = 0;
  }
}

const queueLoad = debounce(() => {
  page.value = 1;
  void load();
}, 250);

watch(
  () => filters.search,
  () => queueLoad(),
);
watch(
  () => [
    filters.source,
    filters.windowDays,
    filters.kinds.vac,
    filters.kinds.game,
    filters.kinds.staff,
    filters.kinds.auto,
    filters.status,
    filters.timing,
    filters.playedWith,
    filters.lostOnly,
  ],
  () => {
    page.value = 1;
    void load();
  },
);
watch(sort, () => void load());
watch(page, () => void load());
watch([signedIn, moderator], () => void load());
onMounted(() => void load());

// While Played with me is on and every row is on screen, say what those
// matches came to.
const summary = computed(() => {
  if (!playedWithOn(filters) || !rows.value.length) return null;
  if (total.value > rows.value.length) return null;
  const { matches, lost } = sharedSummary(rows.value);
  if (!matches) return null;
  const side = playedWithArg(filters);
  return filters.lostOnly
    ? t(`pages.bans.summary.lost_only_${side}`, { count: matches }, matches)
    : t(
        `pages.bans.summary.lost_of_${side}`,
        { count: matches, lost },
        matches,
      );
});
const showGapLink = computed(
  () =>
    moderator.value &&
    gaps.value > 0 &&
    filters.status !== "not_banned_here" &&
    !summary.value,
);

// The open record follows a refetch; a row the new filters drop keeps its
// last known state until the sheet closes.
const selected = ref<BanEntry | null>(null);
const sheetOpen = ref(false);
watch(rows, (next) => {
  if (!selected.value) return;
  const fresh = next.find(
    (row) => String(row.steam_id) === String(selected.value!.steam_id),
  );
  if (fresh) selected.value = fresh;
});
function openRecord(entry: BanEntry) {
  selected.value = entry;
  sheetOpen.value = true;
}
async function onChanged() {
  const id = selected.value ? String(selected.value.steam_id) : null;
  await load();
  if (!rows.value.some((row) => String(row.steam_id) === id)) {
    sheetOpen.value = false;
  }
}

const emptyDescription = computed(() =>
  playedWithOn(filters)
    ? t("pages.bans.empty.played_with", { days: filters.windowDays })
    : filters.status === "not_banned_here"
      ? t("pages.bans.empty.no_gaps")
      : t("common.empty_filtered.description"),
);

const optionClasses =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent";
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.bans.title") }}</h1>

  <PageTransition>
    <div class="space-y-2">
      <FilterBar>
        <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
          <InputGroupAddon class="pl-2.5">
            <Search class="h-3.5 w-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            id="bans-search"
            v-model="filters.search"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :placeholder="$t('pages.bans.search')"
            :aria-label="$t('pages.bans.search')"
            class="h-full text-sm"
          />
          <InputGroupAddon align="inline-end" class="pr-2">
            <button
              v-if="filters.search"
              type="button"
              class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              :aria-label="$t('common.clear')"
              @click="filters.search = ''"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </InputGroupAddon>
        </InputGroup>

        <AnimatedFilters
          v-model="source"
          square
          :options="sourceOptions"
          :aria-label="$t('pages.bans.source.label')"
        />

        <Popover v-model:open="windowOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              :class="[
                filterTriggerBase,
                filters.windowDays !== 30
                  ? filterTriggerActive
                  : filterTriggerIdle,
              ]"
            >
              <Clock class="h-3.5 w-3.5" />
              {{ $t("pages.bans.window.label", { days: filters.windowDays }) }}
              <ChevronDown class="h-3 w-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-48 p-1.5">
            <div role="radiogroup" :aria-label="$t('pages.bans.window.title')">
              <button
                v-for="days in BAN_WINDOWS"
                :key="days"
                type="button"
                role="radio"
                :aria-checked="filters.windowDays === days"
                :class="optionClasses"
                @click="
                  filters.windowDays = days;
                  windowOpen = false;
                "
              >
                <Check
                  class="h-3.5 w-3.5"
                  :class="
                    filters.windowDays === days
                      ? 'text-[hsl(var(--tac-amber))]'
                      : 'invisible'
                  "
                />
                {{ $t("pages.bans.window.option", { days }) }}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <BanPlayedWithMenu
          v-if="signedIn"
          v-model:played-with="filters.playedWith"
          v-model:lost-only="filters.lostOnly"
        />

        <FilterMenu
          v-model:open="menuOpen"
          class="ml-auto"
          :count="menuCount"
          :active="menuCount > 0"
          :show-reset="filtered"
          content-class="w-[min(92vw,320px)] space-y-3 p-2"
          @reset="resetFilters"
        >
          <div
            v-for="group in kindGroups"
            :key="group.key"
            class="space-y-0.5 border-b border-border/50 pb-2"
          >
            <div
              class="flex items-baseline justify-between px-2 pb-1 pt-0.5 text-xs font-medium text-muted-foreground"
            >
              <span>{{ group.label }}</span>
              <span v-if="group.disabled" class="text-[0.7rem]">{{
                group.note
              }}</span>
            </div>
            <button
              v-for="option in group.kinds"
              :key="option.kind"
              type="button"
              :aria-pressed="filters.kinds[option.kind]"
              :disabled="group.disabled"
              :class="optionClasses"
              @click="filters.kinds[option.kind] = !filters.kinds[option.kind]"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                :class="
                  filters.kinds[option.kind]
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] text-black'
                    : 'border-border'
                "
                :style="group.disabled ? 'opacity: 0.5' : undefined"
              >
                <Check v-if="filters.kinds[option.kind]" class="h-3 w-3" />
              </span>
              <span class="truncate">{{ option.label }}</span>
              <span class="ml-auto shrink-0 text-xs text-muted-foreground">{{
                option.hint
              }}</span>
            </button>
          </div>

          <div
            role="radiogroup"
            :aria-label="$t('pages.bans.filters.banned_here')"
            class="space-y-0.5 border-b border-border/50 pb-2"
          >
            <div
              class="px-2 pb-1 pt-0.5 text-xs font-medium text-muted-foreground"
            >
              {{ $t("pages.bans.filters.banned_here") }}
            </div>
            <button
              v-for="option in statusOptions"
              :key="option.key"
              type="button"
              role="radio"
              :aria-checked="filters.status === option.key"
              :class="optionClasses"
              @click="filters.status = option.key"
            >
              <Check
                class="h-3.5 w-3.5 shrink-0"
                :class="
                  filters.status === option.key
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'invisible'
                "
              />
              {{ option.label }}
            </button>
          </div>

          <div
            role="radiogroup"
            :aria-label="$t('pages.bans.filters.timing')"
            class="space-y-0.5"
          >
            <div
              class="px-2 pb-1 pt-0.5 text-xs font-medium text-muted-foreground"
            >
              {{ $t("pages.bans.filters.timing") }}
            </div>
            <button
              v-for="option in timingOptions"
              :key="option.key"
              type="button"
              role="radio"
              :aria-checked="filters.timing === option.key"
              :class="optionClasses"
              @click="filters.timing = option.key"
            >
              <Check
                class="h-3.5 w-3.5 shrink-0"
                :class="
                  filters.timing === option.key
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'invisible'
                "
              />
              {{ option.label }}
            </button>
          </div>
        </FilterMenu>
      </FilterBar>

      <div
        v-if="available && total > 0"
        class="flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-0.5 text-xs text-muted-foreground"
      >
        <span v-if="summary" class="text-foreground">{{ summary }}</span>
        <button
          v-else-if="showGapLink"
          type="button"
          class="inline-flex items-center gap-1.5 text-orange-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.5)]"
          @click="showGaps"
        >
          <TriangleAlert class="h-3.5 w-3.5" />
          {{ $t("pages.bans.summary.gaps", { count: gaps }, gaps) }}
        </button>
        <span v-else />
        <span class="tabular-nums">{{
          $t(
            "pages.bans.summary.count",
            { count: total, days: filters.windowDays },
            total,
          )
        }}</span>
      </div>
    </div>
  </PageTransition>

  <PageTransition :step="1" class="mt-2 block">
    <FadeSwap>
      <div v-if="skeleton" key="loading" class="grid gap-2" aria-busy="true">
        <Skeleton class="h-8 w-full rounded-md" />
        <Skeleton v-for="i in 8" :key="i" class="h-14 w-full rounded-md" />
      </div>
      <SectionEmpty
        v-else-if="loaded && !rows.length && (!available || !filtered)"
        key="empty"
        :title="$t('pages.bans.empty.title')"
        :description="$t('pages.bans.empty.description')"
      />
      <SectionEmpty
        v-else-if="loaded && !rows.length"
        key="filtered"
        :title="$t('common.empty_filtered.title')"
        :description="emptyDescription"
      >
        <Button variant="outline" size="sm" class="h-8" @click="resetFilters">
          <X class="h-3.5 w-3.5" />
          {{ $t("common.reset_filters") }}
        </Button>
      </SectionEmpty>
      <div
        v-else
        key="list"
        class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/40 transition-opacity duration-200"
        :class="refreshing && 'pointer-events-none opacity-50'"
      >
        <div
          class="hidden h-8 items-center gap-3.5 px-3.5 text-xs text-muted-foreground/80 md:grid"
          :class="banColumns(signedIn)"
        >
          <button
            type="button"
            class="inline-flex items-center gap-1 justify-self-start transition-colors hover:text-foreground"
            :class="sort.key === 'name' && 'text-foreground'"
            @click="toggleSort('name')"
          >
            {{ $t("pages.bans.columns.player") }}
            <template v-if="sort.key === 'name'">
              <ArrowDown v-if="sort.dir === 'asc'" class="h-3 w-3" />
              <ArrowUp v-else class="h-3 w-3" />
            </template>
          </button>
          <span>{{ $t("pages.bans.columns.ban") }}</span>
          <button
            type="button"
            class="inline-flex items-center gap-1 justify-self-start transition-colors hover:text-foreground"
            :class="sort.key === 'banned' && 'text-foreground'"
            @click="toggleSort('banned')"
          >
            {{ $t("pages.bans.columns.banned") }}
            <template v-if="sort.key === 'banned'">
              <ArrowDown v-if="sort.dir === 'desc'" class="h-3 w-3" />
              <ArrowUp v-else class="h-3 w-3" />
            </template>
          </button>
          <span>{{ $t("pages.bans.columns.length") }}</span>
          <button
            type="button"
            class="hidden items-center gap-1 justify-self-start transition-colors hover:text-foreground xl:inline-flex"
            :class="sort.key === 'last' && 'text-foreground'"
            @click="toggleSort('last')"
          >
            {{ $t("pages.bans.columns.last_match") }}
            <template v-if="sort.key === 'last'">
              <ArrowDown v-if="sort.dir === 'desc'" class="h-3 w-3" />
              <ArrowUp v-else class="h-3 w-3" />
            </template>
          </button>
          <span v-if="signedIn">{{ $t("pages.bans.columns.with_you") }}</span>
        </div>
        <BanRow
          v-for="entry in rows"
          :key="entry.steam_id"
          :entry="entry"
          :filters="filters"
          :now="now"
          :signed-in="signedIn"
          :moderator="moderator"
          @open="openRecord(entry)"
        />
      </div>
    </FadeSwap>
  </PageTransition>

  <Pagination
    v-if="total > PER_PAGE"
    :page="page"
    :per-page="PER_PAGE"
    :total="total"
    @page="(next: number) => (page = next)"
  />

  <BanRecordSheet
    v-model:open="sheetOpen"
    :entry="selected"
    :now="now"
    :moderator="moderator"
    @changed="onChanged"
  />
</template>
