<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, X, CircleDashed } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";

const { t } = useI18n();

// Own the wrapper so a passed-in class (.gpu-pod-boot) lands on the boot
// box only when there's something to show — and nothing (no empty padded
// box, no fallthrough warning) when the pod isn't booting.
defineOptions({ inheritAttrs: false });

// One or more status_history arrays (one per job/session). A render batch
// passes every job's history; a single live/demo/render pod passes one.
const props = defineProps<{
  histories: Array<Array<any> | null | undefined>;
}>();

// Shared CS2 boot flow, identical ordering/labels to the render queue.
// `meta` controls skipped-vs-done for stages that don't always fire.
const BOOT_STAGES = computed<
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
    key: "processing_shaders",
    label: t("live_stages.processing_shaders"),
    meta: "conditional",
  },
  {
    key: "connecting_to_game",
    label: t("live_stages.queuing_demo"),
    meta: "implicit",
  },
]);

const KNOWN = computed(() => new Set(BOOT_STAGES.value.map((s) => s.key)));

// Normalize a single history entry across both wire formats:
//  - render jobs:  { status:"booting", boot_stage:"stage:sub", boot_progress:0..1 }
//  - live/demo:    { status:"<stage>", progress:0..100, progress_stage:"sub" }
// `at` is the stage's first-seen time — the API keeps it stable across
// within-stage progress ticks, so it doubles as the stage start.
function normEntry(e: any): {
  stage: string;
  sub: string | null;
  progress: number | null;
  at: number;
} | null {
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

// 1s ticker so the current stage's elapsed time advances live.
const now = ref(Date.now());
const ticker = setInterval(() => {
  now.value = Date.now();
}, 1000);
onBeforeUnmount(() => clearInterval(ticker));

type BootInfo = {
  stage: string;
  stageSub: string | null;
  progress: number | null;
  firedStages: Set<string>;
  stageFirstAt: Map<string, number>;
};

const bootInfo = computed<BootInfo | null>(() => {
  const firedStages = new Set<string>();
  const stageFirstAt = new Map<string, number>();
  let latest: {
    stage: string;
    sub: string | null;
    progress: number | null;
    at: number;
  } | null = null;

  for (const history of props.histories) {
    if (!Array.isArray(history)) continue;
    for (const raw of history) {
      const e = normEntry(raw);
      if (!e || !KNOWN.value.has(e.stage)) continue;
      firedStages.add(e.stage);
      const prev = stageFirstAt.get(e.stage);
      // Stage start = earliest `at`; current stage = latest `at`.
      if (prev === undefined || e.at < prev) stageFirstAt.set(e.stage, e.at);
      if (!latest || e.at > latest.at) latest = e;
    }
  }

  if (!latest) return null;
  return {
    stage: latest.stage,
    stageSub: latest.sub,
    progress: latest.progress,
    firedStages,
    stageFirstAt,
  };
});

function stageStateFor(stage: {
  key: string;
  meta: "required" | "conditional" | "implicit";
  concurrentUntil?: string;
}): "done" | "current" | "skipped" | "pending" {
  const info = bootInfo.value;
  if (!info) return "pending";
  if (info.stage === stage.key) return "current";
  if (
    stage.concurrentUntil &&
    info.firedStages.has(stage.key) &&
    !info.firedStages.has(stage.concurrentUntil)
  ) {
    return "current";
  }
  if (info.firedStages.has(stage.key)) return "done";
  const order = BOOT_STAGES.value.findIndex((s) => s.key === stage.key);
  const currOrder = BOOT_STAGES.value.findIndex((s) => s.key === info.stage);
  if (order >= 0 && currOrder >= 0 && order < currOrder) {
    return stage.meta === "conditional" ? "skipped" : "done";
  }
  return "pending";
}

const visibleStages = computed(() => {
  const info = bootInfo.value;
  if (!info) return [];
  return BOOT_STAGES.value.filter((s) => {
    if (s.meta !== "implicit") return true;
    return info.firedStages.has(s.key) || info.stage === s.key;
  });
});

function bootFmt(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function stageDuration(stageKey: string): string {
  const info = bootInfo.value;
  if (!info) return "";
  const start = info.stageFirstAt.get(stageKey);
  if (start === undefined) return "";
  const order = BOOT_STAGES.value;
  const idx = order.findIndex((s) => s.key === stageKey);
  if (idx < 0) return "";
  for (let i = idx + 1; i < order.length; i++) {
    const at = info.stageFirstAt.get(order[i].key);
    if (at !== undefined) return bootFmt(at - start);
  }
  return "";
}

function stageElapsed(stageKey: string): string {
  const info = bootInfo.value;
  if (!info) return "";
  const start = info.stageFirstAt.get(stageKey);
  if (start === undefined) return "";
  return bootFmt(now.value - start);
}
</script>

<template>
  <div v-if="bootInfo" v-bind="$attrs">
    <ul class="flex flex-col gap-1">
    <li
      v-for="stage in visibleStages"
      :key="stage.key"
      class="flex items-center gap-2.5 text-xs"
      :class="{
        'text-muted-foreground/60': stageStateFor(stage) === 'pending',
        'text-muted-foreground/40 line-through decoration-muted-foreground/30':
          stageStateFor(stage) === 'skipped',
        'text-foreground': stageStateFor(stage) === 'done',
        'text-primary font-medium': stageStateFor(stage) === 'current',
      }"
    >
      <span class="w-4 h-4 inline-flex items-center justify-center shrink-0">
        <Check v-if="stageStateFor(stage) === 'done'" class="w-3.5 h-3.5" />
        <Spinner
          v-else-if="stageStateFor(stage) === 'current'"
          class="w-3.5 h-3.5"
        />
        <X
          v-else-if="stageStateFor(stage) === 'skipped'"
          class="w-3.5 h-3.5 opacity-50"
        />
        <CircleDashed v-else class="w-3.5 h-3.5 opacity-50" />
      </span>
      <span class="flex-1">{{ stage.label }}</span>
      <template v-if="stageStateFor(stage) === 'current'">
        <span
          v-if="bootInfo.stageSub"
          class="font-mono text-[0.6rem] tabular-nums opacity-60"
        >
          {{ bootInfo.stageSub }}
        </span>
        <span
          v-if="bootInfo.progress !== null"
          class="font-mono text-[0.6rem] tabular-nums opacity-80"
        >
          {{ Math.round(bootInfo.progress * 100) }}%
        </span>
        <span
          v-if="stageElapsed(stage.key)"
          class="font-mono text-[0.6rem] tabular-nums opacity-70"
        >
          {{ stageElapsed(stage.key) }}
        </span>
      </template>
      <span
        v-else-if="stageStateFor(stage) === 'done' && stageDuration(stage.key)"
        class="font-mono text-[0.6rem] tabular-nums opacity-60"
      >
        {{ stageDuration(stage.key) }}
      </span>
      <span
        v-else-if="stageStateFor(stage) === 'skipped'"
        class="font-mono text-[0.6rem] uppercase tracking-wider opacity-50"
      >
        skipped
      </span>
    </li>
    </ul>
  </div>
</template>
