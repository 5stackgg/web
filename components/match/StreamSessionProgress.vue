<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  Check,
  CircleDashed,
  AlertCircle,
  Minus,
  FastForward,
} from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// Stepper for a streamer-pod session boot.
//
// Stages aren't serial — some parallelise, others (cached-creds
// login) don't always emit. `meta` controls how a non-fired stage
// renders when we're already past it:
//   • required    → mark ✓ silently (must have happened)
//   • conditional → "skipped" label (warm pod / stock map)
//   • implicit    → hide entirely (internal sub-step)
//
// `concurrentUntil` keeps a stage in the "current" (spinner) state
// after it's fired, until the named gating stage fires — covers
// background work (e.g. demo download) that runs in parallel with
// later stages and only blocks at a known checkpoint.
type StageMeta = "required" | "conditional" | "implicit";
type Stage = {
  key: string;
  label: string;
  meta?: StageMeta;
  concurrentUntil?: string;
};

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
    // Operator-only Skip-shaders affordance (gated by the parent).
    canSkip?: boolean;
    skipping?: boolean;
  }>(),
  {
    headerLabel: "Session boot",
    statusHistory: () => [],
    canSkip: false,
    skipping: false,
  },
);

const emit = defineEmits<{ (e: "skip"): void }>();

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

// Start of the current stage — its history `at` (kept stable across progress
// ticks by the API) so the live ticker measures the whole stage, not the gap
// since the last tick. Falls back to the row's lastStatusAt.
const currentStartedAt = computed(() => {
  const hist = props.statusHistory;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].status !== props.status) continue;
    return hist[i].at ?? props.lastStatusAt ?? null;
  }
  return props.lastStatusAt ?? null;
});

const elapsedOnCurrent = computed(() => {
  if (!currentStartedAt.value) return null;
  const ms = now.value - new Date(currentStartedAt.value).getTime();
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
  if (
    stage.concurrentUntil &&
    firedStatuses.value.has(stage.key) &&
    !firedStatuses.value.has(stage.concurrentUntil)
  ) {
    return "current";
  }
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

// Stages with rich progress get a dedicated bar+detail block instead of
// the cramped inline meta: the shader compile and the CS2 install (whose
// % belongs to alternating download/verify phases).
function detailActive(stageKey: string, index: number): boolean {
  return (
    (stageKey === "processing_shaders" || stageKey === "downloading_cs2") &&
    stateOf(index) === "current" &&
    props.status !== "errored" &&
    progressFor(stageKey) !== null
  );
}

// steamcmd's `validate` interleaves downloading and verifying, each with
// its own 0→100% — surface which phase the % belongs to so a reset reads
// as a phase change, not the bar going backwards.
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

// "(26824 / 731082)" → "26,824 / 731,082". Falls back to the raw
// string (sans wrapping parens) when it isn't an a/b count.
function formatShaderCount(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
  if (!m) return raw.replace(/^\(|\)$/g, "");
  const done = Number(m[1].replace(/,/g, "")).toLocaleString();
  const total = Number(m[2].replace(/,/g, "")).toLocaleString();
  return `${done} / ${total}`;
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
        class="text-xs transition-colors"
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
        <div class="flex items-center gap-2.5">
          <span
            class="w-4 h-4 inline-flex items-center justify-center shrink-0"
          >
            <Check v-if="stateOf(index) === 'done'" class="w-3.5 h-3.5" />
            <Spinner
              v-else-if="stateOf(index) === 'current' && status !== 'errored'"
              class="w-3.5 h-3.5"
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
          <span class="flex-1 min-w-0 truncate">{{ stage.label }}</span>

          <!-- Inline meta for every stage except the active shader compile,
               which moves its numbers into the progress block below so the
               label never has to wrap. -->
          <template v-if="!detailActive(stage.key, index)">
            <span
              v-if="
                stateOf(index) === 'current' && progressFor(stage.key) !== null
              "
              class="font-mono text-[0.65rem] tabular-nums opacity-80"
            >
              {{ progressFor(stage.key)!.percent.toFixed(1) }}%
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
          </template>

          <!-- Operator-only skip, pinned to the right of the shader row. -->
          <button
            v-if="
              canSkip &&
              stage.key === 'processing_shaders' &&
              stateOf(index) === 'current'
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
          v-if="detailActive(stage.key, index)"
          class="mt-1.5 ml-[1.625rem] flex flex-col gap-1"
        >
          <div
            class="h-1 w-full overflow-hidden rounded-full bg-muted-foreground/15"
          >
            <div
              class="h-full rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-500 ease-out"
              :style="{ width: `${progressFor(stage.key)!.percent}%` }"
            />
          </div>
          <div
            class="flex items-center justify-between gap-2 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
          >
            <span v-if="stage.key === 'downloading_cs2'" class="truncate">
              <span
                v-if="formatInstallPhase(progressFor(stage.key)!.stage)"
                class="text-foreground/80"
                >{{
                  formatInstallPhase(progressFor(stage.key)!.stage)
                }}
                · </span
              ><span class="text-foreground/80"
                >{{ progressFor(stage.key)!.percent.toFixed(1) }}%</span
              >
            </span>
            <span v-else class="truncate">
              <span class="text-foreground/80"
                >{{ progressFor(stage.key)!.percent.toFixed(1) }}%</span
              ><span v-if="progressFor(stage.key)!.stage" class="opacity-60">
                · {{ formatShaderCount(progressFor(stage.key)!.stage) }}</span
              >
            </span>
            <span v-if="elapsedOnCurrent" class="shrink-0 opacity-70">{{
              elapsedOnCurrent
            }}</span>
          </div>
        </div>
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
