<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
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
  Check,
  CircleDashed,
  Server,
  ExternalLink,
  RotateCcw,
  RotateCw,
  ChevronRight,
  Play,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { clipRenderJobFields } from "~/graphql/clipRenderJob";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useAuthStore } from "~/stores/AuthStore";
import { useClipModal, type ClipQueueItem } from "~/composables/useClipModal";

const authStore = useAuthStore();
const { showClip, setClipQueue } = useClipModal();
const isAdmin = computed(() => authStore.isAdmin);

// One card per match_map batch (one pod processes a batch
// sequentially). Cancel is batch-level — the render script checks
// each row's status before each clip.
type StatusHistoryEntry = {
  status: string;
  at: string;
  boot_stage?: string;
  boot_progress?: number;
};

// Subset of the server-side ClipSpec the queue UI actually reads.
// Kept narrow here so the panel doesn't break if downstream fields
// rotate; full shape lives in graphql/clipRenderJob.ts (`ClipSpec`).
type JobSpec = {
  title?: string;
  target_name?: string;
  duration_ms?: number;
  round?: number;
  kills_count?: number;
  segments?: Array<unknown>;
};

type Job = {
  id: string;
  user_steam_id: string;
  match_map_id: string;
  status: string;
  progress: number | string | null;
  error_message: string | null;
  clip_id: string | null;
  created_at: string;
  sort_index: number;
  last_status_at: string | null;
  spec: JobSpec | null;
  status_history?: StatusHistoryEntry[] | null;
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
  match_map_demo?: {
    id: string;
    playback_url: string | null;
  } | null;
};

type DoneJob = Job & { clip_id: string };

// Boot stages a batch pod emits, in order. `meta` matches
// StreamSessionProgress vocabulary (required/conditional/implicit).
const QUEUE_BOOT_STAGES = computed<
  Array<{
    key: string;
    label: string;
    meta: "required" | "conditional" | "implicit";
    concurrentUntil?: string;
  }>
>(() => [
  {
    key: "downloading_demo",
    label: t("live_stages.downloading_demo"),
    meta: "required",
    // game-streamer.sh kicks the demo curl into the background before
    // setup-steam runs; run-demo.sh only blocks on the file when it
    // reaches launching_cs2 — stay "current" until then.
    concurrentUntil: "launching_cs2",
  },
  {
    key: "downloading_cs2",
    label: t("live_stages.downloading_cs2"),
    meta: "conditional",
  },
  {
    key: "launching_steam",
    label: t("live_stages.launching_steam"),
    meta: "required",
  },
  { key: "logging_in", label: t("live_stages.logging_in"), meta: "implicit" },
  {
    key: "downloading_workshop_map",
    label: t("live_stages.downloading_workshop_map"),
    meta: "conditional",
  },
  {
    key: "launching_cs2",
    label: t("live_stages.loading_demo_in_cs2"),
    meta: "required",
  },
  {
    key: "connecting_to_game",
    label: t("live_stages.queuing_demo"),
    meta: "implicit",
  },
]);

// Cold CS2 install + Steam login fits comfortably in 5 min; older
// booting ticks mean the broadcast loop died — fall back to the
// regular Cancel-able queue UI.
const BOOT_RECENCY_MS = 5 * 60 * 1000;

const props = withDefaults(
  defineProps<{
    // Trims to in-flight batches with a one-line summary each.
    compact?: boolean;
    // Hide the in-flight summary strip (host shows it).
    hideSummary?: boolean;
  }>(),
  { compact: false, hideSummary: false },
);

const nuxtApp = useNuxtApp();
// shallowRef: subscription pushes the full job list each tick (admins
// running heavy batches can see this fire every couple seconds). Job
// rows are treated as immutable snapshots — local edits go through the
// fresh array replacement path, never per-field mutation — so deep
// reactivity on every nested spec / status_history is pure overhead.
const inFlightJobs = shallowRef<Job[]>([]);
const finishedJobs = shallowRef<Job[]>([]);
const jobs = computed<Job[]>(() => [
  ...inFlightJobs.value,
  ...finishedJobs.value,
]);
const loading = ref(true);
const finishedLoading = ref(false);
const cancellingBatch = ref<Record<string, boolean>>({});
const clearingBatch = ref<Record<string, boolean>>({});
const clearingAllFinished = ref(false);
const finishedExpanded = ref<Record<string, boolean>>({});
const inFlightExpanded = ref<Record<string, boolean>>({});
const finishedJobsExpanded = ref<Record<string, boolean>>({});

