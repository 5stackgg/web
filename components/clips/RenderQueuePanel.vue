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
  CircleDot,
  Server,
  ExternalLink,
  RotateCcw,
  RotateCw,
  ChevronRight,
  Play,
  Pause,
  ScrollText,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import gql from "graphql-tag";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { clipRenderJobFields } from "~/graphql/clipRenderJob";
import { Button } from "~/components/ui/button";
import RenderQueueBatchRow from "~/components/clips/RenderQueueBatchRow.vue";
import BootSequence from "~/components/match/BootSequence.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import SnapshotQuickView from "~/components/match/SnapshotQuickView.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useAuthStore } from "~/stores/AuthStore";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";
import { useClipModal, type ClipQueueItem } from "~/composables/useClipModal";
import { Spinner } from "~/components/ui/spinner";

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
  paused?: boolean | null;
  progress: number | string | null;
  error_message: string | null;
  k8s_job_name?: string | null;
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
// Active batches render as the same collapsible row as finished ones,
// but default to expanded so the live clip ladder is visible.
const activeCollapsed = ref<Record<string, boolean>>({});

// Per-job inline logs pane (admin), reusing the match-page ServiceLogs viewer.
const logsExpanded = ref<Record<string, boolean>>({});
function jobLogService(j: Job): string | null {
  const name = j.k8s_job_name;
  if (!name || name === "pending" || name === "dev-attach") {
    return null;
  }
  return name;
}
function toggleJobLogs(j: Job) {
  if (!jobLogService(j)) {
    return;
  }
  logsExpanded.value = {
    ...logsExpanded.value,
    [j.id]: !logsExpanded.value[j.id],
  };
}

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

function isActiveExpanded(matchMapId: string): boolean {
  return !activeCollapsed.value[matchMapId];
}

