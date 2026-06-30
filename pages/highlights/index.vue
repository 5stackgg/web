<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Film,
  Lock,
  Globe,
  ListVideo,
  Calendar,
  Crosshair,
  User,
  X,
  Layers,
  ArrowUpDown,
  ChevronDown,
  Check,
} from "lucide-vue-next";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
import { order_by, $ } from "~/generated/zeus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "~/components/ui/sheet";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import MatchClipsGroupCard from "~/components/clips/MatchClipsGroupCard.vue";
import RenderQueuePanel from "~/components/clips/RenderQueuePanel.vue";
import Pagination from "~/components/Pagination.vue";
import type { Clip } from "~/types/clip";
import { useClipModal, type ClipQueueItem } from "~/composables/useClipModal";
import FilterBar from "~/components/common/FilterBar.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import {
  filterTriggerBase,
  filterTriggerIdle,
  filterTriggerActive,
  filterTriggerValueClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({
  persistQueryKeys: ["player", "since", "kills", "view", "sort"],
});

const { t } = useI18n();
const clipQueueScope = "highlights-index";
const { activeClipId, clearClipQueue, setClipQueue } = useClipModal();

type Filter = "all" | "public" | "private";

const auth = useAuthStore();
const isAdmin = computed(() => auth.isAdmin);
const canCurate = computed(
  () =>
    auth.isAdmin ||
    auth.isStreamer ||
    auth.isMatchOrganizer ||
    auth.isTournamentOrganizer,
);

type ClipGroup = { matchId: string; clips: Clip[] };
const groups = ref<ClipGroup[]>([]);
const loading = ref(true);
const visibilityFilter = ref<Filter>("all");
const queueOpen = ref(false);

// Auto-close the render-queue sheet when any clip modal opens so the
// modal isn't sandwiched under the sheet's overlay.
watch(activeClipId, (id) => {
  if (id && queueOpen.value) queueOpen.value = false;
});

type ViewMode = "matches" | "singles";

const page = ref(1);
const perPage = 24;
const totalCount = ref(0);

const flatClips = computed<Clip[]>(() => groups.value.flatMap((g) => g.clips));

const route = useRoute();
const router = useRouter();

type SincePreset = "all" | "24h" | "7d" | "30d" | "90d";
const SINCE_VALUES = ["all", "24h", "7d", "30d", "90d"] as const;
const SINCE_OPTIONS = computed<Array<{ value: SincePreset; label: string }>>(
  () =>
    SINCE_VALUES.map((value) => ({
      value,
      label: t(`pages.highlights.since.${value}`),
    })),
);

type KillsPreset = "any" | "2" | "3" | "4" | "5";
const KILLS_VALUES = ["any", "2", "3", "4", "5"] as const;
const KILLS_OPTIONS = computed<Array<{ value: KillsPreset; label: string }>>(
  () =>
    KILLS_VALUES.map((value) => ({
      value,
      label: t(`pages.highlights.kills.${value}`),
    })),
);

const playerFilter = computed<string | null>(() => {
  const v = route.query.player;
  return typeof v === "string" && v.length > 0 ? v : null;
});
const sinceFilter = computed<SincePreset>(() =>
  (SINCE_VALUES as readonly string[]).includes(route.query.since as string)
    ? (route.query.since as SincePreset)
    : "all",
);
const killsFilter = computed<KillsPreset>(() =>
  (KILLS_VALUES as readonly string[]).includes(route.query.kills as string)
    ? (route.query.kills as KillsPreset)
    : "any",
);
const viewMode = computed<ViewMode>(() =>
  route.query.view === "singles" ? "singles" : "matches",
);

type SortPreset = "recent" | "views";
const SORT_VALUES = ["recent", "views"] as const;
const SORT_OPTIONS = computed<Array<{ value: SortPreset; label: string }>>(() =>
  SORT_VALUES.map((value) => ({
    value,
    label: t(`pages.highlights.sort.${value}`),
  })),
);
const sortFilter = computed<SortPreset>(() =>
  (SORT_VALUES as readonly string[]).includes(route.query.sort as string)
    ? (route.query.sort as SortPreset)
    : "recent",
);