// Default covers in-flight batches' just-completed siblings (a single
// Bo5 batch can have 50 rows; we want a few concurrent batches plus
// recent history). Load more bumps by FINISHED_PAGE_SIZE for browsing
// older runs.
const FINISHED_INITIAL_LIMIT = 300;
const FINISHED_PAGE_SIZE = 200;
const finishedLimit = ref(FINISHED_INITIAL_LIMIT);
const ACTIVE_BATCH_CLIP_THRESHOLD = 10;
const FINISHED_BATCH_CLIP_THRESHOLD = 20;

function toggleInFlightExpanded(matchMapId: string) {
  inFlightExpanded.value = {
    ...inFlightExpanded.value,
    [matchMapId]: !inFlightExpanded.value[matchMapId],
  };
}

function toggleFinishedJobsExpanded(matchMapId: string) {
  finishedJobsExpanded.value = {
    ...finishedJobsExpanded.value,
    [matchMapId]: !finishedJobsExpanded.value[matchMapId],
  };
}

function toggleFinishedExpanded(matchMapId: string) {
  finishedExpanded.value = {
    ...finishedExpanded.value,
    [matchMapId]: !finishedExpanded.value[matchMapId],
  };
}

// Split into two subscriptions so finished history can be paged
// independently of the (bounded) in-flight stream — a single
// 50-clip Bo5 batch can otherwise blow past any combined limit.
let inFlightSub: { unsubscribe: () => void } | null = null;
let finishedSub: { unsubscribe: () => void } | null = null;

function subscribeInFlight() {
  inFlightSub?.unsubscribe();
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      clip_render_jobs: [
        {
          where: {
            status: { _in: ["queued", "rendering", "uploading"] },
          },
          order_by: [{ created_at: "desc" }],
        } as any,
        clipRenderJobFields,
      ],
    } as any),
  });
  inFlightSub = obs.subscribe({
    next: ({ data }: any) => {
      inFlightJobs.value = data?.clip_render_jobs ?? [];
      loading.value = false;
    },
    error: (err: any) => {
      console.error("[render-queue] in-flight subscription error:", err);
      loading.value = false;
    },
  });
}

function subscribeFinished() {
  finishedSub?.unsubscribe();
  finishedLoading.value = true;
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      clip_render_jobs: [
        {
          where: {
            status: { _in: ["done", "error", "cancelled"] },
          },
          order_by: [{ created_at: "desc" }],
          limit: finishedLimit.value,
        } as any,
        clipRenderJobFields,
      ],
    } as any),
  });
  finishedSub = obs.subscribe({
    next: ({ data }: any) => {
      finishedJobs.value = data?.clip_render_jobs ?? [];
      finishedLoading.value = false;
    },
    error: (err: any) => {
      console.error("[render-queue] finished subscription error:", err);
      finishedLoading.value = false;
    },
  });
}

function loadMoreFinished() {
  finishedLimit.value += FINISHED_PAGE_SIZE;
  subscribeFinished();
}

subscribeInFlight();
subscribeFinished();
onBeforeUnmount(() => {
  inFlightSub?.unsubscribe();
  finishedSub?.unsubscribe();
});

const TERMINAL = new Set(["done", "error", "cancelled"]);

// Group jobs by match_map_id; bucket into active vs recently-finished.
// Active batches keep their finished jobs inline so the 10-of-10
// ladder advances visibly.
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
  // 0..1 across the batch — sum of per-job render fractions / total.
  overallProgress: number;
  isFinished: boolean;
  // Pod boot state — null once any job has left "queued" or no
  // recent booting tick exists. Same tick fans out to every job.
  bootInfo: {
    stage: string;
    stageSub: string | null;
    progress: number | null;
    at: string;
    firedStages: Set<string>;
  } | null;
};

