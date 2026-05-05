<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  Loader2,
  CircleSlash,
  CheckCircle2,
  AlertCircle,
  ListVideo,
  X,
  Clock,
  Upload,
  Film,
  Swords,
  CircleDot,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  generateMutation,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { clipRenderJobFields } from "~/graphql/clipRenderJob";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

// Operator panel for the render queue. One card per match_map batch
// (one pod processes the batch sequentially), every job in the batch
// shown vertically with status, progress, and timing. Cancel happens
// at batch level — the pod's render script reads each row's status
// before each clip and skips on `cancelled`, plus the cancel mutation
// tears down the pod itself.
type Job = {
  id: string;
  user_steam_id: string;
  match_map_id: string;
  status: string;
  progress: number | string | null;
  error_message: string | null;
  clip_id: string | null;
  created_at: string;
  last_status_at: string | null;
  spec: any;
  user?: { steam_id: string; name: string; avatar_url: string | null } | null;
  match_map?: {
    id: string;
    map?: { name: string; poster: string | null; label: string | null } | null;
    match?: {
      id: string;
      lineup_1?: { name: string } | null;
      lineup_2?: { name: string } | null;
    } | null;
  } | null;
};

const props = withDefaults(
  defineProps<{
    // Compact mode trims to in-flight batches with one summary line each.
    // Used when embedded somewhere small (formerly the Manage Highlights
    // summary). Keep the full layout for the dedicated queue surface.
    compact?: boolean;
  }>(),
  { compact: false },
);

const nuxtApp = useNuxtApp();
const jobs = ref<Job[]>([]);
const loading = ref(true);
const cancellingBatch = ref<Record<string, boolean>>({});
const finishedExpanded = ref<Record<string, boolean>>({});

function toggleFinishedExpanded(matchMapId: string) {
  finishedExpanded.value = {
    ...finishedExpanded.value,
    [matchMapId]: !finishedExpanded.value[matchMapId],
  };
}

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  // Limit covers active batches + the last ~12 finished BATCHES we
  // show in "Recently Finished". 200 is roughly 20 × 10-clip batches —
  // plenty of headroom even when several large recap runs land back-
  // to-back. The grouping logic still slices the finished list to 12,
  // so this just bounds the worst-case payload.
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      clip_render_jobs: [
        {
          order_by: [{ created_at: "desc" }],
          limit: 200,
        } as any,
        clipRenderJobFields,
      ],
    } as any),
  });
  activeSub = obs.subscribe({
    next: ({ data }: any) => {
      jobs.value = data?.clip_render_jobs ?? [];
      loading.value = false;
    },
    error: (err: any) => {
      console.error("[render-queue] subscription error:", err);
      loading.value = false;
    },
  });
}
subscribe();
onBeforeUnmount(() => activeSub?.unsubscribe());

const TERMINAL = new Set(["done", "error", "cancelled"]);

// Ordering inside a batch: active phases first, then queued, then any
// already-terminal jobs at the bottom. Within a phase the rows still
// follow created_at so the operator's mental model ("clip 3 of 10") is
// preserved when statuses cycle through quickly.
const STATUS_ORDER: Record<string, number> = {
  rendering: 0,
  uploading: 1,
  queued: 2,
  done: 3,
  error: 3,
  cancelled: 3,
};

// Group EVERY visible job by match_map_id, then bucket batches into
// "active" (at least one in-flight job) and "recently finished" (every
// job is terminal). Active batches keep their already-completed jobs
// inline so the operator sees the whole 10-of-10 ladder advance, not
// just the queued tail. The previous version moved finished jobs to a
// flat "Recently Finished" list as soon as they hit done/error, which
// made it look like they were no longer part of the batch.
type BatchGroup = {
  matchMapId: string;
  jobs: Job[];
  activeJob: Job | undefined;
  sample: Job;
  startedAt: string;
  totalCount: number;
  doneCount: number;
  errorCount: number;
  cancelledCount: number;
  terminalCount: number;
  inFlightCount: number;
  // 0..1 across the batch: per-job render fraction summed and divided
  // by total. Lets the header bar show 23% even when only 1 of 10
  // jobs is mid-render.
  overallProgress: number;
  // True when every job has reached a terminal state.
  isFinished: boolean;
};

