<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, CircleDashed, AlertCircle, Minus, FastForward } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import type { BootMode } from "~/composables/useBootStages";
import { useBootProgress } from "~/composables/useBootProgress";

const { t } = useI18n();

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

const { stages, bootInfo, isErrored, stageStateFor, visibleStages, pct } =
  useBootProgress(() => ({
    mode: props.mode,
    histories: props.histories,
    status: props.status,
    progress: props.progress,
    progressStage: props.progressStage,
    lastStatusAt: props.lastStatusAt,
  }));

// 1s ticker so the current stage's elapsed time advances live.
const now = ref(Date.now());
const ticker = setInterval(() => {
  now.value = Date.now();
}, 1000);
onBeforeUnmount(() => clearInterval(ticker));

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
            <!-- `pct` belongs to bootInfo.current, so it must not bleed onto a
                 concurrent row that merely renders as "current" too. -->
            <span
              v-if="bootInfo.current === stage.key && pct !== null"
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
            class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-card/60 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-50 cursor-pointer"
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