function buildBatchGroup(matchMapId: string, list: Job[]): BatchGroup {
  // Sort by created_at, then sort_index — status-based sorting causes
  // visible jumps when jobs flip rendering → done. Batch-inserted rows
  // share the same created_at (one INSERT in clips.service.ts), so
  // sort_index is the stable tiebreaker matching the api's render-pod
  // dispatch order in BatchHighlightsRenderJob.fetchInFlightJobs. id is
  // a final fallback for legacy rows inserted before sort_index existed.
  const sorted = [...list].sort((a, b) => {
    if (a.created_at < b.created_at) return -1;
    if (a.created_at > b.created_at) return 1;
    const ai = a.sort_index ?? 0;
    const bi = b.sort_index ?? 0;
    if (ai !== bi) return ai - bi;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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
      // No % signal during upload, but render finished — count as done.
      progressSum += 1;
    }
  }
  const terminalCount = doneCount + errorCount + cancelledCount;
  const inFlightCount = sorted.length - terminalCount;
  const overallProgress = sorted.length === 0 ? 0 : progressSum / sorted.length;

  let bootInfo: BatchGroup["bootInfo"] = null;
  const noneStarted = sorted.every((j) => j.status === "queued");
  if (noneStarted) {
    const firedStages = new Set<string>();
    let latest: { entry: StatusHistoryEntry; at: number } | null = null;
    for (const j of sorted) {
      const history = j.status_history;
      if (!Array.isArray(history)) continue;
      for (const e of history) {
        if (e?.status !== "booting") continue;
        // boot_stage is "downloading_cs2:Validating" — strip sub-stage.
        if (typeof e.boot_stage === "string" && e.boot_stage) {
          firedStages.add(e.boot_stage.split(":")[0]);
        }
        const t = Date.parse(e.at);
        if (!Number.isFinite(t)) continue;
        if (!latest || t > latest.at) latest = { entry: e, at: t };
      }
    }
    if (latest && Date.now() - latest.at < BOOT_RECENCY_MS) {
      const raw = latest.entry.boot_stage ?? "";
      const [stage, stageSub = null] = raw.split(":");
      bootInfo = {
        stage: stage || "booting",
        stageSub: stageSub && stageSub.length > 0 ? stageSub : null,
        progress:
          typeof latest.entry.boot_progress === "number"
            ? Math.max(0, Math.min(1, latest.entry.boot_progress))
            : null,
        at: latest.entry.at,
        firedStages,
      };
    }
  }

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
    bootInfo,
  };
}

function stageStateFor(
  group: BatchGroup,
  stage: {
    key: string;
    meta: "required" | "conditional" | "implicit";
    concurrentUntil?: string;
  },
): "done" | "current" | "skipped" | "pending" {
  if (!group.bootInfo) return "pending";
  if (group.bootInfo.stage === stage.key) return "current";
  if (
    stage.concurrentUntil &&
    group.bootInfo.firedStages.has(stage.key) &&
    !group.bootInfo.firedStages.has(stage.concurrentUntil)
  ) {
    return "current";
  }
  if (group.bootInfo.firedStages.has(stage.key)) return "done";
  const order = QUEUE_BOOT_STAGES.value.findIndex((s) => s.key === stage.key);
  const currOrder = QUEUE_BOOT_STAGES.value.findIndex(
    (s) => s.key === group.bootInfo!.stage,
  );
  if (order >= 0 && currOrder >= 0 && order < currOrder) {
    return stage.meta === "conditional" ? "skipped" : "done";
  }
  return "pending";
}

function visibleBootStages(group: BatchGroup): typeof QUEUE_BOOT_STAGES.value {
  if (!group.bootInfo) return [];
  return QUEUE_BOOT_STAGES.value.filter((s) => {
    if (s.meta !== "implicit") return true;
    return (
      group.bootInfo!.firedStages.has(s.key) || group.bootInfo!.stage === s.key
    );
  });
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
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1)),
);

const recentlyDoneGroups = computed(() =>
  allGroups.value
    .filter((g) => g.isFinished)
    .sort((a, b) => (a.startedAt > b.startedAt ? -1 : 1)),
);