function setSort(v: SortPreset) {
  const next = { ...route.query } as Record<string, any>;
  if (v === "recent") delete next.sort;
  else next.sort = v;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function setViewMode(v: ViewMode) {
  const next = { ...route.query } as Record<string, any>;
  if (v === "matches") delete next.view;
  else next.view = v;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function setSince(v: SincePreset) {
  const next = { ...route.query } as Record<string, any>;
  if (v === "all") delete next.since;
  else next.since = v;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function setKills(v: KillsPreset) {
  const next = { ...route.query } as Record<string, any>;
  if (v === "any") delete next.kills;
  else next.kills = v;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function clearPlayer() {
  pickedPlayerName.value = null;
  const next = { ...route.query } as Record<string, any>;
  delete next.player;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

const pickedPlayerName = ref<string | null>(null);
function selectPlayer(player: { steam_id: string; name: string } | null) {
  if (!player?.steam_id) return;
  pickedPlayerName.value = player.name;
  const next = { ...route.query } as Record<string, any>;
  next.player = player.steam_id;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

const playerFilterName = computed<string | null>(() => {
  const sid = playerFilter.value;
  if (!sid) return null;
  for (const c of flatClips.value) {
    if (c.target?.steam_id === sid) return c.target.name;
  }
  return pickedPlayerName.value;
});

function sinceCutoffIso(preset: SincePreset): string | null {
  const ms: Record<SincePreset, number> = {
    all: 0,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  if (!ms[preset]) return null;
  return new Date(Date.now() - ms[preset]).toISOString();
}

// Hasura aggregate subs need a non-empty selection set to push deltas, so
// we subscribe to (id, status) and split active/queued client-side.
const activeClips = ref(0);
const queuedClips = ref(0);
const pendingClips = computed(() => activeClips.value + queuedClips.value);
let pendingSub: { unsubscribe: () => void } | null = null;
function subscribePending() {
  pendingSub?.unsubscribe();
  pendingSub = null;
  activeClips.value = 0;
  queuedClips.value = 0;
  if (!canCurate.value) return;
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      clip_render_jobs: [
        {
          where: {
            status: { _in: ["queued", "rendering", "uploading"] },
          },
          limit: 500,
        } as any,
        { id: true, status: true },
      ],
    } as any),
  });
  pendingSub = obs.subscribe({
    next: ({ data }: any) => {
      const rows: Array<{ status: string }> = data?.clip_render_jobs ?? [];
      let active = 0;
      let queued = 0;
      for (const r of rows) {
        if (r.status === "queued") queued++;
        else active++;
      }
      activeClips.value = active;
      queuedClips.value = queued;
    },
    error: (err: any) => {
      console.error("[highlights] pending count subscription error:", err);
    },
  });
}
watch(canCurate, subscribePending, { immediate: true });

const hasActiveFilter = computed(
  () =>
    playerFilter.value !== null ||
    sinceFilter.value !== "all" ||
    killsFilter.value !== "any" ||
    (isAdmin.value && visibilityFilter.value !== "all"),
);

// Count of narrowing filters applied — drives the mobile "Filters" badge.
const activeFilterCount = computed(() => {
  let n = 0;
  if (playerFilter.value) n++;
  if (sinceFilter.value !== "all") n++;
  if (killsFilter.value !== "any") n++;
  if (isAdmin.value && visibilityFilter.value !== "all") n++;
  return n;
});

const sinceLabel = computed(
  () => SINCE_OPTIONS.value.find((o) => o.value === sinceFilter.value)?.label,
);
const killsLabel = computed(
  () => KILLS_OPTIONS.value.find((o) => o.value === killsFilter.value)?.label,
);
const sortLabel = computed(
  () => SORT_OPTIONS.value.find((o) => o.value === sortFilter.value)?.label,
);
const visibilityLabel = computed(
  () => adminFilters.value.find((o) => o.value === visibilityFilter.value)?.label,
);

function resetHighlightFilters() {
  // One router.replace — chaining the individual setters each reads the same
  // stale route.query snapshot, so only the last write survives (which would
  // leave `since`/`kills` behind).
  pickedPlayerName.value = null;
  visibilityFilter.value = "all";
  const next = { ...route.query } as Record<string, any>;
  delete next.player;
  delete next.since;
  delete next.kills;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

// Kills is a heavily-used filter — it lives as its own left-side trigger (the
// rest are bundled in the Filters menu). Single-select → closes on pick.
const killsOpen = ref(false);

const forceSingles = computed(
  () => hasActiveFilter.value || sortFilter.value === "views",
);

const effectiveMode = computed<ViewMode>(() =>
  forceSingles.value ? "singles" : viewMode.value,
);

const innerClipFilter = computed<Record<string, any>>(() => {
  const f: Record<string, any> = {};
  if (isAdmin.value && visibilityFilter.value !== "all") {
    f.visibility = { _eq: visibilityFilter.value };
  } else if (!isAdmin.value) {
    f.visibility = { _eq: "public" };
  }
  if (playerFilter.value) {
    f.target_steam_id = { _eq: playerFilter.value };
  }
  const cutoff = sinceCutoffIso(sinceFilter.value);
  if (cutoff) {
    f.created_at = { _gte: cutoff };
  }
  if (killsFilter.value !== "any") {
    f.kills_count = { _gte: parseInt(killsFilter.value, 10) };
  }
  return f;
});

let dataFetchId = 0;
async function fetchData() {
  const myId = ++dataFetchId;
  if (groups.value.length === 0) {
    loading.value = true;
  }
  const filter = innerClipFilter.value;
  const filterIsEmpty = Object.keys(filter).length === 0;

  try {
    if (effectiveMode.value === "singles") {
      const { data } = await getGraphqlClient().query({
        query: generateQuery({
          match_clips: [
            {
              where: filterIsEmpty ? {} : filter,
              order_by:
                sortFilter.value === "views"
                  ? [{ views_count: order_by.desc }]
                  : [{ created_at: order_by.desc }],
              limit: perPage,
              offset: (page.value - 1) * perPage,
            } as any,
            matchClipFields,
          ],
        } as any),
        fetchPolicy: "network-only",
      });
      if (myId !== dataFetchId) return;
      const list: Clip[] = (data as any)?.match_clips ?? [];
      groups.value = list.map((clip) => ({
        matchId: clip.match_map?.match?.id ?? clip.id,
        clips: [clip],
      }));
      return;
    }

    const orderColumn = isAdmin.value
      ? "latest_clip_at"
      : "public_latest_clip_at";
    const baseFilter: Record<string, any> = isAdmin.value
      ? { clips_count: { _gt: 0 } }
      : { public_clips_count: { _gt: 0 } };
    const groupWhere = filterIsEmpty
      ? baseFilter
      : { ...baseFilter, match_clips: filter };
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        match_maps: [
          {
            where: groupWhere,
            order_by: $("groups_order_by", "[match_maps_order_by!]!"),
            limit: perPage,
            offset: (page.value - 1) * perPage,
          } as any,
          {
            id: true,
            match: { id: true },
            match_clips: [
              {
                where: filterIsEmpty ? {} : filter,
                order_by: $("clips_order_by", "[match_clips_order_by!]!"),
              },
              matchClipFields,
            ],
          },
        ],
      } as any),
      variables: {
        groups_order_by:
          sortFilter.value === "views"
            ? [{ match_clips_aggregate: { sum: { views_count: order_by.desc } } }]
            : [{ [orderColumn]: order_by.desc_nulls_last }],
        clips_order_by:
          sortFilter.value === "views"
            ? [{ views_count: order_by.desc }]
            : [{ created_at: order_by.desc }],
      },
      fetchPolicy: "network-only",
    });
    if (myId !== dataFetchId) return;
    const rows: Array<{
      id: string;
      match?: { id: string } | null;
      match_clips: Clip[];
    }> = (data as any)?.match_maps ?? [];
    groups.value = rows
      .filter((g) => (g.match_clips?.length ?? 0) > 0)
      .map((g) => ({
        matchId: g.match?.id ?? g.id,
        clips: g.match_clips ?? [],
      }));
  } catch (err) {
    if (myId === dataFetchId) {
      console.error("[highlights] fetch error:", err);
    }
  } finally {
    if (myId === dataFetchId) {
      loading.value = false;
    }
  }
}

