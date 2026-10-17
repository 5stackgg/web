<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { useNuxtApp } from "#app";
import {
  Clapperboard,
  Ellipsis,
  ExternalLink,
  Film,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  Trash2,
  TriangleAlert,
  X,
  CircleAlert,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-vue-next";
import gql from "graphql-tag";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { clipRenderJobFields } from "~/graphql/clipRenderJob";
import {
  RENDER_IN_FLIGHT_STATUSES,
  RENDER_TERMINAL_STATUSES,
  cancelUtilityLineupRenderMutation,
  clearFinishedUtilityLineupRendersMutation,
  deleteUtilityLineupRenderMutation,
  renderUtilityLineupPreviewMutation,
  utilityRendersFinishedSubscription,
  utilityRendersInFlightSubscription,
} from "~/graphql/utilityRenderGraphql";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterChip from "~/components/common/FilterChip.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import UtilityTypeGlyph from "~/components/utility/UtilityTypeGlyph.vue";
import UtilityRenderVersion from "~/components/utility/UtilityRenderVersion.vue";
import UtilityRenderWarn from "~/components/utility/UtilityRenderWarn.vue";
import UtilityPreviewDialog from "~/components/utility/UtilityPreviewDialog.vue";
import DeleteRenderDialog from "~/components/utility/DeleteRenderDialog.vue";
import RenderQueueCoverageStrip from "~/components/render-queue/RenderQueueCoverageStrip.vue";
import RenderQueueJobSheet from "~/components/render-queue/RenderQueueJobSheet.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import SlideSwap from "~/components/ui/transitions/SlideSwap.vue";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Skeleton } from "~/components/ui/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { toast } from "~/components/ui/toast";
import { useBootStages } from "~/composables/useBootStages";
import { useUtilityRenderCoverage } from "~/composables/useUtilityRenderCoverage";
import { useClipModal, type ClipQueueItem } from "~/composables/useClipModal";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";
import cleanMapName from "~/utilities/cleanMapName";
import mapLabel from "~/utilities/mapLabel";
import {
  liveUtilityRenderIds,
  utilityLineupsRendering,
  utilityRenderFilmedAt,
  utilityRenderQueueView,
  RENDER_STALE_AFTER_MS,
  type UtilityRenderQueueRow,
} from "~/utilities/utilityRenderQueue";
import {
  CLIP_TERMINAL,
  UTILITY_TERMINAL,
  batchesOf,
  buildLedgerRows,
  clipBatchSummary,
  clipMatchup,
  countInView,
  lineupsToRender,
  pageWindow,
  type ClipBatchSummary,
  type LedgerClipJob,
  type LedgerKind,
  type LedgerRow,
  type LedgerView,
} from "~/components/render-queue/renderQueueLedger";
import {
  clipDetails,
  clipDuration,
  clipTitle,
  since,
  statusIcon,
  statusToneClass,
} from "~/components/render-queue/renderQueueDisplay";
import type { UtilityLineupRender } from "~/types/utility";

type ClipJob = LedgerClipJob & {
  user_steam_id?: string;
  match_map_demo?: unknown;
};
type Row = LedgerRow<ClipJob, UtilityLineupRender>;

const VIEWS: LedgerView[] = ["flight", "failed", "done"];
const VIEW_QUERY: Record<LedgerView, string | undefined> = {
  flight: undefined,
  failed: "failed",
  done: "finished",
};
const PER_PAGE = 15;
const FINISHED_INITIAL_LIMIT = 300;
const FINISHED_PAGE_SIZE = 200;
const UTILITY_FINISHED_LIMIT = 200;

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const route = useRoute();
const router = useRouter();
const { showClip, setClipQueue } = useClipModal();

// In the address (as `tab`, which never remounts the page), so a refresh or
// a shared link lands on the same list.
const view = computed<LedgerView>({
  get: () =>
    route.query.tab === "failed"
      ? "failed"
      : route.query.tab === "finished"
        ? "done"
        : "flight",
  set: (value) => {
    void router.replace({
      query: { ...route.query, tab: VIEW_QUERY[value] },
    });
  },
});
const viewIndex = computed(() => VIEWS.indexOf(view.value));

const query = ref("");
const kindFilter = ref<LedgerKind[]>(["clip", "utility"]);
const mapFilter = ref<string[]>([]);
const grouped = ref(true);
const page = ref(1);

// One ticker for the page: elapsed is what tells a stuck queue from a slow
// one.
const now = ref(Date.now());
const ticker = import.meta.client
  ? window.setInterval(() => {
      now.value = Date.now();
    }, 1000)
  : null;

/* ---------------- data ---------------- */

const clipInFlight = shallowRef<ClipJob[]>([]);
const clipFinished = shallowRef<ClipJob[]>([]);
const utilityInFlight = shallowRef<UtilityLineupRender[]>([]);
const utilityFinished = shallowRef<UtilityLineupRender[]>([]);
const clipLoaded = ref(false);
const utilityLoaded = ref(false);
const finishedLimit = ref(FINISHED_INITIAL_LIMIT);

const {
  coverage,
  failed: coverageFailed,
  refresh: refreshCoverage,
  refreshSoon: refreshCoverageSoon,
} = useUtilityRenderCoverage();

onMounted(() => void refreshCoverage());

const gpuPool = useGpuPoolStatusStore();
gpuPool.subscribeToPool();

function sameIds(a: Array<{ id: string }>, b: Array<{ id: string }>) {
  return a.length === b.length && a.every((row, i) => row.id === b[i].id);
}

const seenFilmingAt = ref(0);
let utilityFinishedHeard = false;

let clipInFlightSub: { unsubscribe: () => void } | null = null;
let clipFinishedSub: { unsubscribe: () => void } | null = null;
let utilityInFlightSub: { unsubscribe: () => void } | null = null;
let utilityFinishedSub: { unsubscribe: () => void } | null = null;

// Split per queue the way the panels always were: in flight is state and
// takes no limit, finished is history and does.
clipInFlightSub = getGraphqlClient()
  .subscribe({
    query: generateSubscription({
      clip_render_jobs: [
        {
          where: { status: { _in: ["queued", "rendering", "uploading"] } },
          order_by: [{ created_at: "desc" }],
        } as any,
        clipRenderJobFields,
      ],
    } as any),
  })
  .subscribe({
    next: ({ data }: any) => {
      clipInFlight.value = data?.clip_render_jobs ?? [];
      clipLoaded.value = true;
    },
    error: (error: any) => {
      console.error("[render-queue] clip in-flight subscription:", error);
      clipLoaded.value = true;
    },
  });

function subscribeClipFinished() {
  clipFinishedSub?.unsubscribe();
  clipFinishedSub = getGraphqlClient()
    .subscribe({
      query: generateSubscription({
        clip_render_jobs: [
          {
            where: { status: { _in: ["done", "error", "cancelled"] } },
            order_by: [{ last_status_at: "desc" }],
            limit: finishedLimit.value,
          } as any,
          clipRenderJobFields,
        ],
      } as any),
    })
    .subscribe({
      next: ({ data }: any) => {
        clipFinished.value = data?.clip_render_jobs ?? [];
      },
      error: (error: any) => {
        console.error("[render-queue] clip finished subscription:", error);
      },
    });
}
subscribeClipFinished();

utilityInFlightSub = getGraphqlClient()
  .subscribe({
    query: utilityRendersInFlightSubscription,
    variables: {
      statuses: [...RENDER_IN_FLIGHT_STATUSES],
      mapOrder: "asc",
      sortOrder: "asc",
      createdOrder: "asc",
    },
  })
  .subscribe({
    next: ({ data }: any) => {
      const rows: UtilityLineupRender[] = data?.utility_lineup_renders ?? [];
      if (utilityLoaded.value && !sameIds(utilityInFlight.value, rows)) {
        refreshCoverageSoon();
      }
      utilityInFlight.value = rows;
      seenFilmingAt.value = Math.max(
        seenFilmingAt.value,
        utilityRenderFilmedAt(rows),
      );
      utilityLoaded.value = true;
    },
    error: (error: any) => {
      console.error("[render-queue] utility in-flight subscription:", error);
      utilityLoaded.value = true;
    },
  });

utilityFinishedSub = getGraphqlClient()
  .subscribe({
    query: utilityRendersFinishedSubscription,
    variables: {
      statuses: [...RENDER_TERMINAL_STATUSES],
      order: "desc",
      limit: UTILITY_FINISHED_LIMIT,
    },
  })
  .subscribe({
    next: ({ data }: any) => {
      const rows: UtilityLineupRender[] = data?.utility_lineup_renders ?? [];
      if (utilityFinishedHeard && !sameIds(utilityFinished.value, rows)) {
        refreshCoverageSoon();
      }
      utilityFinished.value = rows;
      utilityFinishedHeard = true;
    },
    error: (error: any) => {
      console.error("[render-queue] utility finished subscription:", error);
    },
  });

onBeforeUnmount(() => {
  clipInFlightSub?.unsubscribe();
  clipFinishedSub?.unsubscribe();
  utilityInFlightSub?.unsubscribe();
  utilityFinishedSub?.unsubscribe();
  if (ticker !== null) {
    window.clearInterval(ticker);
  }
});

const loading = computed(() => !clipLoaded.value || !utilityLoaded.value);

// A job can sit in both lists for a tick while it changes state.
function uniqueById<T extends { id: string }>(lists: T[][]): T[] {
  const seen = new Map<string, T>();
  for (const list of lists) {
    for (const row of list) {
      if (!seen.has(row.id)) {
        seen.set(row.id, row);
      }
    }
  }
  return [...seen.values()];
}

const clipJobs = computed(() =>
  uniqueById([clipInFlight.value, clipFinished.value]),
);
const utilityRenders = computed(() =>
  uniqueById([utilityInFlight.value, utilityFinished.value]),
);

/* ---------------- stages & labels ---------------- */

const { stagesFor } = useBootStages();

const clipStageLabels = computed(() => {
  const labels = new Map<string, string>();
  for (const stage of stagesFor("highlights")) {
    if (stage.label) labels.set(stage.key, stage.label);
  }
  return labels;
});

const nadeStages = computed(() => stagesFor("nades"));
const nadeStageLabels = computed(() => {
  const labels = new Map<string, string>();
  for (const stage of nadeStages.value) {
    if (stage.label) labels.set(stage.key, stage.label);
  }
  return labels;
});
const nadeStageKinds = computed(() => {
  const boot = new Set<string>();
  const wait = new Set<string>();
  for (const stage of nadeStages.value) {
    (stage.meta === "wait" ? wait : boot).add(stage.key);
  }
  return { boot, wait };
});

const filmedAt = computed(() =>
  Math.max(seenFilmingAt.value, utilityRenderFilmedAt(utilityFinished.value)),
);

// One pod films every lineup, map after map.
const utilityQueue = computed(() =>
  utilityRenderQueueView(utilityInFlight.value, {
    now: now.value,
    filmedAt: filmedAt.value,
    stages: nadeStageKinds.value,
  }),
);

const utilityQueueRows = computed(() => {
  const rows = new Map<
    string,
    UtilityRenderQueueRow<UtilityLineupRender> & { order: number }
  >();
  let order = 0;
  for (const map of utilityQueue.value.maps) {
    for (const row of map.rows) {
      rows.set(row.render.id, { ...row, order: order++ });
    }
  }
  return rows;
});

const live = computed(() => liveUtilityRenderIds(utilityFinished.value));
const lineupsRendering = computed(() =>
  utilityLineupsRendering(utilityInFlight.value),
);

/* ---------------- batches ---------------- */

const batchJobs = computed(() => {
  const map = new Map<string, ClipJob[]>();
  for (const job of clipJobs.value) {
    const list = map.get(job.match_map_id) ?? [];
    list.push(job);
    map.set(job.match_map_id, list);
  }
  return map;
});

const batchSummaries = computed(() => {
  const out = new Map<string, ClipBatchSummary>();
  for (const [id, jobs] of batchJobs.value) {
    out.set(id, clipBatchSummary(id, jobs, now.value));
  }
  return out;
});

function batchTitle(job: ClipJob): string {
  return (
    clipMatchup(job) ||
    mapLabel(job.match_map?.map) ||
    t("clips.render_queue.unknown_match")
  );
}

/* ---------------- rows ---------------- */

const kinds = computed(() => new Set(kindFilter.value));
const maps = computed(() => new Set(mapFilter.value));

const rows = computed<Row[]>(() => {
  const list = buildLedgerRows({
    clipJobs: clipJobs.value,
    utilityRenders: utilityRenders.value,
    view: view.value,
    query: query.value,
    kinds: kinds.value,
    maps: maps.value,
  });
  if (view.value !== "flight") {
    return list;
  }
  // Lineups in the order the pod will film them.
  const order = utilityQueueRows.value;
  const clips = list.filter((row) => row.kind === "clip");
  const lineups = list
    .filter((row) => row.kind === "utility")
    .sort(
      (a, b) =>
        (order.get(a.key.slice(8))?.order ?? 0) -
        (order.get(b.key.slice(8))?.order ?? 0),
    );
  return [...clips, ...lineups];
});

const inFlightCount = computed(() =>
  countInView(clipJobs.value, utilityRenders.value, "flight"),
);
const failedCount = computed(() =>
  countInView(clipJobs.value, utilityRenders.value, "failed"),
);

const viewOptions = computed(() => [
  {
    key: "flight",
    label: t("pages.render_queue.ledger.view.flight"),
    count: inFlightCount.value || undefined,
  },
  {
    key: "failed",
    label: t("pages.render_queue.ledger.view.failed"),
    count: failedCount.value || undefined,
  },
  { key: "done", label: t("pages.render_queue.ledger.view.done") },
]);

const pageCount = computed(() =>
  view.value === "flight"
    ? 1
    : Math.max(1, Math.ceil(rows.value.length / PER_PAGE)),
);
const pageRows = computed(() =>
  view.value === "flight"
    ? rows.value
    : rows.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE),
);

