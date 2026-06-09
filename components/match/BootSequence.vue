<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, CircleDashed, AlertCircle, Minus, FastForward } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { useBootStages, type BootMode, type BootStage } from "~/composables/useBootStages";

const { t } = useI18n();
const { stagesFor } = useBootStages();

// Own the wrapper so a passed-in class lands on the box only when there is
// something to show — nothing renders (no empty padded box) when not booting.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
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
    errorMessage?: string | null;
    // Header row; hidden entirely when empty (gpu-nodes omits it).
    headerLabel?: string | null;
    // Bordered card chrome (stream deck / players); off when the parent
    // supplies its own panel (gpu-nodes).
    card?: boolean;
    // Operator-only Skip-shaders affordance (gated by the parent).
    canSkip?: boolean;
    skipping?: boolean;
  }>(),
  {
    histories: () => [],
    card: true,
    canSkip: false,
    skipping: false,
  },
);

const emit = defineEmits<{ (e: "skip"): void }>();

const stages = computed<BootStage[]>(() => stagesFor(props.mode));
const KNOWN = computed(() => new Set(stages.value.map((s) => s.key)));
const orderOf = (key: string) => stages.value.findIndex((s) => s.key === key);

const isErrored = computed(() => props.status === "errored");

// Normalize a single history entry across both wire formats:
//  - render jobs:  { status:"booting", boot_stage:"stage:sub", boot_progress:0..1 }
//  - live/demo/bake: { status:"<stage>", progress:0..100, progress_stage:"sub" }
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
  current: string | null;
  currentSub: string | null;
  currentProgress: number | null;
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
      if (prev === undefined || e.at < prev) stageFirstAt.set(e.stage, e.at);
      if (!latest || e.at > latest.at) latest = e;
    }
  }

  // Fold the freshly pushed status into the picture so the current stage
  // never lags the history fan-out (and so bake's live progress shows).
  const pushed =
    props.status && KNOWN.value.has(props.status) ? props.status : null;
  if (pushed) {
    firedStages.add(pushed);
    if (!stageFirstAt.has(pushed) && props.lastStatusAt) {
      const at = Date.parse(props.lastStatusAt);
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
    if (
      typeof props.progress === "number" &&
      Number.isFinite(props.progress)
    ) {
      currentProgress = props.progress / 100;
    }
    if (props.progressStage) currentSub = props.progressStage;
  }

  return { current, currentSub, currentProgress, firedStages, stageFirstAt };
});

type StageState = "done" | "current" | "skipped" | "pending";
function stageStateFor(stage: BootStage): StageState {
  const info = bootInfo.value;
  if (!info) return "pending";
  if (info.current === stage.key) return "current";
  if (
    stage.concurrentUntil &&
    info.firedStages.has(stage.key) &&
    !info.firedStages.has(stage.concurrentUntil)
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
    if (s.meta !== "implicit") return true;
    return info.firedStages.has(s.key) || info.current === s.key;
  });
});

function fmt(ms: number): string {
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
  const order = stages.value;
  const idx = order.findIndex((s) => s.key === stageKey);
  if (idx < 0) return "";
  for (let i = idx + 1; i < order.length; i++) {
    const at = info.stageFirstAt.get(order[i].key);
    if (at !== undefined) return fmt(at - start);
  }
  return "";
}

function stageElapsed(stageKey: string): string {
  const info = bootInfo.value;
  if (!info) return "";
  const start = info.stageFirstAt.get(stageKey);
  if (start === undefined) return "";
  return fmt(now.value - start);
}

// Stages with rich progress get a dedicated bar+detail block: the shader
// compile and the CS2 install (whose % belongs to alternating phases).
function detailActive(stageKey: string): boolean {
  const info = bootInfo.value;
  return (
    (stageKey === "processing_shaders" || stageKey === "downloading_cs2") &&
    info?.current === stageKey &&
    !isErrored.value &&
    info?.currentProgress !== null &&
    info?.currentProgress !== undefined
  );
}

// steamcmd's `validate` interleaves downloading and verifying, each with its
// own 0→100% — surface which phase the % belongs to so a reset reads as a
// phase change, not the bar going backwards.
function formatInstallPhase(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (s.includes("verif") || s.includes("valid"))
    return t("live_stages.install_phase.verifying");
  if (s.includes("commit") || s.includes("final"))
    return t("live_stages.install_phase.finalizing");
  if (s.includes("download") || s.includes("alloc"))
    return t("live_stages.install_phase.downloading");
  return raw;
}

// "(26824 / 731082)" → "26,824 / 731,082". Falls back to the raw string
// (sans wrapping parens) when it isn't an a/b count.
function formatShaderCount(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
  if (!m) return raw.replace(/^\(|\)$/g, "");
  const done = Number(m[1].replace(/,/g, "")).toLocaleString();
  const total = Number(m[2].replace(/,/g, "")).toLocaleString();
  return `${done} / ${total}`;
}

const pct = computed(() => {
  const p = bootInfo.value?.currentProgress;
  return typeof p === "number" ? Math.max(0, Math.min(100, p * 100)) : null;
});
</script>

