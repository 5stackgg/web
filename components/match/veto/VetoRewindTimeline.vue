<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Timer } from "lucide-vue-next";
import { e_sides_enum } from "~/generated/zeus";
import type { VetoStep } from "~/utilities/rewind";
import { faqHotClasses } from "~/utilities/faqClasses";
import mapLabel from "~/utilities/mapLabel";

const props = defineProps<{
  steps: VetoStep[];
  done: number;
  lineup1: string;
  lineup2: string;
  clock?: number;
  bestOf: number;
  rewinding?: boolean;
  target?: number | null;
  canRewind?: boolean;
  hot?: "step";
}>();

const emit = defineEmits<{
  "update:target": [number];
}>();

const { t } = useI18n();

const current = computed(() => props.steps[props.done] ?? null);

function teamName(lineup: 1 | 2 | null) {
  if (lineup === 1) return props.lineup1;
  if (lineup === 2) return props.lineup2;
  return "";
}

function teamClass(lineup: 1 | 2 | null) {
  if (lineup === 1) return "text-[hsl(var(--tac-amber))]";
  if (lineup === 2) return "text-[hsl(var(--tac-blue))]";
  return "text-muted-foreground";
}

function typeLabel(step: VetoStep) {
  switch (step.type) {
    case "Ban":
      return t("match.veto_rewind.ban");
    case "Pick":
      return t("match.veto_rewind.pick");
    case "Side":
      return t("match.veto_rewind.side");
    default:
      return t("match.veto_rewind.decider");
  }
}

function typeClass(step: VetoStep) {
  switch (step.type) {
    case "Ban":
      return "border-destructive/40 text-destructive";
    case "Pick":
      return "border-success/40 text-success";
    case "Side":
      return "border-[hsl(var(--tac-blue)/0.45)] text-[hsl(var(--tac-blue))]";
    default:
      return "border-border text-muted-foreground";
  }
}

function state(step: VetoStep) {
  if (step.step <= props.done) return "done";
  if (step.step === props.done + 1) return "current";
  return "pending";
}

// The Decider is placed, not chosen: taking a veto back to it means taking
// back the ban before it.
function choosable(step: VetoStep) {
  return (
    !!props.canRewind && step.step <= props.done && step.type !== "Decider"
  );
}

function struck(step: VetoStep) {
  return (
    props.rewinding &&
    !!props.target &&
    step.step >= props.target &&
    step.step <= props.done
  );
}

const clockLabel = computed(() => {
  const seconds = Math.max(0, props.clock ?? 0);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
});

const chip =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] transition-colors";
</script>

