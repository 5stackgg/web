<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Film,
  Loader2,
  Lock,
  Eye,
  Globe,
  Clapperboard,
  ListVideo,
  Calendar,
  User,
  X,
} from "lucide-vue-next";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { matchClipFields } from "~/graphql/matchClip";
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
import type { Clip } from "~/types/clip";
import { useClipModal, type ClipQueueItem } from "~/composables/useClipModal";
import {
  tacticalFilterPillClasses,
  tacticalFilterPillActiveClasses,
} from "~/utilities/tacticalClasses";

const clipQueueScope = "highlights-index";
const { clearClipQueue, setClipQueue } = useClipModal();

// Single Highlights surface for everyone. Hasura row-level permissions
// gate which clips each role sees. Curators (streamer+) get extra
// affordances: visibility filters (admin only), per-card visibility
// toggles (admin only), delete, and a slide-in render queue.

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

const clips = ref<Clip[]>([]);
const loading = ref(true);
const visibilityFilter = ref<Filter>("all");
const queueOpen = ref(false);

// URL-driven filters: ?player=<sid>, ?since=<preset>.
const route = useRoute();
const router = useRouter();

type SincePreset = "all" | "24h" | "7d" | "30d" | "90d";
const SINCE_OPTIONS: Array<{ value: SincePreset; label: string }> = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const playerFilter = computed<string | null>(() => {
  const v = route.query.player;
  return typeof v === "string" && v.length > 0 ? v : null;
});
const sinceFilter = computed<SincePreset>(() => {
  const v = route.query.since;
  if (typeof v === "string") {
    const match = SINCE_OPTIONS.find((o) => o.value === v);
    if (match) return match.value;
  }
  return "all";
});

function setSince(v: SincePreset) {
  const next = { ...route.query } as Record<string, any>;
  if (v === "all") delete next.since;
  else next.since = v;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

function clearPlayer() {
  pickedPlayerName.value = null;
  const next = { ...route.query } as Record<string, any>;
  delete next.player;
  router.replace({ path: route.path, query: next, hash: route.hash });
}

// Cache so the chip shows the right label during the re-subscribe gap.
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
  // Filter is target-scoped — don't fall back to user (the author).
  for (const c of clips.value) {
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

// Render-queue counters for the "Queue" button. Hasura aggregate subs
// need a non-empty selection set to push deltas, so we subscribe to
// (id, status) and split active/queued client-side.
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

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  loading.value = true;
  // Admins see all visibilities; non-admins are trimmed by Hasura row perms.
  const conditions: any[] = [];
  if (!isAdmin.value) {
    conditions.push({ visibility: { _eq: "public" } });
  }
  if (playerFilter.value) {
    // Scope by clip target, not author.
    conditions.push({ target_steam_id: { _eq: playerFilter.value } });
  }
  const cutoff = sinceCutoffIso(sinceFilter.value);
  if (cutoff) {
    conditions.push({ created_at: { _gte: cutoff } });
  }
  const where = conditions.length === 0 ? {} : { _and: conditions };
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      match_clips: [
        {
          where,
          order_by: [{ created_at: "desc" }],
          limit: 200,
        } as any,
        matchClipFields,
      ],
    } as any),
  });
  activeSub = obs.subscribe({
    next: ({ data }: any) => {
      clips.value = data?.match_clips ?? [];
      loading.value = false;
    },
    error: (err: any) => {
      console.error("[highlights] subscription error:", err);
      loading.value = false;
    },
  });
}
subscribe();

watch([playerFilter, sinceFilter, isAdmin], () => subscribe());
onBeforeUnmount(() => {
  activeSub?.unsubscribe();
  pendingSub?.unsubscribe();
  clearClipQueue(clipQueueScope);
});

const counts = computed(() => {
  const byVis: Record<Filter, number> = {
    all: clips.value.length,
    public: 0,
    private: 0,
    unlisted: 0,
  };
  for (const c of clips.value)
    byVis[c.visibility] = (byVis[c.visibility] ?? 0) + 1;
  return byVis;
});

const filteredClips = computed(() => {
  if (!isAdmin.value) return clips.value;
  if (visibilityFilter.value === "all") return clips.value;
  return clips.value.filter((c) => c.visibility === visibilityFilter.value);
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
  setClipQueue(filteredClips.value.map(clipQueueItem), clipQueueScope);
});

const hasClips = computed(() => filteredClips.value.length > 0);

// Multi-clip matches collapse to a MatchClipsGroupCard, singletons
// stay as HighlightCards. Subscription capped at 200, so client-side
// grouping is fine.
type GridItem =
  | { kind: "single"; clip: Clip; sortKey: string }
  | { kind: "group"; matchId: string; clips: Clip[]; sortKey: string };