function toggleActiveExpanded(matchMapId: string) {
  activeCollapsed.value = {
    ...activeCollapsed.value,
    [matchMapId]: !activeCollapsed.value[matchMapId],
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
          order_by: [{ last_status_at: "desc" }],
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
  // Latest terminal transition across the batch — when it actually
  // finished, distinct from startedAt (oldest created_at).
  finishedAt: string;
  totalCount: number;
  doneCount: number;
  errorCount: number;
  cancelledCount: number;
  terminalCount: number;
  inFlightCount: number;
  // 0..1 across the batch — sum of per-job render fractions / total.
  overallProgress: number;
  isFinished: boolean;
  bootInfo: {
    stage: string;
    stageSub: string | null;
    progress: number | null;
    at: string;
    firedStages: Set<string>;
    stageFirstAt: Map<string, number>;
  } | null;
  isPaused: boolean;
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
  const finishedAt = sorted.reduce<string>((acc, j) => {
    const at = j.last_status_at ?? j.created_at;
    return at > acc ? at : acc;
  }, sorted[0].last_status_at ?? sorted[0].created_at);
  let doneCount = 0;
  let errorCount = 0;
  let cancelledCount = 0;
  let progressSum = 0;
  for (const j of sorted) {
    if (j.status === "done") {
      // No clip_id means the output is gone — treat it as a failure
      // so the batch reflects it and offers a re-queue.
      if (j.clip_id) {
        doneCount++;
        progressSum += 1;
      } else {
        errorCount++;
      }
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

  const isPaused = sorted.some((j) => j.paused === true);

  let bootInfo: BatchGroup["bootInfo"] = null;
  const noneStarted = sorted.every((j) => j.status === "queued");
  if (noneStarted && !isPaused) {
    const firedStages = new Set<string>();
    const stageFirstAt = new Map<string, number>();
    let latest: { entry: StatusHistoryEntry; at: number } | null = null;
    for (const j of sorted) {
      const history = j.status_history;
      if (!Array.isArray(history)) continue;
      for (const e of history) {
        if (e?.status !== "booting") continue;
        // `at` is the stage's first-seen time — the API keeps it stable
        // across within-stage progress ticks, so it's the stage start and
        // elapsed doesn't reset. boot_stage is "downloading_cs2:Validating".
        const t = Date.parse(e.at);
        if (typeof e.boot_stage === "string" && e.boot_stage) {
          const key = e.boot_stage.split(":")[0];
          firedStages.add(key);
          // Earliest emit across the batch's jobs — the pod boots once,
          // but each queued job carries its own booting history.
          if (Number.isFinite(t)) {
            const prev = stageFirstAt.get(key);
            if (prev === undefined || t < prev) stageFirstAt.set(key, t);
          }
        }
        if (!Number.isFinite(t)) continue;
        if (!latest || t > latest.at) latest = { entry: e, at: t };
      }
    }
    // Staleness uses the row's last_status_at (bumped every tick), not the
    // history `at` (now frozen at stage start) — else a long shader compile
    // would look dead and the boot UI would vanish mid-stage.
    const freshestActivity = sorted.reduce((acc, j) => {
      const ts = Date.parse(j.last_status_at ?? j.created_at);
      return Number.isFinite(ts) && ts > acc ? ts : acc;
    }, 0);
    if (latest && Date.now() - freshestActivity < BOOT_RECENCY_MS) {
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
        stageFirstAt,
      };
    }
  }

  return {
    matchMapId,
    jobs: sorted,
    activeJob,
    sample: sorted[0],
    startedAt: oldest,
    finishedAt,
    totalCount: sorted.length,
    doneCount,
    errorCount,
    cancelledCount,
    terminalCount,
    inFlightCount,
    overallProgress,
    isFinished: inFlightCount === 0,
    bootInfo,
    isPaused,
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
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1)),
);

const recentlyDoneGroups = computed(() =>
  allGroups.value
    .filter((g) => g.isFinished)
    .sort((a, b) => (a.finishedAt > b.finishedAt ? -1 : 1)),
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

// A job the server marked "done" but with no clip_id has no playable
// output — the upload was lost. Surface it as a failure so it can be
// re-queued like an error row instead of masquerading as a finished clip.
function isMissingClip(j: Job): boolean {
  return j.status === "done" && !j.clip_id;
}

function effectiveStatus(j: Job): string {
  return isMissingClip(j) ? "missing" : j.status;
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
    case "missing":
      return t("render_queue_status.missing");
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
  missing: {
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
  // Collapsed: show only the active job (if any) — it carries its own
  // render/upload bars inline, and the header summary conveys the rest.
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

const resumingBatch = ref<Record<string, boolean>>({});
const RESUME_CLIP_RENDER_BATCH = gql`
  mutation ResumeClipRenderBatch($match_map_id: uuid!) {
    resumeClipRenderBatch(match_map_id: $match_map_id) {
      success
    }
  }
`;
async function resumeBatch(matchMapId: string) {
  if (resumingBatch.value[matchMapId]) return;
  resumingBatch.value = { ...resumingBatch.value, [matchMapId]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: RESUME_CLIP_RENDER_BATCH,
      variables: { match_map_id: matchMapId },
    });
  } catch (e) {
    console.error("[render-queue] batch resume failed:", e);
  } finally {
    resumingBatch.value = { ...resumingBatch.value, [matchMapId]: false };
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
const totalRendering = computed(
  () =>
    inFlight.value.filter(
      (j) => j.status === "rendering" || j.status === "uploading",
    ).length,
);
const totalPaused = computed(
  () => inFlight.value.filter((j) => j.paused === true).length,
);
const allPaused = computed(
  () =>
    inFlight.value.length > 0 && totalPaused.value === inFlight.value.length,
);

const gpuPool = useGpuPoolStatusStore();
gpuPool.subscribeToPool();

const resumeBlockedReason = computed<string | null>(() => {
  const s = gpuPool.status;
  if (!gpuPool.hasLoaded || !s) return null;
  if (s.live_in_progress) {
    return t("clips.render_queue.resume_blocked_live");
  }
  return null;
});

const queueStatus = computed<{
  key: string;
  tone: "amber" | "muted" | "danger";
}>(() => {
  if (totalRendering.value > 0) {
    return { key: "rendering", tone: "amber" };
  }
  if (allPaused.value) {
    return { key: "paused", tone: "amber" };
  }
  const s = gpuPool.status;
  if (gpuPool.hasLoaded && s) {
    if (s.total_gpu_nodes === 0) {
      return { key: "no_gpu_registered", tone: "danger" };
    }
    // Only flag a problem when NO GPU can take a batch render. If any node is
    // batch-claimable (free_gpu_nodes_for_batch > 0), a render can run even
    // when a match is live on a different node — fall through to idle/waiting.
    if (s.free_gpu_nodes_for_batch === 0) {
      // A GPU may be idle yet unclaimable because a live match is running on it
      // and pause_renders_during_active_match is on.
      if (s.renders_paused_for_active_match) {
        return { key: "paused_active_match", tone: "amber" };
      }
      if (s.live_in_progress) return { key: "blocked_live", tone: "amber" };
      if (s.demo_in_progress) return { key: "blocked_demo", tone: "amber" };
      return { key: "no_gpu_free", tone: "amber" };
    }
  }
  if (inFlight.value.length === 0) return { key: "idle", tone: "muted" };
  return { key: "waiting", tone: "muted" };
});
</script>

<template>
  <div
    v-if="
      !loading &&
      (groups.length > 0 || (!compact && recentlyDoneGroups.length > 0))
    "
    class="space-y-5"
  >
    <TooltipProvider :disable-hoverable-content="true">
      <div
        v-if="!compact && !hideSummary && groups.length > 0"
        class="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2 [backdrop-filter:blur(6px)]"
      >
        <div class="flex items-center gap-2">
          <ListVideo class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          <span class="font-mono text-sm font-semibold tabular-nums">
            {{ totalInFlight }}
          </span>
          <span
            class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("clips.render_queue.queued") }}
          </span>
        </div>
        <div
          class="ml-auto flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.16em]"
          :class="
            queueStatus.tone === 'danger'
              ? 'text-destructive'
              : queueStatus.tone === 'amber'
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground'
          "
        >
          <Spinner v-if="queueStatus.key === 'rendering'" class="h-3 w-3" />
          <Pause
            v-else-if="
              queueStatus.key === 'paused' ||
              queueStatus.key === 'paused_active_match'
            "
            class="h-3 w-3"
          />
          <AlertCircle
            v-else-if="queueStatus.tone === 'danger'"
            class="h-3 w-3"
          />
          <Clock v-else class="h-3 w-3" />
          <span>
            <template v-if="queueStatus.key === 'rendering'">
              {{
                $t("clips.render_queue.status_rendering", {
                  count: totalRendering,
                })
              }}
            </template>
            <template v-else>
              {{ $t(`clips.render_queue.status_${queueStatus.key}`) }}
            </template>
          </span>
        </div>
      </div>

      <TransitionGroup
        v-if="groups.length"
        tag="div"
        name="batch"
        class="relative space-y-2"
      >
        <RenderQueueBatchRow
          v-for="g in groups"
          :key="g.matchMapId"
          :expanded="isActiveExpanded(g.matchMapId)"
          :title="
            matchupLabel(g.sample) ??
            g.sample.match_map?.map?.label ??
            g.sample.match_map?.map?.name ??
            'Unknown match'
          "
          avatar-class="border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]"
          :time="formatTimeAgo(g.startedAt)"
          :container-class="
            g.isPaused
              ? 'border-[hsl(var(--tac-amber)/0.3)]'
              : 'border-[hsl(var(--tac-amber)/0.4)]'
          "
          @toggle="toggleActiveExpanded(g.matchMapId)"
        >
          <template #avatar-icon>
            <Spinner v-if="g.activeJob" class="h-3.5 w-3.5" />
            <Film v-else class="h-3.5 w-3.5" />
          </template>

          <template #meta>
            <span
              v-if="
                g.sample.match_map?.map?.label || g.sample.match_map?.map?.name
              "
            >
              {{ g.sample.match_map.map.label ?? g.sample.match_map.map.name }}
              ·
            </span>
            <span class="tabular-nums">
              {{ g.terminalCount }}/{{ g.totalCount }} done
            </span>
            <span v-if="g.errorCount > 0" class="text-destructive/80">
              · {{ g.errorCount }} err
            </span>
          </template>

          <template #actions>
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
            <Tooltip v-if="g.isPaused && resumeBlockedReason">
              <TooltipTrigger as-child>
                <span tabindex="0" class="mr-1 inline-flex">
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-6 w-6 shrink-0 p-0 opacity-50 cursor-not-allowed"
                    :disabled="true"
                  >
                    <Play class="h-3 w-3" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                {{ resumeBlockedReason }}
              </TooltipContent>
            </Tooltip>
            <Tooltip v-else-if="g.isPaused">
              <TooltipTrigger as-child>
                <Button
                  size="sm"
                  variant="ghost"
                  class="mr-1 h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                  :disabled="resumingBatch[g.matchMapId]"
                  @click.stop="resumeBatch(g.matchMapId)"
                >
                  <Spinner v-if="resumingBatch[g.matchMapId]" class="h-3 w-3" />
                  <Play v-else class="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ $t("ui_extras.resume") }}</TooltipContent>
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
                  <Spinner
                    v-if="retryingBatch[`${g.matchMapId}:failed`]"
                    class="h-3 w-3"
                  />
                  <RotateCcw v-else class="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry failed</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="sm"
                  variant="ghost"
                  class="mr-1 h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  :disabled="cancellingBatch[g.matchMapId]"
                  @click.stop="cancelBatch(g.matchMapId)"
                >
                  <Spinner
                    v-if="cancellingBatch[g.matchMapId]"
                    class="h-3 w-3"
                  />
                  <X v-else class="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ $t("common.cancel") }}</TooltipContent>
            </Tooltip>
          </template>

          <template #progress>
            <div class="px-2.5 pb-2">
              <div
                class="mb-1 flex items-center justify-between font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
              >
                <span :class="g.isPaused ? 'text-[hsl(var(--tac-amber))]' : ''">
                  <template v-if="g.isPaused">
                    <Pause class="inline h-3 w-3 mr-1 -mt-0.5" />
                    {{ $t("ui_extras.batch_paused") }}
                  </template>
                  <template v-else-if="g.bootInfo">
                    {{ $t("ui_extras.pod_boot") }}
                  </template>
                  <template v-else>
                    {{ $t("ui_extras.batch_progress") }}
                  </template>
                </span>
                <span class="tabular-nums">
                  <template
                    v-if="
                      !g.isPaused && g.bootInfo && g.bootInfo.progress !== null
                    "
                  >
                    {{ Math.round(g.bootInfo.progress * 100) }}%
                  </template>
                  <template v-else-if="!g.isPaused && g.bootInfo">…</template>
                  <template v-else>
                    {{ Math.round(g.overallProgress * 100) }}%
                  </template>
                </span>
              </div>
              <div
                class="relative h-1.5 overflow-hidden rounded-full bg-muted/40"
              >
                <div
                  v-if="!g.isPaused && g.bootInfo"
                  class="h-full rounded-full bg-primary transition-[width] duration-300"
                  :style="{
                    width: Math.round((g.bootInfo.progress ?? 0) * 100) + '%',
                  }"
                ></div>
                <div
                  v-else
                  class="h-full rounded-full transition-[width] duration-300"
                  :class="
                    g.isPaused
                      ? 'bg-[hsl(var(--tac-amber)/0.5)]'
                      : 'bg-[hsl(var(--tac-amber))]'
                  "
                  :style="{ width: Math.round(g.overallProgress * 100) + '%' }"
                ></div>
              </div>
            </div>
          </template>

          <template #body>
            <div
              v-if="!compact && g.bootInfo"
              class="border-t border-border/40 px-3 py-3 sm:px-4 bg-primary/[0.03]"
            >
              <div class="mb-2 flex items-center gap-2">
                <span
                  class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10"
                >
                  <Server class="h-3 w-3 text-primary" />
                </span>
                <span class="text-sm font-medium">Render pod booting</span>
              </div>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
                <BootSequence
                  mode="highlights"
                  :histories="g.jobs.map((j) => j.status_history)"
                  :card="false"
                  class="flex-1"
                />
                <div
                  v-if="g.sample"
                  class="w-full shrink-0 overflow-hidden rounded-md border border-border/50 sm:w-64 lg:w-80"
                >
                  <SnapshotQuickView kind="clips" :id="g.sample.id" />
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
                class="px-3 py-2 sm:px-4"
                :class="{
                  'bg-[hsl(var(--tac-amber)/0.04)]': j === g.activeJob,
                }"
              >
                <div class="flex items-center gap-3">
                  <component
                    :is="
                      j.status === 'rendering' || j.status === 'uploading'
                        ? Loader2
                        : j.status === 'queued'
                          ? Clock
                          : effectiveStatus(j) === 'done'
                            ? CheckCircle2
                            : j.status === 'cancelled'
                              ? CircleSlash
                              : effectiveStatus(j) === 'error' ||
                                  effectiveStatus(j) === 'missing'
                                ? AlertCircle
                                : CircleDot
                    "
                    class="h-3.5 w-3.5 shrink-0"
                    :class="[
                      STATUS_TONE[effectiveStatus(j)]?.iconColor,
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
                  </div>
                  <span
                    class="shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.14em]"
                    :class="STATUS_TONE[effectiveStatus(j)]?.pill"
                  >
                    <template v-if="j === g.activeJob">
                      {{ statusLabel(effectiveStatus(j)) }}
                      <span class="opacity-60">·</span>
                      {{ formatTimeAgo(j.last_status_at ?? j.created_at) }}
                    </template>
                    <template v-else>
                      {{ statusLabel(effectiveStatus(j)) }}
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
                        <Spinner v-if="requeueingJob[j.id]" class="h-3 w-3" />
                        <RotateCcw v-else class="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Re-queue clip</TooltipContent>
                  </Tooltip>
                  <Tooltip v-if="j.status === 'done' && j.clip_id">
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                        @click="openJobClip(g, j)"
                      >
                        <Play class="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Preview clip</TooltipContent>
                  </Tooltip>
                  <Tooltip v-if="isAdmin && jobLogService(j)">
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="h-6 w-6 shrink-0 p-0"
                        :class="
                          logsExpanded[j.id]
                            ? 'text-[hsl(var(--tac-amber))]'
                            : 'text-muted-foreground hover:text-[hsl(var(--tac-amber))]'
                        "
                        @click="toggleJobLogs(j)"
                      >
                        <ScrollText class="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View render job logs</TooltipContent>
                  </Tooltip>
                </div>

                <div
                  v-if="isAdmin && logsExpanded[j.id] && jobLogService(j)"
                  class="mt-2 ml-[1.625rem] flex h-72 flex-col overflow-hidden rounded border border-border/60 bg-background/40"
                >
                  <ServiceLogs
                    class="min-h-0 flex-1"
                    :service="jobLogService(j)!"
                    :compact="true"
                    :disable-retry="TERMINAL.has(j.status)"
                  />
                </div>

                <!-- Active clip: render + upload as two parallel phase bars. -->
                <div
                  v-if="j === g.activeJob"
                  class="mt-2 grid grid-cols-2 gap-3 pl-[1.625rem]"
                >
                  <div class="space-y-1">
                    <div
                      class="flex items-center justify-between font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      <span class="inline-flex items-center gap-1.5">
                        <Film class="h-3 w-3" />
                        {{ $t("clips.render_queue.render") }}
                      </span>
                      <span class="tabular-nums">
                        {{
                          j.status === "rendering"
                            ? progressPct(j) + "%"
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
                            j.status === 'rendering'
                              ? progressPct(j) + '%'
                              : '100%',
                        }"
                      ></div>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div
                      class="flex items-center justify-between font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      <span class="inline-flex items-center gap-1.5">
                        <Upload class="h-3 w-3" />
                        {{ $t("clips.render_queue.upload") }}
                      </span>
                      <span class="tabular-nums">
                        {{ j.status === "uploading" ? "…" : "—" }}
                      </span>
                    </div>
                    <div
                      v-if="j.status === 'uploading'"
                      class="relative h-1.5 overflow-hidden rounded-full bg-primary/20"
                    >
                      <div
                        class="absolute inset-0 w-[30%] rounded-full animate-upload-pulse bg-[linear-gradient(90deg,transparent,hsl(var(--primary))_50%,transparent)]"
                      />
                    </div>
                    <div v-else class="h-1.5 rounded-full bg-muted/40"></div>
                  </div>
                </div>
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
              v-if="compact"
              class="border-t border-border/40 px-3 py-2 sm:px-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              <span v-if="g.activeJob">
                {{ statusLabel(g.activeJob.status) }} ·
                {{ clipTitle(g.activeJob) }}
              </span>
              <span v-else> {{ g.jobs.length }} queued </span>
            </div>
          </template>
        </RenderQueueBatchRow>
      </TransitionGroup>

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
            <Spinner v-if="clearingAllFinished" class="h-3 w-3 mr-1" />
            <X v-else class="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
        <TransitionGroup tag="div" name="batch" class="relative space-y-1">
          <RenderQueueBatchRow
            v-for="g in recentlyDoneGroups"
            :key="g.matchMapId"
            :expanded="!!finishedExpanded[g.matchMapId]"
            :title="
              matchupLabel(g.sample) ??
              g.sample.match_map?.map?.label ??
              g.sample.match_map?.map?.name ??
              'Unknown match'
            "
            :avatar-class="
              g.errorCount > 0
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : g.cancelledCount > 0
                  ? 'border-border/60 bg-muted/30 text-muted-foreground'
                  : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
            "
            :time="formatTimeAgo(g.finishedAt)"
            @toggle="toggleFinishedExpanded(g.matchMapId)"
          >
            <template #meta>
              <span
                v-if="
                  g.sample.match_map?.map?.label ||
                  g.sample.match_map?.map?.name
                "
              >
                {{
                  g.sample.match_map.map.label ?? g.sample.match_map.map.name
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
            </template>

            <template #actions>
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
                    <Spinner
                      v-if="retryingBatch[`${g.matchMapId}:failed`]"
                      class="h-3 w-3"
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
                    <Spinner
                      v-if="retryingBatch[`${g.matchMapId}:all`]"
                      class="h-3 w-3"
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
                    <Spinner
                      v-if="clearingBatch[g.matchMapId]"
                      class="h-3 w-3"
                    />
                    <X v-else class="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear batch</TooltipContent>
              </Tooltip>
            </template>

            <template #body>
              <div
                class="border-t border-border/30 bg-muted/10 divide-y divide-border/30"
              >
                <div v-for="j in visibleFinishedJobs(g)" :key="j.id">
                  <div class="flex items-center gap-2.5 py-1 pl-9 pr-2.5">
                    <span
                      class="inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
                      :class="STATUS_TONE[effectiveStatus(j)]?.dot"
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
                      <div
                        v-else-if="isMissingClip(j)"
                        class="truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-destructive/80"
                      >
                        {{ statusLabel("missing") }}
                      </div>
                    </div>
                    <Tooltip v-if="isAdmin">
                      <TooltipTrigger as-child>
                        <Button
                          size="sm"
                          variant="ghost"
                          class="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                          :disabled="requeueingJob[j.id]"
                          @click="requeueJob(j.id)"
                        >
                          <Spinner v-if="requeueingJob[j.id]" class="h-3 w-3" />
                          <RotateCcw v-else class="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Re-queue clip</TooltipContent>
                    </Tooltip>
                    <Tooltip v-if="j.status === 'done' && j.clip_id">
                      <TooltipTrigger as-child>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                          @click="openJobClip(g, j)"
                        >
                          <Play class="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Preview clip</TooltipContent>
                    </Tooltip>
                    <Tooltip v-if="isAdmin && jobLogService(j)">
                      <TooltipTrigger as-child>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 shrink-0 p-0"
                          :class="
                            logsExpanded[j.id]
                              ? 'text-[hsl(var(--tac-amber))]'
                              : 'text-muted-foreground hover:text-[hsl(var(--tac-amber))]'
                          "
                          @click="toggleJobLogs(j)"
                        >
                          <ScrollText class="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View render job logs</TooltipContent>
                    </Tooltip>
                  </div>
                  <div
                    v-if="isAdmin && logsExpanded[j.id] && jobLogService(j)"
                    class="mb-1 ml-9 mr-2.5 flex h-72 flex-col overflow-hidden rounded border border-border/60 bg-background/40"
                  >
                    <ServiceLogs
                      class="min-h-0 flex-1"
                      :service="jobLogService(j)!"
                      :compact="true"
                      :disable-retry="TERMINAL.has(j.status)"
                    />
                  </div>
                </div>
                <button
                  v-if="g.totalCount > FINISHED_BATCH_CLIP_THRESHOLD"
                  type="button"
                  class="flex w-full items-center justify-center gap-1.5 px-2.5 py-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                  @click="toggleFinishedJobsExpanded(g.matchMapId)"
                >
                  <template v-if="isFinishedJobsExpanded(g)"
                    >Show less</template
                  >
                  <template v-else>
                    Show {{ g.totalCount - FINISHED_BATCH_CLIP_THRESHOLD }} more
                  </template>
                </button>
              </div>
            </template>
          </RenderQueueBatchRow>
        </TransitionGroup>
        <button
          v-if="canLoadMoreFinished"
          type="button"
          class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border/40 bg-card/30 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          :disabled="finishedLoading"
          @click="loadMoreFinished"
        >
          <Spinner v-if="finishedLoading" class="h-3 w-3" />
          Load more
        </button>
      </div>
    </TooltipProvider>
  </div>
  <div
    v-else-if="!loading && !compact"
    class="rounded-lg border border-border/50 bg-card/40 px-6 py-12 text-center [backdrop-filter:blur(6px)]"
  >
    <ListVideo
      class="mx-auto h-8 w-8 text-muted-foreground/60"
      aria-hidden="true"
    />
    <div
      class="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
    >
      Render queue is empty
    </div>
    <p class="mt-2 max-w-md mx-auto text-xs text-muted-foreground/80">
      Highlight render jobs queued from matches will show up here while they
      boot, render, and upload.
    </p>
  </div>
</template>