<template>
  <div
    class="veto-timeline flex flex-col gap-3 rounded-lg border bg-card/30 p-4 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none"
    :class="
      rewinding
        ? 'border-[hsl(var(--tac-amber)/0.6)] shadow-[0_0_0_3px_hsl(var(--tac-amber)/0.08)]'
        : 'border-border/60'
    "
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ $t("match.veto_rewind.title", { count: bestOf }) }}
      </span>
      <span
        v-if="current && !rewinding"
        class="inline-flex items-center gap-1.5 text-xs"
      >
        <span :class="teamClass(current.lineup)" class="font-semibold">
          {{
            current.lineup
              ? teamName(current.lineup)
              : $t("match.veto_rewind.decider")
          }}
        </span>
        <span class="text-muted-foreground">
          {{ $t("match.veto_rewind.to_act", { step: current.step }) }}
        </span>
        <span
          class="inline-flex items-center gap-1 font-mono tabular-nums"
          :class="(clock ?? 0) <= 10 ? 'text-destructive' : 'text-foreground'"
        >
          <Timer class="size-3" />
          {{ clockLabel }}
        </span>
      </span>
      <span class="flex-1" />
    </div>

    <ol class="veto-steps grid grid-cols-3 gap-2 pt-5">
      <li v-for="step in steps" :key="step.step" class="relative">
        <span
          v-if="rewinding && step.step === target"
          aria-hidden="true"
          class="pointer-events-none absolute -bottom-1 -left-[5px] -top-5 z-10 w-0.5 rounded bg-[hsl(var(--tac-amber))] shadow-[0_0_10px_hsl(var(--tac-amber)/0.6)]"
          :class="hot === 'step' && faqHotClasses"
        >
          <span
            class="absolute -top-0.5 left-0 whitespace-nowrap rounded-sm bg-[hsl(var(--tac-amber))] px-1.5 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-black"
          >
            {{ $t("match.veto_rewind.again_from", { step: step.step }) }}
          </span>
        </span>
        <button
          type="button"
          class="relative flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-md border p-2 text-left outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))] disabled:cursor-default"
          :class="[
            state(step) === 'current'
              ? 'border-dashed border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.06)]'
              : state(step) === 'done'
                ? 'border-border/70 bg-background/50'
                : 'border-border/40 bg-muted/10',
            choosable(step) &&
              'cursor-pointer hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.06)]',
          ]"
          :disabled="!choosable(step)"
          :aria-label="
            $t('match.veto_rewind.rewind_to_step', { step: step.step })
          "
          :title="
            choosable(step)
              ? $t('match.veto_rewind.rewind_to_step', { step: step.step })
              : undefined
          "
          @click="emit('update:target', step.step)"
        >
          <span class="flex items-center justify-between gap-1">
            <span
              class="font-mono text-[0.58rem] tabular-nums text-muted-foreground"
            >
              {{ String(step.step).padStart(2, "0") }}
            </span>
            <span
              class="rounded border px-1 font-mono text-[0.52rem] font-bold uppercase tracking-[0.12em]"
              :class="typeClass(step)"
            >
              {{ typeLabel(step) }}
            </span>
          </span>
          <span class="flex min-h-[2.25rem] items-center gap-1.5">
            <template v-if="state(step) === 'done'">
              <img
                :src="`/img/maps/icons/${step.map}.svg`"
                alt=""
                class="size-5 shrink-0"
                :class="step.type === 'Ban' && 'opacity-40 grayscale'"
              />
              <span
                class="truncate text-xs font-semibold"
                :class="
                  step.type === 'Ban' &&
                  'text-muted-foreground line-through decoration-destructive/60'
                "
              >
                {{ mapLabel({ name: step.map }) }}
              </span>
              <span
                v-if="step.side"
                class="ml-auto rounded px-1 font-mono text-[0.55rem] font-bold"
                :class="
                  step.side === e_sides_enum.CT
                    ? 'bg-sky-500/15 text-sky-300'
                    : 'bg-amber-500/15 text-amber-300'
                "
              >
                {{ step.side === e_sides_enum.CT ? "CT" : "T" }}
              </span>
            </template>
            <span
              v-else-if="state(step) === 'current'"
              class="inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
            >
              <span
                class="size-1.5 animate-pulse rounded-full bg-[hsl(var(--tac-amber))] motion-reduce:animate-none"
              />
              {{ $t("match.veto_rewind.now") }}
            </span>
            <span v-else class="text-xs text-muted-foreground/50">—</span>
          </span>
          <span
            class="truncate text-[0.68rem] font-semibold"
            :class="teamClass(step.lineup)"
          >
            {{
              step.lineup
                ? teamName(step.lineup)
                : $t("match.veto_rewind.drawn")
            }}
          </span>
          <span
            v-if="step.step <= done"
            aria-hidden="true"
            class="veto-hatch pointer-events-none absolute inset-0 flex items-end justify-end p-1 transition-opacity duration-200 ease-out motion-reduce:transition-none"
            :class="struck(step) ? 'opacity-100' : 'opacity-0'"
            :style="{
              transitionDelay:
                struck(step) && target
                  ? `${(step.step - target) * 40}ms`
                  : '0ms',
            }"
          >
            <span
              class="rounded-sm bg-background/80 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))]"
            >
              {{ $t("match.veto_rewind.redone") }}
            </span>
          </span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.veto-timeline {
  container-type: inline-size;
}

@container (min-width: 34rem) {
  .veto-steps {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@container (min-width: 64rem) {
  .veto-steps {
    grid-template-columns: repeat(9, minmax(0, 1fr));
  }
}

.veto-hatch {
  background-color: hsl(var(--background) / 0.45);
  background-image: repeating-linear-gradient(
    -45deg,
    hsl(var(--tac-amber) / 0.22) 0 2px,
    transparent 2px 7px
  );
}
</style>