let aggregateFetchId = 0;
async function fetchAggregate() {
  const myId = ++aggregateFetchId;
  const filter = innerClipFilter.value;
  const filterIsEmpty = Object.keys(filter).length === 0;

  try {
    if (effectiveMode.value === "singles") {
      const { data } = await getGraphqlClient().query({
        query: generateQuery({
          match_clips_aggregate: [
            { where: filterIsEmpty ? {} : filter } as any,
            { aggregate: { count: true } },
          ],
        } as any),
        fetchPolicy: "network-only",
      });
      if (myId !== aggregateFetchId) return;
      totalCount.value =
        (data as any)?.match_clips_aggregate?.aggregate?.count ?? 0;
      return;
    }

    const baseFilter: Record<string, any> = isAdmin.value
      ? { clips_count: { _gt: 0 } }
      : { public_clips_count: { _gt: 0 } };
    const groupWhere = filterIsEmpty
      ? baseFilter
      : { ...baseFilter, match_clips: filter };
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        match_maps_aggregate: [
          { where: groupWhere } as any,
          { aggregate: { count: true } },
        ],
      } as any),
      fetchPolicy: "network-only",
    });
    if (myId !== aggregateFetchId) return;
    totalCount.value =
      (data as any)?.match_maps_aggregate?.aggregate?.count ?? 0;
  } catch (err) {
    if (myId === aggregateFetchId) {
      console.error("[highlights] aggregate fetch error:", err);
    }
  }
}

