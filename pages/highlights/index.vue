<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Film,
  Loader2,
  Lock,
  Eye,
  Globe,
  Clapperboard,
  ListVideo,
  Calendar,
  Crosshair,
  User,
  X,
  Layers,
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
import {
  tacticalFilterPillClasses,
  tacticalFilterPillActiveClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({
  persistQueryKeys: ["player", "since", "kills", "view"],
});

const { t } = useI18n();
const clipQueueScope = "highlights-index";
const { clearClipQueue, setClipQueue } = useClipModal();

type Filter = "all" | "public" | "private" | "unlisted";

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

const effectiveMode = computed<ViewMode>(() =>
  hasActiveFilter.value ? "singles" : viewMode.value,
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
              order_by: [{ created_at: order_by.desc }],
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
        groups_order_by: [{ [orderColumn]: order_by.desc }],
        clips_order_by: [{ created_at: order_by.desc }],
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
  [playerFilter, sinceFilter, killsFilter, isAdmin, visibilityFilter, viewMode],
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

const totalCountLabel = computed(() => {
  if (effectiveMode.value === "singles") {
    return t("pages.highlights.clip_count", totalCount.value);
  }
  return t("pages.highlights.match_count", totalCount.value);
});

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
    value: "unlisted",
    label: t("pages.highlights.visibility_filter.unlisted"),
    icon: Eye,
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
          <div
            class="hidden sm:flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Clapperboard class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
            <span>
              <span class="text-foreground font-semibold">{{
                totalCount
              }}</span>
              {{ totalCountLabel }}
            </span>
          </div>
          <Sheet v-if="canCurate" v-model:open="queueOpen">
            <SheetTrigger as-child>
              <Button variant="outline" size="sm" class="relative">
                <ListVideo class="h-3.5 w-3.5 mr-1.5" />
                {{ $t("pages.highlights.queue") }}
                <span
                  v-if="queuedClips > 0"
                  class="ml-2 inline-flex items-center rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.15)] px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold tabular-nums text-[hsl(var(--tac-amber))]"
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
    <div class="flex flex-wrap items-center gap-2">
      <template v-if="isAdmin">
        <button
          v-for="opt in adminFilters"
          :key="opt.value"
          type="button"
          :class="[
            tacticalFilterPillClasses,
            visibilityFilter === opt.value && tacticalFilterPillActiveClasses,
          ]"
          @click="visibilityFilter = opt.value"
        >
          <component :is="opt.icon" v-if="opt.icon" class="h-3 w-3" />
          <span>{{ opt.label }}</span>
        </button>
        <span class="h-5 w-px bg-border/60 mx-1"></span>
      </template>

      <button
        v-if="playerFilter"
        type="button"
        :class="[
          tacticalFilterPillClasses,
          'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.22)]',
        ]"
        :title="$t('pages.highlights.clear_player_filter')"
        @click="clearPlayer"
      >
        <User class="h-3 w-3" />
        <span class="truncate max-w-[12rem]">
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
          :class="[tacticalFilterPillClasses]"
          :title="$t('pages.highlights.filter_by_player')"
        >
          <User class="h-3 w-3" />
          <span>{{ $t("clips.default_player") }}</span>
        </button>
      </PlayerSearch>

      <Select
        :model-value="sinceFilter"
        @update:model-value="(v) => setSince(v as SincePreset)"
      >
        <SelectTrigger
          class="h-8 w-auto min-w-[10rem] gap-2 rounded-full border-border/60 bg-muted/30 px-3 text-xs"
        >
          <Calendar class="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in SINCE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        :model-value="killsFilter"
        @update:model-value="(v) => setKills(v as KillsPreset)"
      >
        <SelectTrigger
          class="h-8 w-auto min-w-[9rem] gap-2 rounded-full border-border/60 bg-muted/30 px-3 text-xs"
          :class="
            killsFilter !== 'any'
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
              : ''
          "
        >
          <Crosshair
            class="h-3.5 w-3.5"
            :class="
              killsFilter !== 'any'
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground'
            "
          />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in KILLS_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div
        class="ml-auto flex items-center rounded-full border border-border/60 bg-muted/30 p-0.5"
        role="group"
        :aria-label="$t('pages.highlights.view_mode')"
      >
        <button
          v-for="opt in viewModeOptions"
          :key="opt.value"
          type="button"
          :disabled="hasActiveFilter && opt.value === 'matches'"
          :title="
            hasActiveFilter && opt.value === 'matches'
              ? $t('pages.highlights.view_mode_filter_disabled')
              : undefined
          "
          :class="[
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors',
            effectiveMode === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            hasActiveFilter && opt.value === 'matches'
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

      <span
        v-if="!loading"
        class="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground tabular-nums"
      >
        {{ totalCount }}
        {{ $t("pages.highlights.result_count", totalCount) }}
      </span>
    </div>
  </PageTransition>

  <PageTransition v-if="loading" :delay="80" class="mt-6">
    <div
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
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
          :class="[tacticalFilterPillClasses]"
          @click="clearPlayer"
        >
          <X class="h-3 w-3" />
          {{ $t("pages.highlights.empty.clear_player") }}
        </button>
        <button
          v-if="sinceFilter !== 'all'"
          type="button"
          :class="[tacticalFilterPillClasses]"
          @click="setSince('all')"
        >
          <X class="h-3 w-3" />
          {{ $t("pages.highlights.empty.clear_date") }}
        </button>
        <button
          v-if="killsFilter !== 'any'"
          type="button"
          :class="[tacticalFilterPillClasses]"
          @click="setKills('any')"
        >
          <X class="h-3 w-3" />
          {{ $t("pages.highlights.empty.clear_kills") }}
        </button>
      </div>
    </Empty>
  </PageTransition>

  <PageTransition v-else :delay="80" class="mt-6">
    <div
      class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