const gridItems = computed<GridItem[]>(() => {
  const byMatch = new Map<string, Clip[]>();
  const orphans: Clip[] = [];
  for (const c of filteredClips.value) {
    const matchId = c.match_map?.match?.id;
    if (!matchId) {
      orphans.push(c);
      continue;
    }
    const list = byMatch.get(matchId) ?? [];
    list.push(c);
    byMatch.set(matchId, list);
  }
  const items: GridItem[] = [];
  for (const [matchId, group] of byMatch) {
    // Newest-first so the lead drives display.
    const sorted = [...group].sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
    );
    if (sorted.length === 1) {
      items.push({
        kind: "single",
        clip: sorted[0],
        sortKey: sorted[0].created_at,
      });
    } else {
      items.push({
        kind: "group",
        matchId,
        clips: sorted,
        sortKey: sorted[0].created_at,
      });
    }
  }
  for (const c of orphans) {
    items.push({ kind: "single", clip: c, sortKey: c.created_at });
  }
  return items.sort((a, b) =>
    a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0,
  );
});

const adminFilters: Array<{ value: Filter; label: string; icon?: any }> = [
  { value: "all", label: "All" },
  { value: "public", label: "Public", icon: Globe },
  { value: "unlisted", label: "Unlisted", icon: Eye },
  { value: "private", label: "Private", icon: Lock },
];
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>
        <Film class="h-3.5 w-3.5" />
        Community Reel
      </template>
      <template #title>Highlights</template>
      <template #actions>
        <div class="flex items-center gap-3">
          <div
            class="hidden sm:flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Clapperboard class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
            <span>
              <span class="text-foreground font-semibold">{{
                counts.all
              }}</span>
              {{ counts.all === 1 ? "clip" : "clips" }}
            </span>
            <template v-if="isAdmin">
              <span class="text-border">·</span>
              <span>{{ counts.public }} public</span>
            </template>
          </div>
          <Sheet v-if="canCurate" v-model:open="queueOpen">
            <SheetTrigger as-child>
              <Button variant="outline" size="sm" class="relative">
                <ListVideo class="h-3.5 w-3.5 mr-1.5" />
                Queue
                <span
                  v-if="pendingClips > 0"
                  class="ml-2 inline-flex items-center gap-1 font-mono text-[0.6rem] font-semibold tabular-nums"
                  :title="`${activeClips} active · ${queuedClips} queued`"
                >
                  <span
                    class="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.15)] px-1.5 py-0.5 text-[hsl(var(--tac-amber))]"
                  >
                    <Loader2
                      v-if="activeClips > 0"
                      class="h-2.5 w-2.5 animate-spin"
                    />
                    {{ activeClips }}
                  </span>
                  <span
                    class="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-1.5 py-0.5 text-muted-foreground"
                  >
                    {{ queuedClips }}
                  </span>
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
                  Render Queue
                </SheetTitle>
                <SheetDescription>
                  Active and recently-finished render batches across the
                  platform.
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
          <span class="font-mono tabular-nums opacity-70">
            {{ counts[opt.value] }}
          </span>
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
        :title="`Clear player filter`"
        @click="clearPlayer"
      >
        <User class="h-3 w-3" />
        <span class="truncate max-w-[12rem]">
          {{ playerFilterName ?? "Player" }}
        </span>
        <X class="h-3 w-3 opacity-70" />
      </button>

      <PlayerSearch v-else label="Filter by player" @selected="selectPlayer">
        <button
          type="button"
          :class="[tacticalFilterPillClasses]"
          title="Filter by player"
        >
          <User class="h-3 w-3" />
          <span>Player</span>
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

      <span
        v-if="!loading"
        class="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground tabular-nums"
      >
        {{ filteredClips.length }}
        {{ filteredClips.length === 1 ? "result" : "results" }}
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
          playerFilter || sinceFilter !== "all"
            ? "No clips match these filters"
            : "No clips here yet"
        }}
      </EmptyTitle>
      <EmptyDescription>
        <template v-if="playerFilter || sinceFilter !== 'all'">
          Try widening the date range or clearing the player filter.
        </template>
        <template v-else-if="isAdmin">
          Try a different filter — or wait for new clips to render.
        </template>
        <template v-else>
          Public clips will appear here as they're rendered. Check back soon.
        </template>
      </EmptyDescription>
      <div
        v-if="playerFilter || sinceFilter !== 'all'"
        class="mt-3 flex flex-wrap items-center justify-center gap-2"
      >
        <button
          v-if="playerFilter"
          type="button"
          :class="[tacticalFilterPillClasses]"
          @click="clearPlayer"
        >
          <X class="h-3 w-3" />
          Clear player
        </button>
        <button
          v-if="sinceFilter !== 'all'"
          type="button"
          :class="[tacticalFilterPillClasses]"
          @click="setSince('all')"
        >
          <X class="h-3 w-3" />
          Clear date
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
        />
      </template>
    </div>
  </PageTransition>
</template>