fetchData();
fetchAggregate();

watch(
  [
    playerFilter,
    sinceFilter,
    killsFilter,
    isAdmin,
    visibilityFilter,
    viewMode,
    sortFilter,
  ],
  () => {
    if (page.value !== 1) {
      page.value = 1;
    } else {
      fetchData();
    }
    fetchAggregate();
  },
);
watch(page, () => fetchData());

onBeforeUnmount(() => {
  pendingSub?.unsubscribe();
  clearClipQueue(clipQueueScope);
});

const showMap = computed(() => {
  const seen = new Set<string>();
  for (const c of flatClips.value) {
    const name = c.match_map?.map?.name;
    if (name) seen.add(name);
    if (seen.size > 1) return true;
  }
  return false;
});

function clipQueueItem(c: Clip): ClipQueueItem {
  return {
    id: c.id,
    title: c.title,
    playerName: c.target?.name ?? null,
    teamName: null,
    durationMs: c.duration_ms,
    thumbnailUrl: c.thumbnail_download_url,
    posterUrl: c.match_map?.map?.poster ?? null,
  };
}

watchEffect(() => {
  setClipQueue(flatClips.value.map(clipQueueItem), clipQueueScope);
});

const hasClips = computed(() => groups.value.length > 0);

type GridItem =
  | { kind: "single"; clip: Clip }
  | { kind: "group"; matchId: string; clips: Clip[] };
const gridItems = computed<GridItem[]>(() => {
  const items: GridItem[] = [];
  for (const g of groups.value) {
    if (g.clips.length === 0) continue;
    if (g.clips.length === 1) {
      items.push({ kind: "single", clip: g.clips[0] });
      continue;
    }
    items.push({ kind: "group", matchId: g.matchId, clips: g.clips });
  }
  return items;
});

// Changes whenever the rendered set changes (filter/sort/page), driving the
// grid cross-fade so a new result set eases in instead of snapping.
const gridKey = computed(() =>
  gridItems.value
    .map((i) => (i.kind === "single" ? `s:${i.clip.id}` : `g:${i.matchId}`))
    .join(","),
);

const adminFilters = computed<
  Array<{ value: Filter; label: string; icon?: any }>
>(() => [
  { value: "all", label: t("pages.highlights.visibility_filter.all") },
  {
    value: "public",
    label: t("pages.highlights.visibility_filter.public"),
    icon: Globe,
  },
  {
    value: "private",
    label: t("pages.highlights.visibility_filter.private"),
    icon: Lock,
  },
]);

const viewModeOptions = computed<
  Array<{
    value: ViewMode;
    label: string;
    icon: any;
  }>