function buildBatchGroup(matchMapId: string, list: Job[]): BatchGroup {
  const sorted = [...list].sort((a, b) => {
    const ord =
      (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (ord !== 0) return ord;
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });
  const activeJob = sorted.find(
    (j) => j.status === "rendering" || j.status === "uploading",
  );
  const oldest = sorted.reduce<string>(
    (acc, j) => (j.created_at < acc ? j.created_at : acc),
    sorted[0].created_at,
  );
  let doneCount = 0;
  let errorCount = 0;
  let cancelledCount = 0;
  let progressSum = 0;
  for (const j of sorted) {
    if (j.status === "done") {
      doneCount++;
      progressSum += 1;
    } else if (j.status === "error") {
      errorCount++;
    } else if (j.status === "cancelled") {
      cancelledCount++;
    } else if (j.status === "rendering") {
      const n =
        typeof j.progress === "number" ? j.progress : Number(j.progress);
      progressSum += Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    } else if (j.status === "uploading") {
      // Upload phase has no real % signal, but the render did finish —
      // count it as effectively done for batch progress.
      progressSum += 1;
    }
  }
  const terminalCount = doneCount + errorCount + cancelledCount;
  const inFlightCount = sorted.length - terminalCount;
  const overallProgress = sorted.length === 0 ? 0 : progressSum / sorted.length;
  return {
    matchMapId,
    jobs: sorted,
    activeJob,
    sample: sorted[0],
    startedAt: oldest,
    totalCount: sorted.length,
    doneCount,
    errorCount,
    cancelledCount,
    terminalCount,
    inFlightCount,
    overallProgress,
    isFinished: inFlightCount === 0,
  };
}

const allGroups = computed<BatchGroup[]>(() => {
  const map = new Map<string, Job[]>();
  for (const j of jobs.value) {
    const list = map.get(j.match_map_id) ?? [];
    list.push(j);
    map.set(j.match_map_id, list);
  }
  return Array.from(map.entries()).map(([matchMapId, list]) =>
    buildBatchGroup(matchMapId, list),
  );
});

const groups = computed(() =>
  allGroups.value
    .filter((g) => !g.isFinished)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
);

const recentlyDoneGroups = computed(() =>
  allGroups.value
    .filter((g) => g.isFinished)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 12),
);

const inFlight = computed(() =>
  jobs.value.filter((j) => !TERMINAL.has(j.status)),
);

