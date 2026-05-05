<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  Check,
  CircleDashed,
  Loader2,
  AlertCircle,
  Minus,
} from "lucide-vue-next";

// Step-by-step boot status for a streamer pod session. The pod's
// status-reporter writes the current stage to the row (match_streams
// for live, match_demo_sessions for demo); the parent subscribes and
// feeds us the row.
//
// Stage emission isn't strictly serial — some run in parallel and some
// internal sub-steps (e.g. logging in with cached creds) don't always
// emit. To avoid showing misleading "skipped" labels on those, each
// stage is tagged with `meta`:
//
//   • required    → if we're past it without seeing it fire, the
//                    pipeline must have done it anyway (parallelized
//                    with another stage, or status push dropped). Mark
//                    ✓ silently — operators care about session health,
//                    not whether each event was literally emitted.
//   • conditional → meaningful skip; the pod genuinely didn't run this
//                    on this boot (warm pod skips downloading_cs2,
//                    stock map skips downloading_workshop_map). Render
//                    with a "skipped" label so the operator sees what
//                    was avoided.
//   • implicit    → internal sub-step. Hide entirely when not fired —
//                    surfacing "logging in: skipped" reads as an
//                    error to operators when in reality the step ran
//                    inside another stage.

type StageMeta = "required" | "conditional" | "implicit";
type Stage = { key: string; label: string; meta?: StageMeta };

const props = withDefaults(
  defineProps<{
    status: string;
    errorMessage?: string | null;
    // ISO timestamp of when the row last changed status. Used to
    // render a "12s" ticker on the current stage; helps the operator
    // decide whether a stage has stalled or is just slow.
    lastStatusAt?: string | null;
    stages: Stage[];
    headerLabel?: string;
    // Each entry the streamer pod reported in chronological order.
    // The row default is `[]` so this is always present after the
    // 1778100000000 migration; older rows pre-migration just look
    // like a stepper with no completed-stages indicator (graceful).
    statusHistory?: Array<{ status: string; at: string }>;
  }>(),
  {
    headerLabel: "Session boot",
    statusHistory: () => [],
  },
);

const firedStatuses = computed(() => {
  const set = new Set<string>(props.statusHistory.map((h) => h.status));
  // The current `status` prop is the most recent push — append in
  // case it hasn't landed in history yet (race between the row
  // update fan-out and the subscription delivery).
  if (props.status) set.add(props.status);
  return set;
});

const currentIndex = computed(() => {
  return props.stages.findIndex((s) => s.key === props.status);
});

// Tick every second for the elapsed counter. We rely on a ref'd Date
// value so reactivity fires; setInterval doesn't auto-trigger Vue
// without something reactive to read.
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
    // We're past this stage without seeing it fire. How we render
    // depends on the stage's meta tag — see top-of-file rationale.
    const meta = stage.meta ?? "required";
    if (meta === "conditional") return "skipped";
    // required + implicit both default to "done" here; implicit gets
    // filtered out of the visible list so this state never renders
    // for it.
    return "done";
  }
  return "pending";
}

// Filtered view for the template: implicit stages are dropped from
// the rendered list when they didn't fire and aren't current. Other
// stages always render. We pair each visible stage with its original
// index so stateOf() / durationFor() keep working off the source list.
const visibleStages = computed(() =>
  props.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage, index }) => {
      if ((stage.meta ?? "required") !== "implicit") return true;
      // Implicit: only render when it actually fired or is current.
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

// Duration of a completed stage = (next history entry's `at`) - (this
// stage's `at`). Looking up the NEXT entry — not the next stage in
// our predefined list — is what matters: the pipeline may have
// jumped over a stage we don't know about, and the wall time we want
// is "from this stage's emit to whatever came after it".
function durationFor(stageKey: string): string {
  const history = props.statusHistory;
  const idx = history.findIndex((h) => h.status === stageKey);
  if (idx < 0) return "";
  const start = new Date(history[idx].at).getTime();
  // If a later entry exists, use its time; otherwise this is the
  // most-recent emit and it's still "ticking" — caller renders the
  // live elapsedOnCurrent for that one instead.
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