const canLoadMoreFinished = computed(
  () => finishedJobs.value.length >= finishedLimit.value,
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
      return t("render_queue_status.queued");
    case "rendering":
      return t("render_queue_status.rendering");
    case "uploading":
      return t("render_queue_status.uploading");
    case "done":
      return t("render_queue_status.done");
    case "error":
      return t("render_queue_status.error");
    case "cancelled":
      return t("render_queue_status.cancelled");
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

function isInFlightExpanded(g: BatchGroup): boolean {
  if (g.totalCount <= ACTIVE_BATCH_CLIP_THRESHOLD) return true;
  return !!inFlightExpanded.value[g.matchMapId];
}

function visibleInFlightJobs(g: BatchGroup): Job[] {
  if (isInFlightExpanded(g)) return g.jobs;
  // Collapsed: show only the active job (if any) — header summary
  // and active-clip detail block above already convey progress.
  return g.activeJob ? [g.activeJob] : [];
}

function isFinishedJobsExpanded(g: BatchGroup): boolean {
  if (g.totalCount <= FINISHED_BATCH_CLIP_THRESHOLD) return true;
  return !!finishedJobsExpanded.value[g.matchMapId];
}

function visibleFinishedJobs(g: BatchGroup): Job[] {
  if (isFinishedJobsExpanded(g)) return g.jobs;
  return g.jobs.slice(0, FINISHED_BATCH_CLIP_THRESHOLD);
}

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
  const ms = typeof j.spec?.duration_ms === "number" ? j.spec.duration_ms : 0;
  if (ms > 0) {
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return `${segs.length} seg${segs.length === 1 ? "" : "s"}`;
}

type ClipDetail = { label: string; tone?: "round" | "kills" };
function clipDetails(j: Job): ClipDetail[] {
  const out: ClipDetail[] = [];
  const round = j.spec?.round;
  if (typeof round === "number" && round > 0) {
    out.push({ label: `R${round}`, tone: "round" });
  }
  const kills = j.spec?.kills_count;
  if (typeof kills === "number" && kills > 0) {
    out.push({ label: `${kills}K`, tone: "kills" });
  }
  const segs = j.spec?.segments;
  if (Array.isArray(segs) && segs.length > 1) {
    out.push({ label: `${segs.length} seg` });
  }
  return out;
}

function clipQueueItemFromJob(j: DoneJob): ClipQueueItem {
  return {
    id: j.clip_id,
    title: j.spec?.title ?? null,
    playerName: j.spec?.target_name ?? null,
    teamName: null,
    durationMs: j.spec?.duration_ms ?? null,
    thumbnailUrl: null,
    posterUrl: j.match_map?.map?.poster ?? null,
  };
}

function openJobClip(g: BatchGroup, j: Job) {
  if (j.status !== "done" || !j.clip_id) return;
  const items = g.jobs
    .filter((job): job is DoneJob => job.status === "done" && !!job.clip_id)
    .map(clipQueueItemFromJob);
  setClipQueue(items, `render-queue:${g.matchMapId}`);
  showClip(j.clip_id);
}

const retryingBatch = ref<Record<string, boolean>>({});
async function retryBatch(matchMapId: string, onlyFailed: boolean) {
  const key = `${matchMapId}:${onlyFailed ? "failed" : "all"}`;
  if (retryingBatch.value[key]) return;
  retryingBatch.value = { ...retryingBatch.value, [key]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        retryClipRenderBatch: [
          { match_map_id: matchMapId, only_failed: onlyFailed },
          { success: true },
        ],
      } as any),
    });
    // Subscription will reflect new queued rows; drop old terminal
    // siblings locally so the card flips into in-flight immediately.
    finishedJobs.value = finishedJobs.value.filter(
      (j) =>
        j.match_map_id !== matchMapId || (onlyFailed && j.status === "done"),
    );
  } catch (e) {
    console.error("[render-queue] batch retry failed:", e);
  } finally {
    retryingBatch.value = { ...retryingBatch.value, [key]: false };
  }
}

const requeueingJob = ref<Record<string, boolean>>({});
async function requeueJob(jobId: string) {
  if (requeueingJob.value[jobId]) return;
  requeueingJob.value = { ...requeueingJob.value, [jobId]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        requeueClipRender: [{ job_id: jobId }, { success: true }],
      } as any),
    });
  } catch (e) {
    console.error("[render-queue] requeue failed:", e);
  } finally {
    requeueingJob.value = { ...requeueingJob.value, [jobId]: false };
  }
}

async function clearBatch(matchMapId: string) {
  if (clearingBatch.value[matchMapId]) return;
  clearingBatch.value = { ...clearingBatch.value, [matchMapId]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        clearClipRenderBatch: [{ match_map_id: matchMapId }, { success: true }],
      } as any),
    });
    finishedJobs.value = finishedJobs.value.filter(
      (j) => j.match_map_id !== matchMapId,
    );
  } catch (e) {
    console.error("[render-queue] batch clear failed:", e);
  } finally {
    clearingBatch.value = { ...clearingBatch.value, [matchMapId]: false };
  }
}

async function clearAllFinished() {
  if (clearingAllFinished.value) return;
  clearingAllFinished.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        clearFinishedClipRenders: [{}, { success: true }],
      } as any),
    });
    finishedJobs.value = [];
  } catch (e) {
    console.error("[render-queue] clear-all-finished failed:", e);
  } finally {
    clearingAllFinished.value = false;
  }
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
  () =>
    inFlight.value.filter(
      (j) => j.status === "rendering" || j.status === "uploading",
    ).length,
);
const totalQueued = computed(
  () => inFlight.value.filter((j) => j.status === "queued").length,
);
</script>