function progressPct(j: Job): number {
  const n = typeof j.progress === "number" ? j.progress : Number(j.progress);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

function statusLabel(s: string): string {
  switch (s) {
    case "queued":
      return "Queued";
    case "rendering":
      return "Rendering";
    case "uploading":
      return "Uploading";
    case "done":
      return "Done";
    case "error":
      return "Error";
    case "cancelled":
      return "Cancelled";
    default:
      return s;
  }
}

const STATUS_TONE: Record<
  string,
  { dot: string; pill: string; iconColor: string }
> = {
  queued: {
    dot: "bg-muted-foreground/60",
    pill: "border-border/60 bg-muted/30 text-muted-foreground",
    iconColor: "text-muted-foreground",
  },
  rendering: {
    dot: "bg-[hsl(var(--tac-amber))]",
    pill: "border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]",
    iconColor: "text-[hsl(var(--tac-amber))]",
  },
  uploading: {
    dot: "bg-primary",
    pill: "border-primary/40 bg-primary/10 text-primary",
    iconColor: "text-primary",
  },
  done: {
    dot: "bg-emerald-400",
    pill: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
    iconColor: "text-emerald-400",
  },
  error: {
    dot: "bg-destructive",
    pill: "border-destructive/40 bg-destructive/10 text-destructive",
    iconColor: "text-destructive",
  },
  cancelled: {
    dot: "bg-muted-foreground/40",
    pill: "border-border/60 bg-muted/30 text-muted-foreground/80",
    iconColor: "text-muted-foreground/70",
  },
};

function clipTitle(j: Job): string {
  const t = j.spec?.title;
  if (typeof t === "string" && t.length > 0) return t;
  const target = j.spec?.target_name;
  if (typeof target === "string" && target.length > 0) return `${target} clip`;
  return `Render ${j.id.slice(0, 8)}`;
}

function matchupLabel(j: Job): string | null {
  const a = j.match_map?.match?.lineup_1?.name;
  const b = j.match_map?.match?.lineup_2?.name;
  if (a && b) return `${a} vs ${b}`;
  return null;
}

function clipDurationLabel(j: Job): string | null {
  const segs = j.spec?.segments;
  if (!Array.isArray(segs) || segs.length === 0) return null;
  // Fall back to segment count when ms isn't on the spec.
  const ms = typeof j.spec?.duration_ms === "number" ? j.spec.duration_ms : 0;
  if (ms > 0) {
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return `${segs.length} seg${segs.length === 1 ? "" : "s"}`;
}

async function cancelBatch(matchMapId: string) {
  if (cancellingBatch.value[matchMapId]) return;
  cancellingBatch.value = { ...cancellingBatch.value, [matchMapId]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        cancelClipRenderBatch: [
          { match_map_id: matchMapId },
          { success: true },
        ],
      } as any),
    });
  } catch (e) {
    console.error("[render-queue] batch cancel failed:", e);
  } finally {
    cancellingBatch.value = { ...cancellingBatch.value, [matchMapId]: false };
  }
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

const totalInFlight = computed(() => inFlight.value.length);
const totalActive = computed(
  () => inFlight.value.filter((j) => j.status === "rendering" || j.status === "uploading").length,
);
const totalQueued = computed(
  () => inFlight.value.filter((j) => j.status === "queued").length,
);
</script>

