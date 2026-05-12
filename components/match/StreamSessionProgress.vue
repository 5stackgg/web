<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  Check,
  CircleDashed,
  Loader2,
  AlertCircle,
  Minus,
} from "lucide-vue-next";

// Stepper for a streamer-pod session boot.
//
// Stages aren't serial — some parallelise, others (cached-creds
// login) don't always emit. `meta` controls how a non-fired stage
// renders when we're already past it:
//   • required    → mark ✓ silently (must have happened)
//   • conditional → "skipped" label (warm pod / stock map)
//   • implicit    → hide entirely (internal sub-step)
type StageMeta = "required" | "conditional" | "implicit";
type Stage = { key: string; label: string; meta?: StageMeta };

const props = withDefaults(
  defineProps<{
    status: string;
    errorMessage?: string | null;
    // Drives the live "12s" ticker on the current stage.
    lastStatusAt?: string | null;
    stages: Stage[];
    headerLabel?: string;
    statusHistory?: Array<{
      status: string;
      at: string;
      progress?: number;
      progress_stage?: string;
    }>;
  }>(),
  {
    headerLabel: "Session boot",
    statusHistory: () => [],
  },
);

const firedStatuses = computed(() => {
  const set = new Set<string>(props.statusHistory.map((h) => h.status));
  // status push may race ahead of history fan-out.
  if (props.status) set.add(props.status);
  return set;
});

const currentIndex = computed(() => {
  return props.stages.findIndex((s) => s.key === props.status);
});

const now = ref(Date.now());
const ticker = setInterval(() => {
  now.value = Date.now();
}, 1000);
onBeforeUnmount(() => clearInterval(ticker));

const elapsedOnCurrent = computed(() => {
  if (!props.lastStatusAt) return null;
  const ms = now.value - new Date(props.lastStatusAt).getTime();
  if (ms < 0 || !Number.isFinite(ms)) return null;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
});

type StageState = "done" | "current" | "skipped" | "pending";
function stateOf(index: number): StageState {
  const stage = props.stages[index];
  if (!stage) return "pending";
  if (index === currentIndex.value) return "current";
  if (firedStatuses.value.has(stage.key)) return "done";
  if (currentIndex.value < 0) return "pending";
  if (index < currentIndex.value) {
    const meta = stage.meta ?? "required";
    if (meta === "conditional") return "skipped";
    return "done";
  }
  return "pending";
}

const visibleStages = computed(() =>
  props.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage, index }) => {
      if ((stage.meta ?? "required") !== "implicit") return true;
      return firedStatuses.value.has(stage.key) || index === currentIndex.value;
    }),
);

function fmt(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// Latest progress recorded against a stage key. Null when missing.
function progressFor(stageKey: string): {
  percent: number;
  stage: string | null;
} | null {
  const history = props.statusHistory;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status !== stageKey) continue;
    const p = history[i].progress;
    if (typeof p !== "number" || !Number.isFinite(p)) return null;
    return {
      percent: Math.max(0, Math.min(100, p)),
      stage: history[i].progress_stage ?? null,
    };
  }
  return null;
}

// Look up the next history entry — the pipeline may have skipped
// stages we don't know about; we want emit-to-emit wall time.
function durationFor(stageKey: string): string {
  const history = props.statusHistory;
  const idx = history.findIndex((h) => h.status === stageKey);
  if (idx < 0) return "";
  const start = new Date(history[idx].at).getTime();
  const next = history[idx + 1];
  if (!next) return "";
  return fmt(new Date(next.at).getTime() - start);
}
</script>

<template>
  <div
    class="w-full max-w-md flex flex-col gap-1.5 text-left bg-card/40 border border-border/40 rounded-md p-4"
  >
    <p
      class="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground mb-1"
    >
      {{ headerLabel }}
    </p>
    <ul class="flex flex-col gap-1.5">
      <li
        v-for="{ stage, index } in visibleStages"
        :key="stage.key"
        class="flex items-center gap-2.5 text-xs transition-colors"
        :class="{
          'text-muted-foreground/60': stateOf(index) === 'pending',
          'text-muted-foreground/40 line-through decoration-muted-foreground/30':
            stateOf(index) === 'skipped',
          'text-foreground': stateOf(index) === 'done',
          'text-[hsl(var(--tac-amber))] font-medium':
            stateOf(index) === 'current' && status !== 'errored',
          'text-destructive font-medium':
            stateOf(index) === 'current' && status === 'errored',
        }"
      >
        <span class="w-4 h-4 inline-flex items-center justify-center shrink-0">
          <Check v-if="stateOf(index) === 'done'" class="w-3.5 h-3.5" />
          <Loader2
            v-else-if="stateOf(index) === 'current' && status !== 'errored'"
            class="w-3.5 h-3.5 animate-spin"
          />
          <AlertCircle
            v-else-if="stateOf(index) === 'current' && status === 'errored'"
            class="w-3.5 h-3.5"
          />
          <Minus
            v-else-if="stateOf(index) === 'skipped'"
            class="w-3.5 h-3.5 opacity-50"
          />
          <CircleDashed v-else class="w-3.5 h-3.5 opacity-50" />
        </span>
        <span class="flex-1">{{ stage.label }}</span>
        <span
          v-if="stateOf(index) === 'current' && progressFor(stage.key) !== null"
          class="font-mono text-[0.65rem] tabular-nums opacity-80"
        >
          {{ progressFor(stage.key)!.percent.toFixed(1) }}%<span
            v-if="progressFor(stage.key)!.stage"
            class="opacity-60"
          >
            ({{ progressFor(stage.key)!.stage }})</span
          >
        </span>
        <span
          v-if="stateOf(index) === 'current' && elapsedOnCurrent"
          class="font-mono text-[0.65rem] tabular-nums opacity-70"
        >
          {{ elapsedOnCurrent }}
        </span>
        <span
          v-else-if="stateOf(index) === 'done' && durationFor(stage.key)"
          class="font-mono text-[0.65rem] tabular-nums opacity-60"
        >
          {{ durationFor(stage.key) }}
        </span>
        <span
          v-else-if="stateOf(index) === 'skipped'"
          class="font-mono text-[0.6rem] uppercase tracking-wider opacity-50"
        >
          skipped
        </span>
      </li>
    </ul>

    <p
      v-if="status === 'errored' && errorMessage"
      class="mt-2 text-xs text-destructive font-mono whitespace-pre-wrap break-words"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