watch(pageCount, (count) => {
  if (page.value > count) {
    page.value = count;
  }
});
watch([view, query, kindFilter, mapFilter], () => {
  page.value = 1;
});

function goToPage(next: number) {
  page.value = Math.max(1, Math.min(pageCount.value, next));
  // History is a window; reaching its end pulls in the next stretch.
  if (
    page.value >= pageCount.value &&
    clipFinished.value.length >= finishedLimit.value
  ) {
    finishedLimit.value += FINISHED_PAGE_SIZE;
    subscribeClipFinished();
  }
}

type Line =
  | { type: "batch"; key: string; summary: ClipBatchSummary; sample: ClipJob }
  | { type: "pod"; key: string; count: number }
  | { type: "row"; key: string; row: Row };

// In flight, grouped: each batch under its own header, then the lineup pod.
const lines = computed<Line[]>(() => {
  const list = pageRows.value;
  if (view.value !== "flight" || !grouped.value) {
    return list.map((row) => ({ type: "row", key: row.key, row }));
  }
  const out: Line[] = [];
  const byBatch = new Map<string, Row[]>();
  const lineups: Row[] = [];
  for (const row of list) {
    if (row.kind === "clip") {
      const group = byBatch.get(row.job.match_map_id) ?? [];
      group.push(row);
      byBatch.set(row.job.match_map_id, group);
    } else {
      lineups.push(row);
    }
  }
  const batches = [...byBatch.entries()].sort(
    (a, b) =>
      (batchSummaries.value.get(a[0])?.startedAt ?? 0) -
      (batchSummaries.value.get(b[0])?.startedAt ?? 0),
  );
  for (const [id, group] of batches) {
    const summary = batchSummaries.value.get(id);
    if (summary) {
      out.push({
        type: "batch",
        key: `batch:${id}`,
        summary,
        sample: (group[0] as Extract<Row, { kind: "clip" }>).job,
      });
    }
    out.push(
      ...group.map((row) => ({ type: "row" as const, key: row.key, row })),
    );
  }
  if (lineups.length) {
    out.push({ type: "pod", key: "pod", count: lineups.length });
    out.push(
      ...lineups.map((row) => ({ type: "row" as const, key: row.key, row })),
    );
  }
  return out;
});