<template>
  <div
    v-if="
      !loading &&
      (groups.length > 0 || (!compact && recentlyDoneGroups.length > 0))
    "
    class="space-y-5"
  >
    <TooltipProvider :delay-duration="200" :disable-hoverable-content="true">
      <div
        v-if="!compact && !hideSummary && groups.length > 0"
        class="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2 [backdrop-filter:blur(6px)]"
      >
        <div class="flex items-center gap-2">
          <ListVideo class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          <span
            class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("clips.render_queue.in_flight") }}
          </span>
          <span class="font-mono text-sm font-semibold tabular-nums">
            {{ totalInFlight }}
          </span>
        </div>
        <div
          class="ml-auto flex items-center gap-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          <span class="inline-flex items-center gap-1.5">
            <Loader2
              class="h-3 w-3 animate-spin text-[hsl(var(--tac-amber))]"
            />
            {{ totalActive }} active
          </span>
          <span class="text-border">·</span>
          <span class="inline-flex items-center gap-1.5">
            <Clock class="h-3 w-3" />
            {{ totalQueued }} queued
          </span>
        </div>
      </div>

      <div v-if="groups.length" class="space-y-3">
        <Card
          v-for="g in groups"
          :key="g.matchMapId"
          class="overflow-hidden border-border/60"
        >
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
                  <NuxtLink
                    v-if="g.sample.match_map?.match?.id"
                    :to="`/matches/${g.sample.match_map.match.id}`"
                    class="inline-flex min-w-0 items-center gap-1.5 truncate font-semibold leading-tight hover:text-[hsl(var(--tac-amber))] transition-colors"
                  >
                    <Swords
                      v-if="matchupLabel(g.sample)"
                      class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    />
                    <span class="truncate">
                      {{
                        matchupLabel(g.sample) ??
                        g.sample.match_map?.map?.label ??
                        g.sample.match_map?.map?.name ??
                        "Unknown match"
                      }}
                    </span>
                    <ExternalLink class="h-3 w-3 shrink-0 opacity-60" />
                  </NuxtLink>
                  <span v-else class="truncate font-semibold leading-tight">
                    {{
                      g.sample.match_map?.map?.label ??
                      g.sample.match_map?.map?.name ??
                      "Unknown match"
                    }}
                  </span>
                </div>
                <div
                  class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  <span
                    v-if="
                      g.sample.match_map?.map?.label ||
                      g.sample.match_map?.map?.name
                    "
                  >
                    {{
                      g.sample.match_map.map.label ??
                      g.sample.match_map.map.name
                    }}
                  </span>
                  <span v-if="g.sample.match_map?.map" class="text-border"
                    >·</span
                  >
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
                <div class="mt-2 space-y-1">
                  <div
                    class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    <span>{{
                      g.bootInfo
                        ? $t("ui_extras.pod_boot")
                        : $t("ui_extras.batch_progress")
                    }}</span>
                    <span class="tabular-nums">
                      <template
                        v-if="g.bootInfo && g.bootInfo.progress !== null"
                      >
                        {{ Math.round(g.bootInfo.progress * 100) }}%
                      </template>
                      <template v-else-if="g.bootInfo">…</template>
                      <template v-else>
                        {{ Math.round(g.overallProgress * 100) }}%
                      </template>
                    </span>
                  </div>
                  <div
                    class="relative h-1.5 overflow-hidden rounded-full bg-muted/40"
                  >
                    <div
                      v-if="g.bootInfo"
                      class="h-full rounded-full bg-primary transition-[width] duration-300"
                      :style="{
                        width:
                          Math.round((g.bootInfo.progress ?? 0) * 100) + '%',
                      }"
                    ></div>
                    <div
                      v-else
                      class="h-full rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-300"
                      :style="{
                        width: Math.round(g.overallProgress * 100) + '%',
                      }"
                    ></div>
                  </div>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <Button
                  v-if="isAdmin && (g.errorCount > 0 || g.cancelledCount > 0)"
                  size="sm"
                  variant="outline"
                  class="h-7 px-2 text-[0.7rem] hover:border-[hsl(var(--tac-amber))] hover:text-[hsl(var(--tac-amber))]"
                  :disabled="retryingBatch[`${g.matchMapId}:failed`]"
                  @click="retryBatch(g.matchMapId, true)"
                >
                  <Loader2
                    v-if="retryingBatch[`${g.matchMapId}:failed`]"
                    class="h-3 w-3 mr-1 animate-spin"
                  />
                  <RotateCcw v-else class="h-3 w-3 mr-1" />
                  Retry failed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 px-2 text-[0.7rem] hover:border-destructive hover:text-destructive"
                  :disabled="cancellingBatch[g.matchMapId]"
                  @click="cancelBatch(g.matchMapId)"
                >
                  <Loader2
                    v-if="cancellingBatch[g.matchMapId]"
                    class="h-3 w-3 mr-1 animate-spin"
                  />
                  <X v-else class="h-3 w-3 mr-1" />
                  {{ $t("common.cancel") }}
                </Button>
              </div>
            </div>
          </div>

          <div
            v-if="g.bootInfo && !compact"
            class="border-t border-border/40 px-3 py-3 sm:px-4 bg-primary/[0.03]"
          >
            <div class="mb-2 flex items-center gap-2">
              <span
                class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10"
              >
                <Server class="h-3 w-3 text-primary" />
              </span>
              <span class="text-sm font-medium">Render pod booting</span>
              <span
                class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-primary"
              >
                <Loader2 class="h-2.5 w-2.5 animate-spin" />
                {{ g.bootInfo.stage.replace(/_/g, " ") }}
                <span v-if="g.bootInfo.stageSub" class="opacity-70">
                  · {{ g.bootInfo.stageSub }}
                </span>
              </span>
            </div>
            <ul class="flex flex-col gap-1">
              <li
                v-for="stage in visibleBootStages(g)"
                :key="stage.key"
                class="flex items-center gap-2.5 text-xs"
                :class="{
                  'text-muted-foreground/60':
                    stageStateFor(g, stage) === 'pending',
                  'text-muted-foreground/40 line-through decoration-muted-foreground/30':
                    stageStateFor(g, stage) === 'skipped',
                  'text-foreground': stageStateFor(g, stage) === 'done',
                  'text-primary font-medium':
                    stageStateFor(g, stage) === 'current',
                }"
              >
                <span
                  class="w-4 h-4 inline-flex items-center justify-center shrink-0"
                >
                  <Check
                    v-if="stageStateFor(g, stage) === 'done'"
                    class="w-3.5 h-3.5"
                  />
                  <Loader2
                    v-else-if="stageStateFor(g, stage) === 'current'"
                    class="w-3.5 h-3.5 animate-spin"
                  />
                  <X
                    v-else-if="stageStateFor(g, stage) === 'skipped'"
                    class="w-3.5 h-3.5 opacity-50"
                  />
                  <CircleDashed v-else class="w-3.5 h-3.5 opacity-50" />
                </span>
                <span class="flex-1">{{ stage.label }}</span>
                <span
                  v-if="
                    stageStateFor(g, stage) === 'current' &&
                    g.bootInfo.progress !== null
                  "
                  class="font-mono text-[0.6rem] tabular-nums opacity-80"
                >
                  {{ Math.round(g.bootInfo.progress * 100) }}%
                </span>
                <span
                  v-else-if="stageStateFor(g, stage) === 'skipped'"
                  class="font-mono text-[0.6rem] uppercase tracking-wider opacity-50"
                >
                  skipped
                </span>
              </li>
            </ul>
          </div>

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
              <template v-for="d in clipDetails(g.activeJob)" :key="d.label">
                <span
                  class="shrink-0 inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] tabular-nums"
                  :class="
                    d.tone === 'round'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : d.tone === 'kills'
                        ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                        : 'border-border/60 bg-muted/30 text-muted-foreground'
                  "
                >
                  {{ d.label }}
                </span>
              </template>
              <span
                class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em]"
                :class="STATUS_TONE[g.activeJob.status]?.pill"
              >
                {{ statusLabel(g.activeJob.status) }}
                <span class="opacity-60">·</span>
                {{
                  formatTimeAgo(
                    g.activeJob.last_status_at ?? g.activeJob.created_at,
                  )
                }}
              </span>
            </div>

            <div class="space-y-2">
              <div class="space-y-1">
                <div
                  class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  <span class="inline-flex items-center gap-1.5">
                    <Film class="h-3 w-3" />
                    {{ $t("clips.render_queue.render") }}
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
                <div
                  class="relative h-1.5 overflow-hidden rounded-full bg-muted/40"
                >
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
                <div
                  class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  <span class="inline-flex items-center gap-1.5">
                    <Upload class="h-3 w-3" />
                    {{ $t("clips.render_queue.upload") }}
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

          <div
            v-if="!compact"
            class="border-t border-border/40 bg-muted/10 divide-y divide-border/30"
          >
            <div
              v-for="j in visibleInFlightJobs(g)"
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
                  (j.status === 'rendering' || j.status === 'uploading') &&
                    'animate-spin',
                ]"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm">{{ clipTitle(j) }}</span>
                  <template v-for="d in clipDetails(j)" :key="d.label">
                    <span
                      class="shrink-0 inline-flex items-center rounded border px-1 py-px font-mono text-[0.55rem] uppercase tracking-[0.1em] tabular-nums leading-none"
                      :class="
                        d.tone === 'round'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : d.tone === 'kills'
                            ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                            : 'border-border/60 bg-muted/30 text-muted-foreground'
                      "
                    >
                      {{ d.label }}
                    </span>
                  </template>
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
              <Tooltip v-if="isAdmin && TERMINAL.has(j.status)">
                <TooltipTrigger as-child>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                    :disabled="requeueingJob[j.id]"
                    @click="requeueJob(j.id)"
                  >
                    <Loader2
                      v-if="requeueingJob[j.id]"
                      class="h-3 w-3 animate-spin"
                    />
                    <RotateCcw v-else class="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Re-queue clip</TooltipContent>
              </Tooltip>
              <Button
                v-if="j.status === 'done' && j.clip_id"
                type="button"
                variant="ghost"
                size="sm"
                class="h-6 shrink-0 gap-1 px-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                @click="openJobClip(g, j)"
              >
                <Play class="h-3 w-3" />
                Preview
              </Button>
            </div>
            <button
              v-if="g.totalCount > ACTIVE_BATCH_CLIP_THRESHOLD"
              type="button"
              class="flex w-full items-center justify-center gap-1.5 px-3 py-2 sm:px-4 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
              @click="toggleInFlightExpanded(g.matchMapId)"
            >
              <template v-if="isInFlightExpanded(g)">Hide clips</template>
              <template v-else> Show all {{ g.totalCount }} clips </template>
            </button>
          </div>

          <div
            v-else
            class="border-t border-border/40 px-3 py-2 sm:px-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
          >
            <span v-if="g.activeJob">
              {{ statusLabel(g.activeJob.status) }} ·
              {{ clipTitle(g.activeJob) }}
            </span>
            <span v-else> {{ g.jobs.length }} queued </span>
          </div>
        </Card>
      </div>

      <div v-if="!compact && recentlyDoneGroups.length" class="space-y-2">
        <div class="flex items-center gap-2">
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/80"
          >
            {{ $t("clips.render_queue.recently_finished") }}
          </span>
          <span class="text-border">·</span>
          <span
            class="font-mono text-[0.6rem] tabular-nums text-muted-foreground/70"
          >
            {{ finishedJobs.length }} clip{{
              finishedJobs.length === 1 ? "" : "s"
            }}
          </span>
          <Button
            v-if="isAdmin"
            size="sm"
            variant="outline"
            class="ml-auto h-6 px-2 text-[0.6rem] uppercase tracking-[0.14em] hover:border-destructive hover:text-destructive"
            :disabled="clearingAllFinished"
            @click="clearAllFinished"
          >
            <Loader2
              v-if="clearingAllFinished"
              class="h-3 w-3 mr-1 animate-spin"
            />
            <X v-else class="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
        <div class="space-y-1">
          <div
            v-for="g in recentlyDoneGroups"
            :key="g.matchMapId"
            class="rounded-md border border-border/40 bg-card/30 [backdrop-filter:blur(6px)]"
          >
            <div class="flex w-full items-center">
              <button
                type="button"
                class="flex flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs min-w-0"
                @click="toggleFinishedExpanded(g.matchMapId)"
              >
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                  :class="
                    g.errorCount > 0
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : g.cancelledCount > 0
                        ? 'border-border/60 bg-muted/30 text-muted-foreground'
                        : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                  "
                >
                  <Film class="h-3.5 w-3.5" />
                </span>
                <ChevronRight
                  class="h-3 w-3 shrink-0 text-muted-foreground transition-transform"
                  :class="{
                    'rotate-90': finishedExpanded[g.matchMapId],
                  }"
                />
                <div class="min-w-0 flex-1">
                  <div class="truncate font-semibold">
                    <span v-if="matchupLabel(g.sample)">
                      {{ matchupLabel(g.sample) }}
                    </span>
                    <span v-else>
                      {{
                        g.sample.match_map?.map?.label ??
                        g.sample.match_map?.map?.name ??
                        "Unknown match"
                      }}
                    </span>
                  </div>
                  <div
                    class="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70"
                  >
                    <span
                      v-if="
                        g.sample.match_map?.map?.label ||
                        g.sample.match_map?.map?.name
                      "
                    >
                      {{
                        g.sample.match_map.map.label ??
                        g.sample.match_map.map.name
                      }}
                      ·
                    </span>
                    <span class="tabular-nums"
                      >{{ g.totalCount }} clip{{
                        g.totalCount === 1 ? "" : "s"
                      }}</span
                    >
                    <span v-if="g.doneCount > 0" class="text-emerald-400/80">
                      · {{ g.doneCount }} done
                    </span>
                    <span v-if="g.errorCount > 0" class="text-destructive/80">
                      · {{ g.errorCount }} err
                    </span>
                    <span
                      v-if="g.cancelledCount > 0"
                      class="text-muted-foreground/70"
                    >
                      · {{ g.cancelledCount }} cancelled
                    </span>
                  </div>
                </div>
                <span
                  class="shrink-0 font-mono text-[0.58rem] tabular-nums text-muted-foreground/70"
                >
                  {{ formatTimeAgo(g.startedAt) }}
                </span>
              </button>
              <Tooltip v-if="g.sample.match_map?.match?.id">
                <TooltipTrigger as-child>
                  <NuxtLink
                    :to="`/matches/${g.sample.match_map.match.id}`"
                    class="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    @click.stop
                  >
                    <ExternalLink class="h-3 w-3" />
                  </NuxtLink>
                </TooltipTrigger>
                <TooltipContent>Open match</TooltipContent>
              </Tooltip>
              <Tooltip
                v-if="isAdmin && (g.errorCount > 0 || g.cancelledCount > 0)"
              >
                <TooltipTrigger as-child>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="mr-1 h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                    :disabled="retryingBatch[`${g.matchMapId}:failed`]"
                    @click.stop="retryBatch(g.matchMapId, true)"
                  >
                    <Loader2
                      v-if="retryingBatch[`${g.matchMapId}:failed`]"
                      class="h-3 w-3 animate-spin"
                    />
                    <RotateCcw v-else class="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Retry failed ({{ g.errorCount + g.cancelledCount }})
                </TooltipContent>
              </Tooltip>
              <Tooltip v-if="isAdmin">
                <TooltipTrigger as-child>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="mr-1 h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                    :disabled="retryingBatch[`${g.matchMapId}:all`]"
                    @click.stop="retryBatch(g.matchMapId, false)"
                  >
                    <Loader2
                      v-if="retryingBatch[`${g.matchMapId}:all`]"
                      class="h-3 w-3 animate-spin"
                    />
                    <RotateCw v-else class="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Retry all {{ g.totalCount }} clips
                </TooltipContent>
              </Tooltip>
              <Tooltip v-if="isAdmin">
                <TooltipTrigger as-child>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="mr-1 h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    :disabled="clearingBatch[g.matchMapId]"
                    @click.stop="clearBatch(g.matchMapId)"
                  >
                    <Loader2
                      v-if="clearingBatch[g.matchMapId]"
                      class="h-3 w-3 animate-spin"
                    />
                    <X v-else class="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear batch</TooltipContent>
              </Tooltip>
            </div>
            <div
              v-if="finishedExpanded[g.matchMapId]"
              class="border-t border-border/30 bg-muted/10 divide-y divide-border/30"
            >
              <div
                v-for="j in visibleFinishedJobs(g)"
                :key="j.id"
                class="flex items-center gap-2.5 py-1 pl-9 pr-2.5"
              >
                <span
                  class="inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
                  :class="STATUS_TONE[j.status]?.dot"
                />
                <div class="min-w-0 flex-1">
                  <div
                    class="flex items-center gap-1.5 text-[0.72rem] text-muted-foreground"
                    :title="j.error_message ?? clipTitle(j)"
                  >
                    <span class="truncate">{{ clipTitle(j) }}</span>
                    <template v-for="d in clipDetails(j)" :key="d.label">
                      <span
                        class="shrink-0 inline-flex items-center rounded border px-1 py-px font-mono text-[0.52rem] uppercase tracking-[0.1em] tabular-nums leading-none"
                        :class="
                          d.tone === 'round'
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : d.tone === 'kills'
                              ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                              : 'border-border/60 bg-muted/30 text-muted-foreground/80'
                        "
                      >
                        {{ d.label }}
                      </span>
                    </template>
                  </div>
                  <div
                    v-if="j.error_message"
                    class="truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-destructive/80"
                  >
                    {{ j.error_message }}
                  </div>
                </div>
                <Button
                  v-if="isAdmin"
                  size="sm"
                  variant="ghost"
                  class="h-6 px-2 text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                  :disabled="requeueingJob[j.id]"
                  @click="requeueJob(j.id)"
                >
                  <Loader2
                    v-if="requeueingJob[j.id]"
                    class="h-3 w-3 mr-1 animate-spin"
                  />
                  <RotateCcw v-else class="h-3 w-3 mr-1" />
                  Re-queue
                </Button>
                <Button
                  v-if="j.status === 'done' && j.clip_id"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-6 shrink-0 gap-1 px-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                  @click="openJobClip(g, j)"
                >
                  <Play class="h-3 w-3" />
                  Preview
                </Button>
              </div>
              <button
                v-if="g.totalCount > FINISHED_BATCH_CLIP_THRESHOLD"
                type="button"
                class="flex w-full items-center justify-center gap-1.5 px-2.5 py-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                @click="toggleFinishedJobsExpanded(g.matchMapId)"
              >
                <template v-if="isFinishedJobsExpanded(g)">Show less</template>
                <template v-else>
                  Show {{ g.totalCount - FINISHED_BATCH_CLIP_THRESHOLD }} more
                </template>
              </button>
            </div>
          </div>
        </div>
        <button
          v-if="canLoadMoreFinished"
          type="button"
          class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border/40 bg-card/30 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          :disabled="finishedLoading"
          @click="loadMoreFinished"
        >
          <Loader2 v-if="finishedLoading" class="h-3 w-3 animate-spin" />
          Load more
        </button>
      </div>
    </TooltipProvider>
  </div>
</template>

<style scoped>
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
