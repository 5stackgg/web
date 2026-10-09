import { computed } from "vue";
import {
  useBootStages,
  type BootMode,
  type BootStage,
} from "~/composables/useBootStages";

export type BootProgressInput = {
  mode: BootMode;
  // One status_history array per job/session. A live/demo/bake pod passes
  // a single `[history]`; a render batch passes one array per job.
  histories?: Array<Array<any> | null | undefined>;
  // Current pushed state — keeps the stepper fresh before the history
  // fan-out catches up (and carries bake's live progress fields).
  status?: string | null;
  progress?: number | null;
  progressStage?: string | null;
  lastStatusAt?: string | null;
};

export type BootInfo = {
  current: string | null;
  currentSub: string | null;
  currentProgress: number | null;
  firedStages: Set<string>;
  stageFirstAt: Map<string, number>;
};

export type BootStageState = "done" | "current" | "skipped" | "pending";

type NormEntry = {
  stage: string;
  sub: string | null;
  progress: number | null;
  at: number;
};

// Normalize a single history entry across both wire formats:
//  - render jobs:  { status:"booting", boot_stage:"stage:sub", boot_progress:0..1 }
//  - live/demo/bake: { status:"<stage>", progress:0..100, progress_stage:"sub" }
// `at` is the stage's first-seen time — the API keeps it stable across
// within-stage progress ticks, so it doubles as the stage start.
function normEntry(e: any): NormEntry | null {
  if (!e) return null;
  const at = Date.parse(e.at);
  if (!Number.isFinite(at)) return null;
  if (e.status === "booting" && typeof e.boot_stage === "string") {
    const [stage, sub = null] = e.boot_stage.split(":");
    return {
      stage,
      sub: sub && sub.length > 0 ? sub : null,
      progress: typeof e.boot_progress === "number" ? e.boot_progress : null,
      at,
    };
  }
  if (typeof e.status === "string") {
    return {
      stage: e.status,
      sub:
        typeof e.progress_stage === "string" && e.progress_stage.length > 0
          ? e.progress_stage
          : null,
      progress: typeof e.progress === "number" ? e.progress / 100 : null,
      at,
    };
  }
  return null;
}

// Where a streamer pod is in its boot, derived from its status history.
// Shared by the full stepper (BootSequence) and the compact step bar on
// the stream caption, so both agree on the current stage.
export function useBootProgress(input: () => BootProgressInput) {
  const { stagesFor } = useBootStages();

  const stages = computed<BootStage[]>(() =>
    stagesFor(input().mode).filter((stage) => stage.meta !== "wait"),
  );
  const KNOWN = computed(() => new Set(stages.value.map((s) => s.key)));
  // Markers are tracked (they close concurrentUntil gates) but never shown and
  // never chosen as the current stage — they're checkpoints, not steps.
  const MARKERS = computed(
    () =>
      new Set(
        stages.value.filter((s) => s.meta === "marker").map((s) => s.key),
      ),
  );
  const orderOf = (key: string) =>
    stages.value.findIndex((s) => s.key === key);

  const isErrored = computed(() => input().status === "errored");

  const bootInfo = computed<BootInfo | null>(() => {
    const { histories = [], status, progress, progressStage, lastStatusAt } =
      input();
    const firedStages = new Set<string>();
    const stageFirstAt = new Map<string, number>();
    let latest: NormEntry | null = null;

    for (const history of histories) {
      if (!Array.isArray(history)) continue;
      for (const raw of history) {
        const e = normEntry(raw);
        if (!e || !KNOWN.value.has(e.stage)) continue;
        firedStages.add(e.stage);
        const prev = stageFirstAt.get(e.stage);
        if (prev === undefined || e.at < prev) stageFirstAt.set(e.stage, e.at);
        if (MARKERS.value.has(e.stage)) continue;
        if (!latest || e.at > latest.at) latest = e;
      }
    }

    // Fold the freshly pushed status into the picture so the current stage
    // never lags the history fan-out (and so bake's live progress shows).
    const pushed =
      status && KNOWN.value.has(status) && !MARKERS.value.has(status)
        ? status
        : null;
    if (pushed) {
      firedStages.add(pushed);
      if (!stageFirstAt.has(pushed) && lastStatusAt) {
        const at = Date.parse(lastStatusAt);
        if (Number.isFinite(at)) stageFirstAt.set(pushed, at);
      }
    }

    if (!latest && !pushed && !isErrored.value) return null;

    // Current = furthest-along of the history's latest and the pushed status.
    let current: string | null = latest?.stage ?? null;
    if (pushed && (current === null || orderOf(pushed) >= orderOf(current))) {
      current = pushed;
    }

    // On error, point the spinner/marker at the last stage that actually fired.
    if (isErrored.value) {
      let last: string | null = null;
      let lastOrder = -1;
      for (const key of firedStages) {
        if (MARKERS.value.has(key)) continue;
        const o = orderOf(key);
        if (o > lastOrder) {
          lastOrder = o;
          last = key;
        }
      }
      current = last;
    }

    // Progress/sub belong to the current stage: prefer history when it owns the
    // current stage, else fall back to the pushed fields (bake).
    let currentSub: string | null = null;
    let currentProgress: number | null = null;
    if (current && latest && latest.stage === current) {
      currentSub = latest.sub;
      currentProgress = latest.progress;
    }
    if (current && pushed === current) {
      if (typeof progress === "number" && Number.isFinite(progress)) {
        currentProgress = progress / 100;
      }
      if (progressStage) currentSub = progressStage;
    }

    return { current, currentSub, currentProgress, firedStages, stageFirstAt };
  });

  function stageStateFor(stage: BootStage): BootStageState {
    const info = bootInfo.value;
    if (!info) return "pending";
    if (info.current === stage.key) return "current";
    if (
      stage.concurrentUntil &&
      info.firedStages.has(stage.key) &&
      !stage.concurrentUntil.some((gate) => info.firedStages.has(gate))
    ) {
      return "current";
    }
    if (info.firedStages.has(stage.key)) return "done";
    const order = orderOf(stage.key);
    const currOrder = info.current ? orderOf(info.current) : -1;
    if (order >= 0 && currOrder >= 0 && order < currOrder) {
      return stage.meta === "conditional" ? "skipped" : "done";
    }
    return "pending";
  }

  const visibleStages = computed(() => {
    const info = bootInfo.value;
    if (!info) return [];
    return stages.value.filter((s) => {
      if (s.meta === "marker") return false;
      if (s.meta !== "implicit") return true;
      return info.firedStages.has(s.key) || info.current === s.key;
    });
  });

  const currentStage = computed<BootStage | null>(() => {
    const key = bootInfo.value?.current;
    return key ? (stages.value.find((s) => s.key === key) ?? null) : null;
  });

  // 0-based position of the current stage among the visible steps.
  const currentIndex = computed(() => {
    const key = bootInfo.value?.current;
    return key ? visibleStages.value.findIndex((s) => s.key === key) : -1;
  });

  const pct = computed(() => {
    const p = bootInfo.value?.currentProgress;
    return typeof p === "number" ? Math.max(0, Math.min(100, p * 100)) : null;
  });

  return {
    stages,
    bootInfo,
    isErrored,
    stageStateFor,
    visibleStages,
    currentStage,
    currentIndex,
    pct,
  };
}