>(() => [
  {
    value: "matches",
    label: t("pages.highlights.view_modes.matches"),
    icon: Layers,
  },
  {
    value: "singles",
    label: t("pages.highlights.view_modes.singles"),
    icon: Film,
  },
]);
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #title>{{ $t("pages.highlights.title") }}</template>
      <template #actions>
        <div class="flex items-center gap-3">
          <Sheet v-if="canCurate" v-model:open="queueOpen">
            <SheetTrigger as-child>
              <Button
                variant="outline"
                class="relative !py-0 h-[clamp(1.75rem,4.2vw,3rem)] gap-2 px-4 max-sm:aspect-square max-sm:!px-0 bg-card/60 backdrop-blur"
                :class="{
                  'border-[hsl(var(--tac-amber)/0.55)] text-[hsl(var(--tac-amber))]':
                    queueOpen,
                }"
              >
                <ListVideo class="w-4 h-4" />
                <span class="hidden sm:inline">{{
                  $t("pages.highlights.queue")
                }}</span>
                <span
                  v-if="queuedClips > 0"
                  class="inline-flex items-center rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.15)] px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold tabular-nums text-[hsl(var(--tac-amber))]"
                >
                  {{ queuedClips }}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              class="w-full sm:max-w-xl overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle class="flex items-center gap-2">
                  <ListVideo class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
                  {{ $t("pages.highlights.render_queue") }}
                </SheetTitle>
                <SheetDescription>
                  {{ $t("pages.highlights.render_queue_description") }}
                </SheetDescription>
              </SheetHeader>
              <div class="mt-6">
                <RenderQueuePanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="60" class="mt-4">
    <FilterBar>
      <!-- Player (left, widely used) -->
      <button
        v-if="playerFilter"
        type="button"
        :class="[filterTriggerBase, filterTriggerActive]"
        :title="$t('pages.highlights.clear_player_filter')"
        @click="clearPlayer"
      >
        <User class="h-3.5 w-3.5" />
        <span class="max-w-[10rem] truncate normal-case tracking-normal">
          {{ playerFilterName ?? $t("clips.default_player") }}
        </span>
        <X class="h-3 w-3 opacity-70" />
      </button>
      <PlayerSearch
        v-else
        :label="$t('pages.highlights.filter_by_player')"
        @selected="selectPlayer"
      >
        <button
          type="button"
          :class="[filterTriggerBase, filterTriggerIdle]"
          :title="$t('pages.highlights.filter_by_player')"
        >
          <User class="h-3.5 w-3.5" />
          {{ $t("clips.default_player") }}
          <ChevronDown class="h-3 w-3 opacity-50" />
        </button>
      </PlayerSearch>

      <!-- Kills (widely used) — left trigger -->
      <Popover v-model:open="killsOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="[
              filterTriggerBase,
              killsFilter !== 'any' ? filterTriggerActive : filterTriggerIdle,
            ]"
          >
            <Crosshair class="h-3.5 w-3.5" />
            {{ $t("pages.highlights.filter_labels.kills") }}
            <span v-if="killsFilter !== 'any'" :class="filterTriggerValueClasses">
              {{ killsLabel }}
            </span>
            <ChevronDown class="h-3 w-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-44 p-1">
          <button
            v-for="opt in KILLS_OPTIONS"
            :key="opt.value"
            type="button"
            @click="
              setKills(opt.value);
              killsOpen = false;
            "
            class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
          >
            <span>{{ opt.label }}</span>
            <Check
              v-if="killsFilter === opt.value"
              class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
            />
          </button>
        </PopoverContent>
      </Popover>

      <!-- View mode — pinned to the right of the trigger row -->
      <div
        class="relative ml-auto flex items-center rounded-full border border-border/60 bg-muted/30 p-0.5"
        role="group"
        :aria-label="$t('pages.highlights.view_mode')"
      >
          <!-- Sliding active-tab indicator -->
          <span
            aria-hidden="true"
            class="absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_12px_-2px_hsl(var(--tac-amber)/0.6)] transition-transform duration-300 ease-out"
            :style="{
              transform:
                effectiveMode === 'singles'
                  ? 'translateX(100%)'
                  : 'translateX(0)',
            }"
          />
          <button
            v-for="opt in viewModeOptions"
            :key="opt.value"
            type="button"
            :disabled="forceSingles && opt.value === 'matches'"
            :title="
              forceSingles && opt.value === 'matches'
                ? $t('pages.highlights.view_mode_filter_disabled')
                : undefined
            "
            :class="[
              'relative z-10 inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1 text-xs transition-colors',
              effectiveMode === opt.value
                ? 'font-bold text-black'
                : 'text-muted-foreground hover:text-foreground',
              forceSingles && opt.value === 'matches'
                ? 'cursor-not-allowed opacity-40 hover:text-muted-foreground'
                : '',
            ]"
            :aria-pressed="effectiveMode === opt.value"
            @click="setViewMode(opt.value)"
          >
            <component :is="opt.icon" class="h-3 w-3" />
            {{ opt.label }}
          </button>
        </div>

      <!-- Filters (Visibility/Date/Kills/Sort bundled) + grouped reset -->
      <FilterMenu
        :count="
          (isAdmin && visibilityFilter !== 'all' ? 1 : 0) +
          (sinceFilter !== 'all' ? 1 : 0) +
          (sortFilter !== 'recent' ? 1 : 0)
        "
        :active="
          (isAdmin && visibilityFilter !== 'all') ||
          sinceFilter !== 'all' ||
          sortFilter !== 'recent'
        "
        :show-reset="hasActiveFilter"
        content-class="w-[min(92vw,260px)] space-y-3 p-2"
        @reset="resetHighlightFilters"
      >
        <!-- Visibility (admin) -->
        <div v-if="isAdmin" class="space-y-0.5">
          <span
            class="block px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.highlights.filter_labels.visibility") }}
          </span>
          <button
            v-for="opt in adminFilters"
            :key="opt.value"
            type="button"
            @click="visibilityFilter = opt.value"
            class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
          >
            <span class="flex items-center gap-2">
              <component :is="opt.icon" v-if="opt.icon" class="h-3.5 w-3.5" />
              {{ opt.label }}
            </span>
            <Check
              v-if="visibilityFilter === opt.value"
              class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
            />
          </button>
        </div>

        <!-- Date -->
        <div
          class="space-y-0.5"
          :class="isAdmin ? 'border-t border-border/50 pt-3' : ''"
        >
          <span
            class="block px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.highlights.filter_labels.date") }}
          </span>
          <button
            v-for="opt in SINCE_OPTIONS"
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
        </div>

        <!-- Sort -->
        <div class="space-y-0.5 border-t border-border/50 pt-3">
          <span
            class="block px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.highlights.filter_labels.sort") }}
          </span>
          <button
            v-for="opt in SORT_OPTIONS"
            :key="opt.value"
            type="button"
            @click="setSort(opt.value)"
            class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
          >
            <span>{{ opt.label }}</span>
            <Check
              v-if="sortFilter === opt.value"
              class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
            />
          </button>
        </div>
      </FilterMenu>
    </FilterBar>
  </PageTransition>

  <PageTransition v-if="loading" :delay="80" class="mt-6">
    <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton
        v-for="i in 8"
        :key="i"
        class="aspect-video w-full rounded-lg"
      />
    </div>
  </PageTransition>

  <PageTransition v-else-if="!hasClips" :delay="80" class="mt-6">
    <Empty>
      <EmptyTitle>
        {{
          playerFilter || sinceFilter !== "all" || killsFilter !== "any"
            ? $t("pages.highlights.empty.no_match_filters")
            : $t("pages.highlights.empty.no_clips_yet")
        }}
      </EmptyTitle>
      <EmptyDescription>
        <template
          v-if="playerFilter || sinceFilter !== 'all' || killsFilter !== 'any'"
        >
          {{ $t("pages.highlights.empty.try_widening") }}
        </template>
        <template v-else-if="isAdmin">
          {{ $t("pages.highlights.empty.try_different_admin") }}
        </template>
        <template v-else>
          {{ $t("pages.highlights.empty.check_back_soon") }}
        </template>
      </EmptyDescription>
      <div
        v-if="playerFilter || sinceFilter !== 'all' || killsFilter !== 'any'"
        class="mt-3 flex flex-wrap items-center justify-center gap-2"
      >
        <button
          v-if="playerFilter"
          type="button"
          :class="[filterTriggerBase, filterTriggerIdle]"
          @click="clearPlayer"
        >
          <X class="h-3 w-3" />
          {{ $t("pages.highlights.empty.clear_player") }}
        </button>
        <button
          v-if="sinceFilter !== 'all'"
          type="button"
          :class="[filterTriggerBase, filterTriggerIdle]"
          @click="setSince('all')"
        >
          <X class="h-3 w-3" />
          {{ $t("pages.highlights.empty.clear_date") }}
        </button>
        <button
          v-if="killsFilter !== 'any'"
          type="button"
          :class="[filterTriggerBase, filterTriggerIdle]"
          @click="setKills('any')"
        >
          <X class="h-3 w-3" />
          {{ $t("pages.highlights.empty.clear_kills") }}
        </button>
      </div>
    </Empty>
  </PageTransition>

  <PageTransition v-else :delay="80" class="mt-6">
    <Transition name="grid-fade" mode="out-in">
      <div
        :key="gridKey"
        class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      >
        <template v-for="item in gridItems">
          <MatchClipsGroupCard
            v-if="item.kind === 'group'"
            :key="`group-${item.matchId}`"
            :match-id="item.matchId"
            :clips="item.clips"
          />
          <HighlightCard
            v-else
            :key="`single-${item.clip.id}`"
            :clip="item.clip"
            :show-map="showMap"
          />
        </template>
      </div>
    </Transition>
  </PageTransition>

  <Pagination
    v-if="!loading && totalCount > perPage"
    class="mt-6"
    :page="page"
    :per-page="perPage"
    :total="totalCount"
    @page="(p) => (page = p)"
  />
</template>

<style scoped>
.grid-fade-enter-active,
.grid-fade-leave-active {
  transition: opacity 0.22s ease;
}
.grid-fade-enter-from,
.grid-fade-leave-to {
  opacity: 0;
}
</style>