<template>
  <div
    v-if="bootInfo"
    v-bind="$attrs"
    :class="
      card
        ? 'w-full max-w-md flex flex-col gap-1.5 text-left bg-card/40 border border-border/40 rounded-md p-4'
        : ''
    "
  >
    <p
      v-if="headerLabel"
      class="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground mb-1"
    >
      {{ headerLabel }}
    </p>
    <ul class="flex flex-col gap-1.5">
      <li
        v-for="stage in visibleStages"
        :key="stage.key"
        class="text-xs transition-colors"
        :class="{
          'text-muted-foreground/60': stageStateFor(stage) === 'pending',
          'text-muted-foreground/40 line-through decoration-muted-foreground/30':
            stageStateFor(stage) === 'skipped',
          'text-foreground': stageStateFor(stage) === 'done',
          'text-[hsl(var(--tac-amber))] font-medium':
            stageStateFor(stage) === 'current' && !isErrored,
          'text-destructive font-medium':
            stageStateFor(stage) === 'current' && isErrored,
        }"
      >
        <div class="flex items-center gap-2.5">
          <span class="w-4 h-4 inline-flex items-center justify-center shrink-0">
            <Check v-if="stageStateFor(stage) === 'done'" class="w-3.5 h-3.5" />
            <Spinner
              v-else-if="stageStateFor(stage) === 'current' && !isErrored"
              class="w-3.5 h-3.5"
            />
            <AlertCircle
              v-else-if="stageStateFor(stage) === 'current' && isErrored"
              class="w-3.5 h-3.5"
            />
            <Minus
              v-else-if="stageStateFor(stage) === 'skipped'"
              class="w-3.5 h-3.5 opacity-50"
            />
            <CircleDashed v-else class="w-3.5 h-3.5 opacity-50" />
          </span>
          <span class="flex-1 min-w-0 truncate">{{ stage.label }}</span>

          <!-- Inline meta for every stage except the active rich-progress
               stage, which moves its numbers into the block below. -->
          <template v-if="!detailActive(stage.key)">
            <span
              v-if="stageStateFor(stage) === 'current' && pct !== null"
              class="font-mono text-[0.65rem] tabular-nums opacity-80"
            >
              {{ pct.toFixed(1) }}%
            </span>
            <span
              v-if="stageStateFor(stage) === 'current' && stageElapsed(stage.key)"
              class="font-mono text-[0.65rem] tabular-nums opacity-70"
            >
              {{ stageElapsed(stage.key) }}
            </span>
            <span
              v-else-if="
                stageStateFor(stage) === 'done' && stageDuration(stage.key)
              "
              class="font-mono text-[0.65rem] tabular-nums opacity-60"
            >
              {{ stageDuration(stage.key) }}
            </span>
            <span
              v-else-if="stageStateFor(stage) === 'skipped'"
              class="font-mono text-[0.6rem] uppercase tracking-wider opacity-50"
            >
              skipped
            </span>
          </template>

          <!-- Operator-only skip, pinned to the right of the shader row. -->
          <button
            v-if="
              canSkip &&
              stage.key === 'processing_shaders' &&
              stageStateFor(stage) === 'current'
            "
            type="button"
            :disabled="skipping"
            class="ml-1 inline-flex shrink-0 items-center gap-1 rounded border border-border/60 bg-card/60 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-50 cursor-pointer"
            @click.stop="emit('skip')"
          >
            <Spinner v-if="skipping" class="w-2.5 h-2.5" />
            <FastForward v-else class="w-2.5 h-2.5" />
            {{ t("live_stages.skip_shaders") }}
          </button>
        </div>

        <!-- Rich detail (shader compile / CS2 install): thin progress bar +
             phase|count and elapsed, aligned under the label. -->
        <div
          v-if="detailActive(stage.key)"
          class="mt-1.5 ml-[1.625rem] flex flex-col gap-1"
        >
          <div
            class="h-1 w-full overflow-hidden rounded-full bg-muted-foreground/15"
          >
            <div
              class="h-full rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-500 ease-out"
              :style="{ width: `${pct}%` }"
            />
          </div>
          <div
            class="flex items-center justify-between gap-2 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
          >
            <span v-if="stage.key === 'downloading_cs2'" class="truncate">
              <span
                v-if="formatInstallPhase(bootInfo.currentSub)"
                class="text-foreground/80"
                >{{ formatInstallPhase(bootInfo.currentSub) }} · </span
              ><span class="text-foreground/80">{{ pct?.toFixed(1) }}%</span>
            </span>
            <span v-else class="truncate">
              <span class="text-foreground/80">{{ pct?.toFixed(1) }}%</span
              ><span v-if="bootInfo.currentSub" class="opacity-60">
                · {{ formatShaderCount(bootInfo.currentSub) }}</span
              >
            </span>
            <span
              v-if="stageElapsed(stage.key)"
              class="shrink-0 opacity-70"
              >{{ stageElapsed(stage.key) }}</span
            >
          </div>
        </div>
      </li>
    </ul>

    <p
      v-if="isErrored && errorMessage"
      class="mt-2 text-xs text-destructive font-mono whitespace-pre-wrap break-words"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