<template>
  <div
    v-if="!loading && (groups.length > 0 || (!compact && recentlyDoneGroups.length > 0))"
    class="space-y-5"
  >
    <!-- Top-line summary: in-flight count + breakdown. Anchors the panel
         when there's nothing currently rendering but recently-finished
         items are still listed. -->
    <div
      v-if="!compact && groups.length > 0"
      class="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2 [backdrop-filter:blur(6px)]"
    >
      <div class="flex items-center gap-2">
        <ListVideo class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
        <span class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          In Flight
        </span>
        <span class="font-mono text-sm font-semibold tabular-nums">
          {{ totalInFlight }}
        </span>
      </div>
      <div class="ml-auto flex items-center gap-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
        <span class="inline-flex items-center gap-1.5">
          <Loader2 class="h-3 w-3 animate-spin text-[hsl(var(--tac-amber))]" />
          {{ totalActive }} active
        </span>
        <span class="text-border">·</span>
        <span class="inline-flex items-center gap-1.5">
          <Clock class="h-3 w-3" />
          {{ totalQueued }} queued
        </span>
      </div>
    </div>

    <!-- Active batches — one card per match_map. Each card stacks
         vertically: header w/ matchup + cancel, hero progress for the
         active job, then the per-job ladder. -->
    <div v-if="groups.length" class="space-y-3">
      <Card
        v-for="g in groups"
        :key="g.matchMapId"
        class="overflow-hidden border-border/60"
      >
        <!-- Header banner: map poster background, lineup matchup label -->
        <div class="relative">
          <div
            v-if="g.sample.match_map?.map?.poster"
            class="absolute inset-0 -z-0"
          >
            <NuxtImg
              :src="g.sample.match_map.map.poster"
              :alt="g.sample.match_map.map.name ?? ''"
              class="h-full w-full object-cover opacity-25"
            />
            <div
              class="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-card/40"
            ></div>
          </div>
          <div class="relative flex items-start gap-3 p-3 sm:p-4">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)]"
            >
              <Film class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  v-if="matchupLabel(g.sample)"
                  class="inline-flex items-center gap-1.5 truncate font-semibold leading-tight"
                >
                  <Swords class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span class="truncate">{{ matchupLabel(g.sample) }}</span>
                </span>
                <span v-else class="truncate font-semibold leading-tight">
                  {{ g.sample.match_map?.map?.label ?? g.sample.match_map?.map?.name ?? "Unknown match" }}
                </span>
              </div>
              <div
                class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span v-if="g.sample.match_map?.map?.label || g.sample.match_map?.map?.name">
                  {{ g.sample.match_map.map.label ?? g.sample.match_map.map.name }}
                </span>
                <span v-if="g.sample.match_map?.map" class="text-border">·</span>
                <span class="tabular-nums">
                  {{ g.terminalCount }}/{{ g.totalCount }} done
                </span>
                <span v-if="g.errorCount > 0" class="text-destructive/80">
                  · {{ g.errorCount }} err
                </span>
                <span class="text-border">·</span>
                <span class="inline-flex items-center gap-1">
                  <Clock class="h-3 w-3" />
                  {{ formatTimeAgo(g.startedAt) }}
                </span>
              </div>
              <!-- Batch-level progress: aggregates per-job render % so a
                   long batch shows steady forward motion at the top
                   instead of "23% / 0% / 0% / …" per row only. -->
              <div class="mt-2 space-y-1">
                <div class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>Batch progress</span>
                  <span class="tabular-nums">{{ Math.round(g.overallProgress * 100) }}%</span>
                </div>
                <div class="relative h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div
                    class="h-full rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-300"
                    :style="{ width: Math.round(g.overallProgress * 100) + '%' }"
                  ></div>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              class="h-7 shrink-0 px-2 text-[0.7rem] hover:border-destructive hover:text-destructive"
              :disabled="cancellingBatch[g.matchMapId]"
              @click="cancelBatch(g.matchMapId)"
            >
              <Loader2
                v-if="cancellingBatch[g.matchMapId]"
                class="h-3 w-3 mr-1 animate-spin"
              />
              <X v-else class="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>

        <!-- Hero progress for the active job (compact mode hides this). -->
        <div
          v-if="g.activeJob && !compact"
          class="border-t border-border/40 px-3 py-3 sm:px-4"
        >
          <div class="mb-2 flex items-center gap-2">
            <span class="relative flex h-2 w-2 shrink-0">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                :class="STATUS_TONE[g.activeJob.status]?.dot"
              ></span>
              <span
                class="relative inline-flex h-2 w-2 rounded-full"
                :class="STATUS_TONE[g.activeJob.status]?.dot"
              ></span>
            </span>
            <span class="truncate text-sm font-medium">
              {{ clipTitle(g.activeJob) }}
            </span>
            <span
              class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em]"
              :class="STATUS_TONE[g.activeJob.status]?.pill"
            >
              {{ statusLabel(g.activeJob.status) }}
              <span class="opacity-60">·</span>
              {{ formatTimeAgo(g.activeJob.last_status_at ?? g.activeJob.created_at) }}
            </span>
          </div>

          <!-- Two-phase progress visual. Render bar fills during 'rendering';
               upload pulses during 'uploading' (no bytes-progress signal). -->
          <div class="space-y-2">
            <div class="space-y-1">
              <div class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                <span class="inline-flex items-center gap-1.5">
                  <Film class="h-3 w-3" />
                  Render
                </span>
                <span class="tabular-nums">
                  {{
                    g.activeJob.status === "rendering"
                      ? progressPct(g.activeJob) + "%"
                      : g.activeJob.status === "queued"
                        ? "—"
                        : "100%"
                  }}
                </span>
              </div>
              <div class="relative h-1.5 overflow-hidden rounded-full bg-muted/40">
                <div
                  class="h-full rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-300"
                  :style="{
                    width:
                      g.activeJob.status === 'rendering'
                        ? progressPct(g.activeJob) + '%'
                        : g.activeJob.status === 'queued'
                          ? '0%'
                          : '100%',
                  }"
                ></div>
              </div>
            </div>
            <div class="space-y-1">
              <div class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                <span class="inline-flex items-center gap-1.5">
                  <Upload class="h-3 w-3" />
                  Upload
                </span>
                <span class="tabular-nums">
                  {{
                    g.activeJob.status === "uploading"
                      ? "…"
                      : g.activeJob.status === "done"
                        ? "100%"
                        : "—"
                  }}
                </span>
              </div>
              <div
                v-if="g.activeJob.status === 'uploading'"
                class="relative h-1.5 overflow-hidden rounded-full bg-primary/20"
              >
                <div class="upload-pulse-bar" />
              </div>
              <div
                v-else
                class="h-1.5 rounded-full bg-muted/40"
                :class="g.activeJob.status === 'done' && '!bg-primary'"
              ></div>
            </div>
          </div>
        </div>

        <!-- Per-job ladder: every clip in the batch with its own status + meta.
             Compact mode collapses this to a single summary line. -->
        <div v-if="!compact" class="border-t border-border/40 divide-y divide-border/30">
          <div
            v-for="j in g.jobs"
            :key="j.id"
            class="flex items-center gap-3 px-3 py-2 sm:px-4"
            :class="{ 'bg-[hsl(var(--tac-amber)/0.04)]': j === g.activeJob }"
          >
            <component
              :is="
                j.status === 'rendering' || j.status === 'uploading'
                  ? Loader2
                  : j.status === 'queued'
                    ? Clock
                    : j.status === 'done'
                      ? CheckCircle2
                      : j.status === 'cancelled'
                        ? CircleSlash
                        : j.status === 'error'
                          ? AlertCircle
                          : CircleDot
              "
              class="h-3.5 w-3.5 shrink-0"
              :class="[
                STATUS_TONE[j.status]?.iconColor,
                (j.status === 'rendering' || j.status === 'uploading') && 'animate-spin',
              ]"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm">{{ clipTitle(j) }}</span>
                <span
                  v-if="clipDurationLabel(j)"
                  class="shrink-0 font-mono text-[0.6rem] tabular-nums text-muted-foreground/70"
                >
                  {{ clipDurationLabel(j) }}
                </span>
              </div>
              <div
                v-if="j.user?.name || j.spec?.target_name"
                class="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/70"
              >
                <span v-if="j.spec?.target_name" class="text-foreground/70">
                  {{ j.spec.target_name }}
                </span>
                <span v-if="j.spec?.target_name && j.user?.name"> · </span>
                <span v-if="j.user?.name">by {{ j.user.name }}</span>
              </div>
            </div>
            <span
              class="shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.14em]"
              :class="STATUS_TONE[j.status]?.pill"
            >
              <template v-if="j.status === 'rendering'">
                {{ progressPct(j) }}%
              </template>
              <template v-else>
                {{ statusLabel(j.status) }}
              </template>
            </span>
            <NuxtLink
              v-if="j.status === 'done' && j.clip_id"
              :to="`/clips/${j.clip_id}`"
              class="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Open →
            </NuxtLink>
          </div>
        </div>

        <!-- Compact mode summary: skip the ladder, just say what the
             batch is doing in one line. -->
        <div
          v-else
          class="border-t border-border/40 px-3 py-2 sm:px-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          <span v-if="g.activeJob">
            {{ statusLabel(g.activeJob.status) }} · {{ clipTitle(g.activeJob) }}
          </span>
          <span v-else>
            {{ g.jobs.length }} queued
          </span>
        </div>
      </Card>
    </div>

    <!-- Recently finished — one line per BATCH (not per clip), so a
         10-job recap renders as a single row showing 10 outcomes
         instead of flooding the panel with 10 individual entries.
         Click expand to see the per-job ladder for that batch. -->
    <div v-if="!compact && recentlyDoneGroups.length" class="space-y-2">
      <div class="flex items-center gap-2">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/80"
        >
          Recently Finished
        </span>
        <span class="text-border">·</span>
        <span class="font-mono text-[0.6rem] tabular-nums text-muted-foreground/70">
          {{ recentlyDoneGroups.length }}
        </span>
      </div>
      <div class="space-y-1">
        <div
          v-for="g in recentlyDoneGroups"
          :key="g.matchMapId"
          class="rounded-md border border-border/40 bg-card/30 [backdrop-filter:blur(6px)]"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs"
            @click="toggleFinishedExpanded(g.matchMapId)"
          >
            <CheckCircle2
              v-if="g.errorCount === 0 && g.cancelledCount === 0"
              class="h-3.5 w-3.5 shrink-0 text-emerald-400"
            />
            <AlertCircle
              v-else-if="g.errorCount > 0"
              class="h-3.5 w-3.5 shrink-0 text-destructive"
            />
            <CircleSlash
              v-else
              class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate">
                <span v-if="matchupLabel(g.sample)">
                  {{ matchupLabel(g.sample) }}
                </span>
                <span v-else>
                  {{ g.sample.match_map?.map?.label ?? g.sample.match_map?.map?.name ?? "Unknown match" }}
                </span>
              </div>
              <div
                class="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70"
              >
                <span v-if="g.sample.match_map?.map?.label || g.sample.match_map?.map?.name">
                  {{ g.sample.match_map.map.label ?? g.sample.match_map.map.name }} ·
                </span>
                <span class="tabular-nums">{{ g.totalCount }} clip{{ g.totalCount === 1 ? "" : "s" }}</span>
                <span v-if="g.doneCount > 0" class="text-emerald-400/80">
                  · {{ g.doneCount }} done
                </span>
                <span v-if="g.errorCount > 0" class="text-destructive/80">
                  · {{ g.errorCount }} err
                </span>
                <span v-if="g.cancelledCount > 0" class="text-muted-foreground/70">
                  · {{ g.cancelledCount }} cancelled
                </span>
              </div>
            </div>
            <span class="shrink-0 font-mono text-[0.58rem] tabular-nums text-muted-foreground/70">
              {{ formatTimeAgo(g.startedAt) }}
            </span>
          </button>
          <!-- Expanded ladder: same per-job rows as active batches use,
               minus the spinner. Operator can grab any successful clip
               or read the error_message of any failed one without
               scrolling somewhere else. -->
          <div
            v-if="finishedExpanded[g.matchMapId]"
            class="border-t border-border/30 divide-y divide-border/30"
          >
            <div
              v-for="j in g.jobs"
              :key="j.id"
              class="flex items-center gap-3 px-2.5 py-1.5"
            >
              <component
                :is="
                  j.status === 'done'
                    ? CheckCircle2
                    : j.status === 'cancelled'
                      ? CircleSlash
                      : AlertCircle
                "
                class="h-3.5 w-3.5 shrink-0"
                :class="STATUS_TONE[j.status]?.iconColor"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs" :title="j.error_message ?? clipTitle(j)">
                  {{ clipTitle(j) }}
                </div>
                <div
                  v-if="j.error_message"
                  class="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-destructive/80"
                >
                  {{ j.error_message }}
                </div>
              </div>
              <NuxtLink
                v-if="j.status === 'done' && j.clip_id"
                :to="`/clips/${j.clip_id}`"
                class="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Open →
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Indeterminate "uploading" track. Short bright gradient slides
   across so the user sees activity without an accurate percentage. */
.upload-pulse-bar {
  position: absolute;
  inset: 0;
  width: 30%;
  border-radius: 9999px;
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--primary)) 50%,
    transparent
  );
  animation: upload-pulse 1.4s linear infinite;
}
@keyframes upload-pulse {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}
</style>