const presentMaps = computed(() => {
  const out = new Map<string, string>();
  for (const job of clipJobs.value) {
    const name = job.match_map?.map?.name;
    if (name && !out.has(name)) out.set(name, mapLabel(job.match_map?.map));
  }
  for (const render of utilityRenders.value) {
    if (render.map_name && !out.has(render.map_name)) {
      out.set(render.map_name, cleanMapName(render.map_name));
    }
  }
  return [...out.entries()]
    .map(([name, label]) => ({ name, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const filterCount = computed(
  () =>
    (kindFilter.value.length < 2 ? 1 : 0) +
    mapFilter.value.length +
    (grouped.value ? 0 : 1),
);
const filtering = computed(
  () =>
    !!query.value.trim() ||
    kindFilter.value.length < 2 ||
    mapFilter.value.length > 0,
);

function toggleKind(kind: LedgerKind) {
  const has = kindFilter.value.includes(kind);
  // One queue always stays on: a ledger of nothing is not a filter.
  if (has && kindFilter.value.length === 1) {
    return;
  }
  kindFilter.value = has
    ? kindFilter.value.filter((k) => k !== kind)
    : [...kindFilter.value, kind];
}

function toggleMap(name: string) {
  mapFilter.value = mapFilter.value.includes(name)
    ? mapFilter.value.filter((m) => m !== name)
    : [...mapFilter.value, name];
}

function resetFilters() {
  kindFilter.value = ["clip", "utility"];
  mapFilter.value = [];
  grouped.value = true;
}

const nothingAtAll = computed(
  () => clipJobs.value.length === 0 && utilityRenders.value.length === 0,
);

/* ---------------- status words ---------------- */

function clipStatusLabel(row: Extract<Row, { kind: "clip" }>): string {
  if (row.status === "queued") {
    const summary = batchSummaries.value.get(row.job.match_map_id);
    if (summary?.paused) {
      return t("clips.render_queue.status_paused");
    }
    if (summary?.boot) {
      const label = clipStageLabels.value.get(summary.boot.stage);
      if (label) {
        return summary.boot.progress === null
          ? label
          : `${label} ${Math.round(summary.boot.progress * 100)}%`;
      }
    }
  }
  return t(`render_queue_status.${row.status}`);
}

function utilityStatusLabel(render: UtilityLineupRender): string {
  const row = utilityQueueRows.value.get(render.id);
  const stage = row?.stage;
  const label = stage ? nadeStageLabels.value.get(stage.key) : undefined;
  if (render.status !== "queued" || !stage || !label) {
    return t(`pages.utility.render_queue.statuses.${render.status}`);
  }
  if (stage.key === "changing_map") {
    return stage.sub
      ? t("live_stages.changing_map_to", { map: cleanMapName(stage.sub) })
      : label;
  }
  return stage.progress === null
    ? label
    : `${label} ${Math.round(stage.progress * 100)}%`;
}

function statusLabel(row: Row): string {
  return row.kind === "clip"
    ? clipStatusLabel(row)
    : utilityStatusLabel(row.render);
}

function progressOf(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function stamp(value: string | null | undefined): number {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
}

function isLive(row: Row): boolean {
  return row.status === "rendering" || row.status === "uploading";
}

function elapsedAt(row: Row): number {
  if (row.kind === "clip") {
    return isLive(row)
      ? stamp(row.job.last_status_at ?? row.job.created_at)
      : stamp(row.job.created_at);
  }
  return stamp(row.render.created_at);
}

function batchNote(summary: ClipBatchSummary): {
  text: string;
  tone: string;
} | null {
  if (summary.paused) {
    return {
      text: t("pages.render_queue.ledger.batch.paused"),
      tone: "text-[hsl(var(--tac-amber))]",
    };
  }
  if (
    summary.activeJobId &&
    now.value - summary.lastHeardAt > RENDER_STALE_AFTER_MS
  ) {
    return {
      text: t("pages.render_queue.ledger.batch.silent", {
        since: since(summary.lastHeardAt, now.value),
      }),
      tone: "text-warning",
    };
  }
  if (summary.boot) {
    return {
      text:
        summary.boot.progress === null
          ? t("pages.render_queue.ledger.batch.booting")
          : t("pages.render_queue.ledger.batch.booting_pct", {
              pct: Math.round(summary.boot.progress * 100),
            }),
      tone: "",
    };
  }
  if (
    !summary.activeJobId &&
    gpuPool.hasLoaded &&
    gpuPool.status?.free_gpu_nodes_for_batch === 0
  ) {
    return { text: t("pages.render_queue.ledger.batch.waiting_gpu"), tone: "" };
  }
  return null;
}

const podMaps = computed(() =>
  utilityQueue.value.maps.map((map) => cleanMapName(map.mapName)).join(" → "),
);

const podNote = computed(() => {
  const queue = utilityQueue.value;
  if (queue.booting) {
    const stage = [...utilityQueueRows.value.values()].find(
      (row) => row.stage && nadeStageKinds.value.boot.has(row.stage.key),
    )?.stage;
    const label = stage ? nadeStageLabels.value.get(stage.key) : null;
    if (label) {
      return stage?.progress == null
        ? label
        : `${label} ${Math.round(stage.progress * 100)}%`;
    }
    return t("pages.utility.render_queue.render_pod_booting");
  }
  const here = queue.maps.find((map) => map.here);
  if (queue.active && here) {
    return t("pages.render_queue.ledger.pod_on", {
      map: cleanMapName(here.mapName),
    });
  }
  return null;
});

const resumeBlocked = computed(
  () => gpuPool.hasLoaded && !!gpuPool.status?.live_in_progress,
);

// What the GPUs are doing, for the queue as a whole.
const queueStatus = computed<{ key: string; tone: string; count?: number }>(
  () => {
    const flying = clipInFlight.value;
    const rendering = flying.filter(
      (job) => job.status === "rendering" || job.status === "uploading",
    ).length;
    if (rendering > 0) {
      return {
        key: "rendering",
        tone: "text-[hsl(var(--tac-amber))]",
        count: rendering,
      };
    }
    if (flying.length > 0 && flying.every((job) => job.paused === true)) {
      return { key: "paused", tone: "text-[hsl(var(--tac-amber))]" };
    }
    const s = gpuPool.status;
    if (gpuPool.hasLoaded && s) {
      if (s.total_gpu_nodes === 0) {
        return { key: "no_gpu_registered", tone: "text-destructive" };
      }
      if (s.free_gpu_nodes_for_batch === 0 && flying.length > 0) {
        if (s.renders_paused_for_active_match) {
          return {
            key: "paused_active_match",
            tone: "text-[hsl(var(--tac-amber))]",
          };
        }
        if (s.live_in_progress) {
          return { key: "blocked_live", tone: "text-[hsl(var(--tac-amber))]" };
        }
        if (s.demo_in_progress) {
          return { key: "blocked_demo", tone: "text-[hsl(var(--tac-amber))]" };
        }
        return { key: "no_gpu_free", tone: "text-[hsl(var(--tac-amber))]" };
      }
    }
    return flying.length === 0
      ? { key: "idle", tone: "text-muted-foreground" }
      : { key: "waiting", tone: "text-muted-foreground" };
  },
);

/* ---------------- selection ---------------- */

const selected = ref<Set<string>>(new Set());

function isSelected(key: string) {
  return selected.value.has(key);
}

function setSelected(key: string, on: boolean) {
  const next = new Set(selected.value);
  if (on) next.add(key);
  else next.delete(key);
  selected.value = next;
}

const pageKeys = computed(() => pageRows.value.map((row) => row.key));
const allState = computed<boolean | "indeterminate">(() => {
  const keys = pageKeys.value;
  const picked = keys.filter((key) => selected.value.has(key)).length;
  if (picked === 0) return false;
  return picked === keys.length ? true : "indeterminate";
});

function toggleAll(on: boolean | "indeterminate") {
  const next = new Set(selected.value);
  for (const key of pageKeys.value) {
    if (on === true) next.add(key);
    else next.delete(key);
  }
  selected.value = next;
}

function clearSelection() {
  selected.value = new Set();
}

watch(view, clearSelection);

// A row that left the list (finished, cancelled) leaves the selection too.
watch(rows, (list) => {
  if (selected.value.size === 0) return;
  const present = new Set(list.map((row) => row.key));
  const next = new Set([...selected.value].filter((key) => present.has(key)));
  if (next.size !== selected.value.size) {
    selected.value = next;
  }
});

const selectedRows = computed(() =>
  rows.value.filter((row) => selected.value.has(row.key)),
);

/* ---------------- mutations ---------------- */

const busy = ref<Record<string, boolean>>({});
function setBusy(key: string, on: boolean) {
  busy.value = { ...busy.value, [key]: on };
}

function failureText(error: any): string | undefined {
  return error?.graphQLErrors?.[0]?.message ?? error?.message;
}

async function mutate(mutation: any, variables?: Record<string, unknown>) {
  return nuxtApp.$apollo.defaultClient.mutate({ mutation, variables });
}

async function requeueClip(jobId: string): Promise<boolean> {
  try {
    await mutate(
      generateMutation({
        requeueClipRender: [{ job_id: jobId }, { success: true }],
      } as any),
    );
    return true;
  } catch (error) {
    console.error("[render-queue] requeue failed:", error);
    return false;
  }
}

async function renderLineup(
  lineupId: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data } = await mutate(renderUtilityLineupPreviewMutation, {
      utility_lineup_id: lineupId,
    });
    const result = (data as any)?.renderUtilityLineupPreview;
    return { ok: !!result?.success, reason: result?.reason ?? undefined };
  } catch (error) {
    return { ok: false, reason: failureText(error) };
  }
}

async function cancelClipBatch(matchMapId: string): Promise<boolean> {
  try {
    await mutate(
      generateMutation({
        cancelClipRenderBatch: [
          { match_map_id: matchMapId },
          { success: true },
        ],
      } as any),
    );
    return true;
  } catch (error) {
    console.error("[render-queue] batch cancel failed:", error);
    return false;
  }
}

async function cancelLineupRender(renderId: string): Promise<boolean> {
  try {
    await mutate(cancelUtilityLineupRenderMutation, { render_id: renderId });
    return true;
  } catch (error) {
    console.error("[render-queue] utility cancel failed:", error);
    return false;
  }
}

// The api has no bulk mutation, so a bulk action is the single one in a
// loop, with its progress on the bar and one toast at the end.
const bulk = ref<{ label: string; done: number; total: number } | null>(null);

async function runBulk(
  label: string,
  tasks: Array<() => Promise<boolean>>,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let done = 0;
  bulk.value = { label, done, total: tasks.length };
  for (const task of tasks) {
    if (await task()) ok++;
    done++;
    bulk.value = { label, done, total: tasks.length };
  }
  bulk.value = null;
  return { ok, failed: tasks.length - ok };
}

function bulkToast(
  key: "requeued" | "cancelled",
  result: { ok: number; failed: number },
) {
  toast({
    title: t(
      `pages.render_queue.ledger.toast.${key}`,
      { count: result.ok },
      result.ok,
    ),
    description:
      result.failed > 0
        ? t(
            "pages.render_queue.ledger.toast.not_done",
            { count: result.failed },
            result.failed,
          )
        : undefined,
    variant: result.ok === 0 && result.failed > 0 ? "destructive" : undefined,
  });
}

function requeueTasks(list: Row[]): Array<() => Promise<boolean>> {
  const clipTasks = list
    .filter((row): row is Extract<Row, { kind: "clip" }> => row.kind === "clip")
    .map((row) => () => requeueClip(row.job.id));
  const lineupTasks = lineupsToRender(
    list
      .filter(
        (row): row is Extract<Row, { kind: "utility" }> =>
          row.kind === "utility",
      )
      .map((row) => row.render),
    lineupsRendering.value,
  ).map((id) => async () => (await renderLineup(id)).ok);
  return [...clipTasks, ...lineupTasks];
}

async function requeueSelected() {
  const tasks = requeueTasks(selectedRows.value);
  const result = await runBulk(
    t("pages.render_queue.ledger.bulk.requeueing"),
    tasks,
  );
  clearSelection();
  bulkToast("requeued", result);
  void refreshCoverage();
}

async function retryAllFailed() {
  const tasks = requeueTasks(rows.value);
  const result = await runBulk(
    t("pages.render_queue.ledger.bulk.requeueing"),
    tasks,
  );
  clearSelection();
  bulkToast("requeued", result);
  void refreshCoverage();
}

function askCancelSelected() {
  const list = selectedRows.value;
  const clips = list.filter(
    (row): row is Extract<Row, { kind: "clip" }> => row.kind === "clip",
  );
  const renders = list.filter(
    (row): row is Extract<Row, { kind: "utility" }> => row.kind === "utility",
  );
  const batches = batchesOf(clips.map((row) => row.job));
  ask({
    title: t(
      "pages.render_queue.ledger.confirm.cancel_title",
      { count: list.length },
      list.length,
    ),
    body: clips.length
      ? `${t("pages.render_queue.ledger.confirm.cancel_body")} ${t("pages.render_queue.ledger.confirm.cancel_batches")}`
      : t("pages.render_queue.ledger.confirm.cancel_body"),
    keep: t("pages.render_queue.ledger.confirm.keep"),
    action: t("pages.render_queue.ledger.confirm.cancel_action"),
    run: async () => {
      const result = await runBulk(
        t("pages.render_queue.ledger.bulk.cancelling"),
        [
          ...batches.map((id) => () => cancelClipBatch(id)),
          ...renders.map((row) => () => cancelLineupRender(row.render.id)),
        ],
      );
      clearSelection();
      bulkToast("cancelled", result);
    },
  });
}

/* ---------------- confirm dialog ---------------- */

type Confirm = {
  title: string;
  body: string;
  keep?: string;
  action: string;
  run: () => Promise<void>;
};

const confirm = ref<Confirm | null>(null);
// The dialog keeps its words while it closes.
const confirmShown = ref<Confirm | null>(null);
const confirmRunning = ref(false);

function ask(next: Confirm) {
  confirm.value = next;
  confirmShown.value = next;
}

async function runConfirm() {
  const current = confirm.value;
  if (!current || confirmRunning.value) return;
  confirmRunning.value = true;
  try {
    await current.run();
  } finally {
    confirmRunning.value = false;
    confirm.value = null;
  }
}

/* ---------------- single-row actions ---------------- */

async function requeueOne(job: ClipJob) {
  setBusy(job.id, true);
  const ok = await requeueClip(job.id);
  setBusy(job.id, false);
  toast({
    title: ok
      ? t("pages.render_queue.ledger.toast.clip_requeued")
      : t("pages.render_queue.ledger.toast.clip_not_requeued"),
    variant: ok ? undefined : "destructive",
  });
}

async function retryBatch(matchMapId: string, onlyFailed: boolean) {
  const key = `${matchMapId}:${onlyFailed ? "failed" : "all"}`;
  setBusy(key, true);
  try {
    await mutate(
      generateMutation({
        retryClipRenderBatch: [
          { match_map_id: matchMapId, only_failed: onlyFailed },
          { success: true },
        ],
      } as any),
    );
    toast({ title: t("pages.render_queue.ledger.toast.batch_requeued") });
  } catch (error) {
    toast({ title: failureText(error) ?? "", variant: "destructive" });
  } finally {
    setBusy(key, false);
  }
}

async function clearBatch(matchMapId: string) {
  setBusy(`clear:${matchMapId}`, true);
  try {
    await mutate(
      generateMutation({
        clearClipRenderBatch: [{ match_map_id: matchMapId }, { success: true }],
      } as any),
    );
    clipFinished.value = clipFinished.value.filter(
      (job) => job.match_map_id !== matchMapId,
    );
  } catch (error) {
    toast({ title: failureText(error) ?? "", variant: "destructive" });
  } finally {
    setBusy(`clear:${matchMapId}`, false);
  }
}

function askCancelBatch(matchMapId: string) {
  const sample = batchJobs.value.get(matchMapId)?.[0];
  ask({
    title: t("pages.render_queue.ledger.confirm.batch_title", {
      name: sample ? batchTitle(sample) : t("clips.render_queue.unknown_match"),
    }),
    body: t("pages.render_queue.ledger.confirm.batch_body"),
    keep: t("pages.render_queue.ledger.confirm.keep"),
    action: t("pages.render_queue.ledger.cancel_batch"),
    run: async () => {
      const ok = await cancelClipBatch(matchMapId);
      toast({
        title: ok
          ? t("pages.render_queue.ledger.toast.batch_cancelled")
          : t("pages.render_queue.ledger.toast.batch_not_cancelled"),
        variant: ok ? undefined : "destructive",
      });
    },
  });
}

const RESUME_CLIP_RENDER_BATCH = gql`
  mutation ResumeClipRenderBatch($match_map_id: uuid!) {
    resumeClipRenderBatch(match_map_id: $match_map_id) {
      success
    }
  }
`;

async function resumeBatch(matchMapId: string) {
  setBusy(`resume:${matchMapId}`, true);
  try {
    await mutate(RESUME_CLIP_RENDER_BATCH, { match_map_id: matchMapId });
  } catch (error) {
    toast({ title: failureText(error) ?? "", variant: "destructive" });
  } finally {
    setBusy(`resume:${matchMapId}`, false);
  }
}

function askClearFinished() {
  ask({
    title: t("pages.render_queue.ledger.confirm.clear_title"),
    body: t("pages.render_queue.ledger.confirm.clear_body"),
    action: t("pages.utility.render_queue.clear_finished"),
    run: async () => {
      try {
        await mutate(
          generateMutation({
            clearFinishedClipRenders: [{}, { success: true }],
          } as any),
        );
        await mutate(clearFinishedUtilityLineupRendersMutation);
        clipFinished.value = clipFinished.value.filter(
          (job) =>
            job.status === "error" || (job.status === "done" && !job.clip_id),
        );
        toast({ title: t("pages.render_queue.ledger.toast.cleared") });
      } catch (error) {
        toast({
          title: t("pages.utility.render_queue.clear_failed"),
          description: failureText(error),
          variant: "destructive",
        });
      }
    },
  });
}

async function cancelUtility(render: UtilityLineupRender) {
  setBusy(render.id, true);
  const ok = await cancelLineupRender(render.id);
  setBusy(render.id, false);
  if (!ok) {
    toast({
      title: t("pages.utility.render_queue.cancel_failed"),
      variant: "destructive",
    });
  }
}

async function rerender(render: UtilityLineupRender) {
  setBusy(render.id, true);
  const result = await renderLineup(render.utility_lineup_id);
  setBusy(render.id, false);
  toast({
    title: result.ok
      ? t("pages.utility.render_queue.requeued")
      : t("pages.utility.render_queue.not_requeued"),
    description: result.reason,
    variant: result.ok ? undefined : "destructive",
  });
  void refreshCoverage();
}

function canRerender(render: UtilityLineupRender): boolean {
  return render.status !== "done" || live.value.has(render.id);
}

const deleteOpen = ref(false);
const deleteTarget = shallowRef<UtilityLineupRender | null>(null);

// A render that is a lineup's live preview takes the preview down with it,
// so that one goes through the confirm; any other row just goes.
async function removeRender(render: UtilityLineupRender) {
  if (live.value.has(render.id)) {
    deleteTarget.value = render;
    deleteOpen.value = true;
    return;
  }
  setBusy(`delete:${render.id}`, true);
  try {
    await mutate(deleteUtilityLineupRenderMutation, { render_id: render.id });
  } catch (error) {
    toast({
      title: t("pages.utility.render_queue.delete_failed"),
      description: failureText(error),
      variant: "destructive",
    });
  } finally {
    setBusy(`delete:${render.id}`, false);
  }
}

const previewOpen = ref(false);
const previewRender = shallowRef<UtilityLineupRender | null>(null);

function playUtility(render: UtilityLineupRender) {
  previewRender.value = render;
  previewOpen.value = true;
}

function playClip(job: ClipJob) {
  if (job.status !== "done" || !job.clip_id) return;
  const items: ClipQueueItem[] = (batchJobs.value.get(job.match_map_id) ?? [])
    .filter((entry) => entry.status === "done" && !!entry.clip_id)
    .map((entry) => ({
      id: entry.clip_id as string,
      title: entry.spec?.title ?? null,
      playerName: entry.spec?.target_name ?? null,
      teamName: null,
      durationMs: entry.spec?.duration_ms ?? null,
      thumbnailUrl: null,
      posterUrl: entry.match_map?.map?.poster ?? null,
    }));
  setClipQueue(items, `render-queue:${job.match_map_id}`);
  showClip(job.clip_id);
}

/* ---------------- sheet ---------------- */

const sheetKey = ref<string | null>(null);
const sheetOpen = computed({
  get: () => sheetKey.value !== null,
  set: (value: boolean) => {
    if (!value) sheetKey.value = null;
  },
});

// Looked up live, so the sheet follows its row through every tick -- and
// keeps showing it after it moves to another list.
const sheetRow = computed<Row | null>(() => {
  const key = sheetKey.value;
  if (!key) return null;
  if (key.startsWith("clip:")) {
    const job = clipJobs.value.find((entry) => `clip:${entry.id}` === key);
    if (!job) return null;
    const status =
      job.status === "done" && !job.clip_id ? "missing" : job.status;
    return {
      kind: "clip",
      key,
      status,
      map: job.match_map?.map?.name ?? null,
      at: stamp(job.last_status_at),
      job,
    };
  }
  const render = utilityRenders.value.find(
    (entry) => `utility:${entry.id}` === key,
  );
  return render
    ? {
        kind: "utility",
        key,
        status: render.status,
        map: render.map_name,
        at: stamp(render.last_status_at),
        render,
      }
    : null;
});

const sheetSummary = computed(() =>
  sheetRow.value?.kind === "clip"
    ? (batchSummaries.value.get(sheetRow.value.job.match_map_id) ?? null)
    : null,
);
const sheetHistories = computed(() =>
  sheetRow.value?.kind === "clip"
    ? (batchJobs.value.get(sheetRow.value.job.match_map_id) ?? [])
        .filter((job) => !CLIP_TERMINAL.has(job.status))
        .map((job) => job.status_history)
    : [],
);

function openRow(row: Row) {
  sheetKey.value = row.key;
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          v-model="query"
          autocomplete="off"
          :placeholder="$t('pages.render_queue.ledger.search')"
          :aria-label="$t('pages.render_queue.ledger.search')"
          class="h-full text-sm"
        />
        <InputGroupAddon align="inline-end" class="pr-2">
          <button
            v-if="query"
            type="button"
            class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :aria-label="$t('common.reset_filters')"
            @click="query = ''"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>

      <div
        class="max-w-full overflow-x-auto [scrollbar-width:none] max-md:order-last"
      >
        <AnimatedFilters v-model="view" square :options="viewOptions" />
      </div>

      <FilterMenu
        :count="filterCount"
        :active="filterCount > 0"
        :show-reset="filterCount > 0"
        align="start"
        content-class="w-[min(90vw,320px)] space-y-3 p-3"
        @reset="resetFilters"
      >
        <div class="space-y-1.5">
          <span
            class="block px-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.render_queue.ledger.filter.queue") }}
          </span>
          <div class="flex flex-wrap gap-1.5">
            <FilterChip
              :label="$t('pages.render_queue.tabs.highlights')"
              :active="kindFilter.includes('clip')"
              @toggle="toggleKind('clip')"
            />
            <FilterChip
              :label="$t('pages.render_queue.tabs.utility')"
              :active="kindFilter.includes('utility')"
              @toggle="toggleKind('utility')"
            />
          </div>
        </div>
        <div v-if="presentMaps.length" class="space-y-1.5">
          <span
            class="block px-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.render_queue.ledger.filter.map") }}
          </span>
          <div class="flex flex-wrap gap-1.5">
            <FilterChip
              v-for="map in presentMaps"
              :key="map.name"
              :label="map.label"
              :active="mapFilter.includes(map.name)"
              @toggle="toggleMap(map.name)"
            />
          </div>
        </div>
        <FilterToggle
          v-model="grouped"
          :label="$t('pages.render_queue.ledger.filter.group')"
        />
      </FilterMenu>

      <span
        class="ml-auto hidden items-center gap-2 text-[0.8rem] lg:inline-flex"
        :class="queueStatus.tone"
      >
        <span
          v-if="queueStatus.key === 'rendering'"
          class="relative inline-flex h-2 w-2"
          aria-hidden="true"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
          />
          <span
            class="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tac-amber))]"
          />
        </span>
        <Pause
          v-else-if="queueStatus.key.startsWith('paused')"
          class="h-3.5 w-3.5"
        />
        <CircleAlert
          v-else-if="queueStatus.key === 'no_gpu_registered'"
          class="h-3.5 w-3.5"
        />
        <Clock v-else class="h-3.5 w-3.5" />
        <template v-if="queueStatus.key === 'rendering'">
          {{
            $t(
              "clips.render_queue.status_rendering",
              { count: queueStatus.count },
              queueStatus.count ?? 0,
            )
          }}
        </template>
        <template v-else>
          {{ $t(`clips.render_queue.status_${queueStatus.key}`) }}
        </template>
      </span>

      <Button
        v-if="view === 'failed' && rows.length > 0"
        size="sm"
        class="h-8 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)] max-lg:ml-auto"
        :disabled="!!bulk"
        @click="retryAllFailed"
      >
        <RotateCcw class="h-4 w-4" />
        {{ $t("pages.render_queue.ledger.retry_all", { count: rows.length }) }}
      </Button>
      <Button
        v-else-if="view === 'done' && rows.length > 0"
        size="sm"
        variant="ghost"
        class="h-8 text-muted-foreground hover:text-foreground max-lg:ml-auto"
        @click="askClearFinished"
      >
        {{ $t("pages.utility.render_queue.clear_finished") }}
      </Button>
    </div>

    <RenderQueueCoverageStrip
      v-if="kindFilter.includes('utility')"
      :coverage="coverage"
      :failed="coverageFailed"
      @enqueued="refreshCoverage()"
    />

    <FadeSwap>
      <div
        v-if="loading"
        key="loading"
        class="space-y-px overflow-hidden rounded-lg border border-border"
      >
        <Skeleton v-for="n in 5" :key="n" class="h-12 w-full rounded-none" />
      </div>

      <SlideSwap v-else key="ledger" :index="viewIndex">
        <div :key="view">
          <SectionEmpty
            v-if="nothingAtAll"
            :title="$t('clips.render_queue.empty_title')"
            :description="$t('pages.render_queue.ledger.empty.all')"
          />
          <SectionEmpty
            v-else-if="rows.length === 0"
            :title="$t(`pages.render_queue.ledger.empty.${view}_title`)"
            :description="
              filtering
                ? $t('pages.render_queue.ledger.empty.filtered')
                : $t(`pages.render_queue.ledger.empty.${view}`)
            "
          />

          <template v-else>
            <div class="overflow-x-auto rounded-lg border border-border">
              <table class="w-full min-w-[760px] text-sm">
                <thead
                  class="border-b border-border bg-muted/20 text-left text-xs text-muted-foreground"
                >
                  <tr>
                    <th class="w-10 px-3 py-2">
                      <Checkbox
                        :model-value="allState"
                        class="border-border data-[state=checked]:border-[hsl(var(--tac-amber))] data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=checked]:text-black data-[state=indeterminate]:border-[hsl(var(--tac-amber))]"
                        :aria-label="$t('pages.render_queue.ledger.select_all')"
                        @update:model-value="toggleAll"
                      />
                    </th>
                    <th class="px-3 py-2 font-medium">
                      {{ $t("pages.render_queue.ledger.col.render") }}
                    </th>
                    <th class="px-3 py-2 font-medium">
                      {{ $t("common.status") }}
                    </th>
                    <th class="px-3 py-2 font-medium">
                      {{
                        view === "flight"
                          ? $t("pages.render_queue.ledger.col.progress")
                          : $t("pages.render_queue.ledger.col.length")
                      }}
                    </th>
                    <th class="px-3 py-2 text-right font-medium">
                      {{
                        view === "flight"
                          ? $t("pages.render_queue.ledger.col.elapsed")
                          : $t("pages.render_queue.ledger.col.finished")
                      }}
                    </th>
                    <th class="px-3 py-2 text-right">
                      <span class="sr-only">{{
                        $t("pages.render_queue.ledger.col.actions")
                      }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="line in lines" :key="line.key">
                    <!-- A batch: one pod works through its clips in order. -->
                    <tr
                      v-if="line.type === 'batch'"
                      class="border-t border-border/60 bg-muted/30 first:border-t-0"
                    >
                      <td colspan="6" class="px-3 py-2">
                        <div
                          class="flex flex-wrap items-center gap-x-3 gap-y-1.5"
                        >
                          <Film class="h-3.5 w-3.5 text-muted-foreground" />
                          <span class="font-semibold">{{
                            batchTitle(line.sample)
                          }}</span>
                          <span
                            class="text-xs tabular-nums text-muted-foreground"
                          >
                            <template v-if="clipMatchup(line.sample)">
                              {{ mapLabel(line.sample.match_map?.map) }} ·
                            </template>
                            {{
                              $t("pages.render_queue.ledger.batch.done_of", {
                                done: line.summary.terminal,
                                total: line.summary.total,
                              })
                            }}
                            <span
                              v-if="line.summary.failed"
                              class="text-destructive"
                            >
                              ·
                              {{
                                $t(
                                  "pages.render_queue.ledger.batch.failed",
                                  { count: line.summary.failed },
                                  line.summary.failed,
                                )
                              }}
                            </span>
                            <span
                              v-if="batchNote(line.summary)"
                              :class="batchNote(line.summary)?.tone"
                            >
                              · {{ batchNote(line.summary)?.text }}
                            </span>
                          </span>
                          <div
                            class="h-1 w-[120px] overflow-hidden rounded-full bg-muted/60"
                          >
                            <div
                              class="h-full origin-left rounded-full motion-reduce:!transition-none"
                              :class="
                                line.summary.paused
                                  ? 'bg-[hsl(var(--tac-amber)/0.5)]'
                                  : 'bg-[hsl(var(--tac-amber))]'
                              "
                              :style="{
                                transform: `scaleX(${line.summary.progress})`,
                                transition:
                                  'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                              }"
                            />
                          </div>
                          <span class="flex-1" />
                          <div class="flex items-center gap-0.5">
                            <Button
                              v-if="line.sample.match_map?.match?.id"
                              as-child
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-muted-foreground"
                              :title="$t('clips.render_queue.open_match')"
                            >
                              <NuxtLink
                                :to="`/matches/${line.sample.match_map.match.id}`"
                                :aria-label="
                                  $t('clips.render_queue.open_match')
                                "
                              >
                                <ExternalLink class="h-3.5 w-3.5" />
                              </NuxtLink>
                            </Button>
                            <FiveStackToolTip
                              v-if="line.summary.paused && resumeBlocked"
                              as-child
                            >
                              <template #trigger>
                                <span tabindex="0" class="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    class="size-7"
                                    disabled
                                    :aria-label="$t('ui_extras.resume')"
                                  >
                                    <Play class="h-3.5 w-3.5" />
                                  </Button>
                                </span>
                              </template>
                              {{ $t("clips.render_queue.resume_blocked_live") }}
                            </FiveStackToolTip>
                            <Button
                              v-else-if="line.summary.paused"
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-muted-foreground"
                              :title="$t('ui_extras.resume')"
                              :aria-label="$t('ui_extras.resume')"
                              :loading="
                                busy[`resume:${line.summary.matchMapId}`]
                              "
                              @click="resumeBatch(line.summary.matchMapId)"
                            >
                              <Play class="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              v-if="
                                line.summary.failed || line.summary.cancelled
                              "
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-muted-foreground"
                              :title="$t('clips.render_queue.retry_failed')"
                              :aria-label="
                                $t('clips.render_queue.retry_failed')
                              "
                              :loading="
                                busy[`${line.summary.matchMapId}:failed`]
                              "
                              @click="retryBatch(line.summary.matchMapId, true)"
                            >
                              <RotateCcw class="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-muted-foreground hover:text-destructive"
                              :title="
                                $t('pages.render_queue.ledger.cancel_batch')
                              "
                              :aria-label="
                                $t('pages.render_queue.ledger.cancel_batch')
                              "
                              @click="askCancelBatch(line.summary.matchMapId)"
                            >
                              <X class="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>

                    <!-- The lineup pod: one pod films every lineup, map after
                         map. -->
                    <tr
                      v-else-if="line.type === 'pod'"
                      class="border-t border-border/60 bg-muted/30 first:border-t-0"
                    >
                      <td colspan="6" class="px-3 py-2">
                        <div
                          class="flex flex-wrap items-center gap-x-3 gap-y-1"
                        >
                          <Clapperboard
                            class="h-3.5 w-3.5 text-muted-foreground"
                          />
                          <span class="font-semibold">{{
                            $t("pages.utility.render_queue.pod")
                          }}</span>
                          <span
                            class="text-xs tabular-nums text-muted-foreground"
                          >
                            <template v-if="podMaps">{{ podMaps }} · </template>
                            {{
                              $t(
                                "pages.utility.render_queue.lineups",
                                { count: line.count },
                                line.count,
                              )
                            }}
                            <template v-if="podNote"> · {{ podNote }}</template>
                          </span>
                          <span
                            v-if="utilityQueue.unclaimed"
                            class="inline-flex items-center gap-1.5 text-xs text-warning"
                          >
                            <UtilityRenderWarn
                              :title="$t('pages.utility.render_queue.no_pod')"
                              :note="
                                $t('pages.utility.render_queue.no_pod_hint')
                              "
                            />
                            {{ $t("pages.utility.render_queue.no_pod") }}
                          </span>
                        </div>
                      </td>
                    </tr>

                    <tr
                      v-else
                      class="cursor-pointer border-t border-border/40 transition-colors duration-150 first:border-t-0 hover:bg-muted/20"
                      :class="
                        isSelected(line.row.key)
                          ? 'bg-[hsl(var(--tac-amber)/0.08)] hover:bg-[hsl(var(--tac-amber)/0.12)]'
                          : ''
                      "
                      @click="openRow(line.row)"
                    >
                      <td class="w-10 px-3 py-2.5 align-middle" @click.stop>
                        <Checkbox
                          :model-value="isSelected(line.row.key)"
                          class="border-border data-[state=checked]:border-[hsl(var(--tac-amber))] data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=checked]:text-black"
                          :aria-label="
                            $t('pages.render_queue.ledger.select', {
                              name:
                                line.row.kind === 'clip'
                                  ? clipTitle(line.row.job, $t)
                                  : (line.row.render.lineup?.name ??
                                    line.row.render.utility_lineup_id),
                            })
                          "
                          @update:model-value="
                            setSelected(line.row.key, $event === true)
                          "
                        />
                      </td>

                      <!-- Render -->
                      <td class="max-w-[28rem] px-3 py-2.5 align-middle">
                        <div class="grid min-w-0 gap-0.5">
                          <template v-if="line.row.kind === 'clip'">
                            <span class="flex min-w-0 items-center gap-1.5">
                              <Film
                                class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              />
                              <span class="truncate font-medium">{{
                                clipTitle(line.row.job, $t)
                              }}</span>
                              <span
                                v-for="detail in clipDetails(line.row.job)"
                                :key="detail.label"
                                class="inline-flex h-4 shrink-0 items-center rounded border px-1 font-mono text-[0.62rem] tabular-nums"
                                :class="
                                  detail.tone === 'kills'
                                    ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                                    : detail.tone === 'round'
                                      ? 'border-foreground/30 bg-foreground/5 text-foreground'
                                      : 'border-border text-muted-foreground'
                                "
                              >
                                {{ detail.label }}
                              </span>
                            </span>
                            <span
                              v-if="!grouped || view !== 'flight'"
                              class="truncate text-xs text-muted-foreground"
                            >
                              {{ batchTitle(line.row.job) }}
                              <template v-if="clipMatchup(line.row.job)">
                                · {{ mapLabel(line.row.job.match_map?.map) }}
                              </template>
                            </span>
                            <span
                              v-if="
                                line.row.job.error_message && view !== 'flight'
                              "
                              class="break-words font-mono text-[0.7rem] text-destructive"
                            >
                              {{ line.row.job.error_message }}
                            </span>
                            <span
                              v-else-if="line.row.status === 'missing'"
                              class="font-mono text-[0.7rem] text-destructive"
                            >
                              {{ $t("pages.render_queue.ledger.missing_clip") }}
                            </span>
                          </template>

                          <template v-else>
                            <span class="flex min-w-0 items-center gap-1.5">
                              <UtilityTypeGlyph
                                v-if="line.row.render.lineup?.utility_type"
                                :type="line.row.render.lineup.utility_type"
                                class="h-3.5 w-3.5 shrink-0"
                              />
                              <span class="truncate font-medium">{{
                                line.row.render.lineup?.name ??
                                line.row.render.utility_lineup_id
                              }}</span>
                              <UtilityRenderWarn
                                v-if="
                                  utilityQueueRows.get(line.row.render.id)
                                    ?.stale
                                "
                                :title="
                                  $t('pages.utility.render_queue.stale', {
                                    since: since(
                                      stamp(line.row.render.last_status_at),
                                      now,
                                    ),
                                  })
                                "
                              />
                              <span
                                v-if="live.has(line.row.render.id)"
                                class="inline-flex h-4 shrink-0 items-center rounded bg-success/15 px-1 text-[0.65rem] text-success"
                                :title="
                                  $t('pages.utility.render_queue.live_hint')
                                "
                              >
                                {{ $t("pages.utility.render_queue.live") }}
                              </span>
                            </span>
                            <span
                              v-if="!grouped || view !== 'flight'"
                              class="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
                            >
                              {{
                                $t("pages.render_queue.ledger.lineup_on", {
                                  map: cleanMapName(line.row.render.map_name),
                                })
                              }}
                              <template
                                v-if="line.row.render.status === 'done'"
                              >
                                ·
                                <UtilityRenderVersion
                                  :version="line.row.render.render_version"
                                  :expected="coverage?.version"
                                />
                              </template>
                            </span>
                            <span
                              v-if="line.row.render.error_message"
                              class="break-words font-mono text-[0.7rem]"
                              :class="
                                view === 'flight'
                                  ? 'text-[hsl(var(--tac-amber))]'
                                  : 'text-destructive'
                              "
                            >
                              {{ line.row.render.error_message }}
                            </span>
                            <span
                              v-else-if="line.row.render.skip_reason"
                              class="text-[0.7rem] text-muted-foreground"
                            >
                              {{ line.row.render.skip_reason }}
                            </span>
                          </template>
                        </div>
                      </td>

                      <!-- Status: the icon carries the tone, the word the fact. -->
                      <td class="px-3 py-2.5 align-middle">
                        <span
                          class="inline-flex items-center gap-1.5 whitespace-nowrap"
                          :class="statusToneClass(line.row.status)"
                        >
                          <component
                            :is="statusIcon(line.row.status)"
                            class="h-3.5 w-3.5 shrink-0"
                            :class="
                              line.row.status === 'rendering'
                                ? 'animate-spin'
                                : ''
                            "
                          />
                          {{ statusLabel(line.row) }}
                        </span>
                      </td>

                      <!-- Progress / length -->
                      <td class="px-3 py-2.5 align-middle">
                        <template v-if="view === 'flight'">
                          <div
                            v-if="line.row.status === 'rendering'"
                            class="grid min-w-[110px] gap-1"
                          >
                            <div
                              class="h-1 overflow-hidden rounded-full bg-muted/60"
                            >
                              <div
                                class="h-full origin-left rounded-full bg-[hsl(var(--tac-amber))] motion-reduce:!transition-none"
                                :style="{
                                  transform: `scaleX(${progressOf(
                                    line.row.kind === 'clip'
                                      ? line.row.job.progress
                                      : line.row.render.progress,
                                  )})`,
                                  transition:
                                    'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                                }"
                              />
                            </div>
                            <span
                              class="text-[0.7rem] tabular-nums text-muted-foreground"
                            >
                              {{
                                Math.round(
                                  progressOf(
                                    line.row.kind === "clip"
                                      ? line.row.job.progress
                                      : line.row.render.progress,
                                  ) * 100,
                                )
                              }}%
                            </span>
                          </div>
                          <div
                            v-else-if="line.row.status === 'uploading'"
                            class="grid min-w-[110px] gap-1"
                          >
                            <div
                              class="relative h-1 overflow-hidden rounded-full bg-info/20"
                            >
                              <div
                                class="absolute inset-0 w-[30%] animate-upload-pulse rounded-full bg-[linear-gradient(90deg,transparent,hsl(var(--info))_50%,transparent)] motion-reduce:animate-none"
                              />
                            </div>
                            <span class="text-[0.7rem] text-muted-foreground">
                              {{ $t("render_queue_status.uploading") }}
                            </span>
                          </div>
                          <span v-else class="text-muted-foreground/50">—</span>
                        </template>
                        <span
                          v-else
                          class="font-mono text-xs tabular-nums text-muted-foreground"
                        >
                          <template v-if="line.row.kind === 'clip'">
                            {{ clipDuration(line.row.job) ?? "—" }}
                          </template>
                          <template v-else>
                            {{
                              line.row.render.duration_ms
                                ? `${Math.round(Number(line.row.render.duration_ms) / 1000)}s`
                                : "—"
                            }}
                          </template>
                        </span>
                      </td>

                      <!-- Elapsed / finished -->
                      <td
                        class="whitespace-nowrap px-3 py-2.5 text-right align-middle text-xs tabular-nums"
                        :class="
                          view === 'flight' && !isLive(line.row)
                            ? 'text-muted-foreground/70'
                            : 'text-muted-foreground'
                        "
                      >
                        <template v-if="view === 'flight'">
                          {{ since(elapsedAt(line.row), now) }}
                        </template>
                        <template v-else>
                          {{
                            $t("pages.render_queue.ledger.ago", {
                              since: since(line.row.at, now),
                            })
                          }}
                        </template>
                      </td>

                      <!-- Actions -->
                      <td
                        class="whitespace-nowrap px-3 py-2.5 text-right align-middle"
                        @click.stop
                      >
                        <div class="inline-flex items-center gap-0.5">
                          <template v-if="line.row.kind === 'clip'">
                            <Button
                              v-if="line.row.status === 'done'"
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                              :title="$t('clips.render_queue.preview_clip')"
                              :aria-label="
                                $t('clips.render_queue.preview_clip')
                              "
                              @click="playClip(line.row.job)"
                            >
                              <Play class="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              v-if="CLIP_TERMINAL.has(line.row.job.status)"
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-muted-foreground"
                              :title="$t('clips.render_queue.requeue_clip')"
                              :aria-label="
                                $t('clips.render_queue.requeue_clip')
                              "
                              :loading="busy[line.row.job.id]"
                              @click="requeueOne(line.row.job)"
                            >
                              <RotateCcw class="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger as-child>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  class="size-7 text-muted-foreground"
                                  :aria-label="
                                    $t('pages.render_queue.ledger.more')
                                  "
                                >
                                  <Ellipsis class="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" class="w-60">
                                <DropdownMenuItem @select="openRow(line.row)">
                                  {{
                                    $t("pages.render_queue.ledger.open_details")
                                  }}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  v-if="line.row.job.match_map?.match?.id"
                                  as-child
                                >
                                  <NuxtLink
                                    :to="`/matches/${line.row.job.match_map.match.id}`"
                                  >
                                    {{ $t("clips.render_queue.open_match") }}
                                  </NuxtLink>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel
                                  class="truncate text-xs font-normal text-muted-foreground"
                                >
                                  {{ batchTitle(line.row.job) }}
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  v-if="
                                    (batchSummaries.get(
                                      line.row.job.match_map_id,
                                    )?.failed ?? 0) +
                                      (batchSummaries.get(
                                        line.row.job.match_map_id,
                                      )?.cancelled ?? 0) >
                                    0
                                  "
                                  @select="
                                    retryBatch(line.row.job.match_map_id, true)
                                  "
                                >
                                  {{ $t("clips.render_queue.retry_failed") }}
                                </DropdownMenuItem>
                                <template
                                  v-if="
                                    batchSummaries.get(
                                      line.row.job.match_map_id,
                                    )?.inFlight === 0
                                  "
                                >
                                  <DropdownMenuItem
                                    @select="
                                      retryBatch(
                                        line.row.job.match_map_id,
                                        false,
                                      )
                                    "
                                  >
                                    {{
                                      $t("clips.render_queue.retry_all_clips", {
                                        count:
                                          batchSummaries.get(
                                            line.row.job.match_map_id,
                                          )?.total ?? 0,
                                      })
                                    }}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    class="text-destructive focus:text-destructive"
                                    @select="
                                      clearBatch(line.row.job.match_map_id)
                                    "
                                  >
                                    {{ $t("clips.render_queue.clear_batch") }}
                                  </DropdownMenuItem>
                                </template>
                                <DropdownMenuItem
                                  v-else
                                  class="text-destructive focus:text-destructive"
                                  @select="
                                    askCancelBatch(line.row.job.match_map_id)
                                  "
                                >
                                  {{
                                    $t("pages.render_queue.ledger.cancel_batch")
                                  }}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </template>

                          <template
                            v-else-if="
                              !UTILITY_TERMINAL.has(line.row.render.status)
                            "
                          >
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-muted-foreground hover:text-destructive"
                              :title="$t('pages.utility.render_queue.cancel')"
                              :aria-label="
                                $t('pages.utility.render_queue.cancel')
                              "
                              :loading="busy[line.row.render.id]"
                              @click="cancelUtility(line.row.render)"
                            >
                              <X class="h-3.5 w-3.5" />
                            </Button>
                          </template>

                          <template v-else>
                            <Button
                              v-if="
                                line.row.render.status === 'done' &&
                                line.row.render.lineup?.preview_url
                              "
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-[hsl(var(--tac-amber))]"
                              :title="$t('pages.utility.preview.play')"
                              :aria-label="$t('pages.utility.preview.play')"
                              @click="playUtility(line.row.render)"
                            >
                              <Play class="h-3.5 w-3.5" />
                            </Button>
                            <span
                              v-if="canRerender(line.row.render)"
                              class="inline-flex"
                              :title="
                                lineupsRendering.has(
                                  line.row.render.utility_lineup_id,
                                )
                                  ? $t('pages.utility.render_queue.in_flight')
                                  : line.row.render.status === 'done'
                                    ? $t('pages.utility.render_queue.rerender')
                                    : $t('pages.utility.render_queue.retry')
                              "
                            >
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                class="size-7 text-muted-foreground"
                                :disabled="
                                  lineupsRendering.has(
                                    line.row.render.utility_lineup_id,
                                  )
                                "
                                :loading="busy[line.row.render.id]"
                                :aria-label="
                                  line.row.render.status === 'done'
                                    ? $t('pages.utility.render_queue.rerender')
                                    : $t('pages.utility.render_queue.retry')
                                "
                                @click="rerender(line.row.render)"
                              >
                                <RotateCw class="h-3.5 w-3.5" />
                              </Button>
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              class="size-7 text-muted-foreground hover:text-destructive"
                              :title="$t('pages.utility.render_queue.delete')"
                              :aria-label="
                                $t('pages.utility.render_queue.delete')
                              "
                              :loading="busy[`delete:${line.row.render.id}`]"
                              @click="removeRender(line.row.render)"
                            >
                              <Trash2 class="h-3.5 w-3.5" />
                            </Button>
                          </template>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

            <nav
              v-if="pageCount > 1"
              class="mt-3 flex flex-wrap items-center gap-1"
              :aria-label="$t('pages.render_queue.ledger.pages')"
            >
              <Button
                variant="outline"
                size="icon-sm"
                class="size-8"
                :disabled="page <= 1"
                :aria-label="$t('pagination.previous_page')"
                @click="goToPage(page - 1)"
              >
                <ChevronLeft class="h-4 w-4" />
              </Button>
              <template
                v-for="(n, index) in pageWindow(page, pageCount)"
                :key="index"
              >
                <span v-if="n === null" class="px-1 text-muted-foreground"
                  >…</span
                >
                <Button
                  v-else
                  variant="outline"
                  size="sm"
                  class="h-8 min-w-8 px-2 tabular-nums"
                  :class="
                    n === page
                      ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)]'
                      : 'text-muted-foreground'
                  "
                  :aria-current="n === page ? 'page' : undefined"
                  @click="goToPage(n)"
                >
                  {{ n }}
                </Button>
              </template>
              <Button
                variant="outline"
                size="icon-sm"
                class="size-8"
                :disabled="page >= pageCount"
                :aria-label="$t('pagination.next_page')"
                @click="goToPage(page + 1)"
              >
                <ChevronRight class="h-4 w-4" />
              </Button>
            </nav>
          </template>
        </div>
      </SlideSwap>
    </FadeSwap>

    <!-- The bulk bar rises when something is picked and says what a bulk
         action is up to while it loops. -->
    <Transition
      enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:transition-none"
      enter-from-class="translate-y-2 opacity-0"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-if="selected.size > 0 || bulk"
        class="sticky bottom-4 z-10 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2.5 rounded-lg border border-border bg-popover py-2 pl-3.5 pr-2 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.9)]"
      >
        <template v-if="bulk">
          <span class="text-sm tabular-nums">
            {{
              $t("pages.render_queue.ledger.bulk.progress", {
                label: bulk.label,
                done: bulk.done,
                total: bulk.total,
              })
            }}
          </span>
          <div class="h-1 w-24 overflow-hidden rounded-full bg-muted/60">
            <div
              class="h-full origin-left rounded-full bg-[hsl(var(--tac-amber))] motion-reduce:!transition-none"
              :style="{
                transform: `scaleX(${bulk.total ? bulk.done / bulk.total : 0})`,
                transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
              }"
            />
          </div>
        </template>
        <template v-else>
          <b class="text-sm font-semibold tabular-nums">
            {{
              $t(
                "pages.render_queue.ledger.bulk.selected",
                { count: selected.size },
                selected.size,
              )
            }}
          </b>
          <Button
            v-if="view === 'flight'"
            size="sm"
            variant="outline"
            class="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            @click="askCancelSelected"
          >
            {{ $t("pages.render_queue.ledger.bulk.cancel") }}
          </Button>
          <Button
            v-else
            size="sm"
            variant="outline"
            class="h-8"
            @click="requeueSelected"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            {{
              view === "failed"
                ? $t("pages.render_queue.ledger.bulk.retry")
                : $t("pages.render_queue.ledger.bulk.requeue")
            }}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            class="h-8 text-muted-foreground"
            @click="clearSelection"
          >
            {{ $t("pages.render_queue.ledger.bulk.clear") }}
          </Button>
        </template>
      </div>
    </Transition>

    <RenderQueueJobSheet
      v-model:open="sheetOpen"
      :row="sheetRow"
      :summary="sheetSummary"
      :batch-histories="sheetHistories"
      :status-label="sheetRow ? statusLabel(sheetRow) : ''"
      :stale="
        sheetRow?.kind === 'utility' &&
        !!utilityQueueRows.get(sheetRow.render.id)?.stale
      "
      :coverage-version="coverage?.version ?? null"
      :live="sheetRow?.kind === 'utility' && live.has(sheetRow.render.id)"
      :rendering="
        sheetRow?.kind === 'utility' &&
        lineupsRendering.has(sheetRow.render.utility_lineup_id)
      "
      :busy="
        sheetRow
          ? !!busy[
              sheetRow.kind === 'clip' ? sheetRow.job.id : sheetRow.render.id
            ]
          : false
      "
      @requeue="requeueOne"
      @cancel-batch="askCancelBatch"
      @cancel-utility="cancelUtility"
      @rerender="rerender"
      @remove="removeRender"
      @play-clip="playClip"
      @play-utility="playUtility"
    />

    <AlertDialog
      :open="confirm !== null"
      @update:open="(open) => !open && !confirmRunning && (confirm = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ confirmShown?.title }}</AlertDialogTitle>
          <AlertDialogDescription>{{
            confirmShown?.body
          }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="confirmRunning">
            {{ confirmShown?.keep ?? $t("common.cancel") }}
          </AlertDialogCancel>
          <!-- A plain Button: AlertDialogAction closes before the work ran. -->
          <Button
            variant="destructive"
            :loading="confirmRunning"
            @click="runConfirm"
          >
            {{ confirmShown?.action }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <UtilityPreviewDialog
      v-model:open="previewOpen"
      :render-id="previewRender?.id ?? null"
      :src="previewRender?.lineup?.preview_url ?? null"
      :poster="previewRender?.lineup?.preview_thumbnail_url ?? null"
      :title="previewRender?.lineup?.name ?? null"
      :map-name="previewRender?.map_name ?? null"
      :lineup-id="previewRender?.utility_lineup_id ?? null"
      :duration-ms="previewRender?.duration_ms ?? null"
      :can-manage="true"
    />

    <DeleteRenderDialog
      v-model="deleteOpen"
      :render-id="deleteTarget?.id ?? null"
      :title="deleteTarget?.lineup?.name ?? null"
    />
  </div>
</template>
