<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Check } from "lucide-vue-next";
import type { ProgressStep } from "~/utilities/tournamentProgressSteps";
import { formatStartTime } from "~/utilities/watchEventCard";

const props = defineProps<{
  name: string;
  steps: ProgressStep[];
}>();

const { t } = useI18n();

function label(step: ProgressStep, short = false) {
  const key = `pages.watch.events.steps.${step.kind}${short ? "_short" : ""}`;
  return t(key, { number: step.number ?? "" });
}

function sublabel(step: ProgressStep, short = false) {
  if (step.state === "done") return null;
  if (step.state === "current" && step.liveCount > 0) return null;
  return formatStartTime(step.startsAt, new Date(), short);
}

const columns = computed(() => ({
  gridTemplateColumns: `repeat(${props.steps.length}, minmax(4.5rem, 1fr))`,
}));
</script>

<template>
  <div class="overflow-x-auto">
    <ol
      class="stepper m-0 grid list-none p-0"
      :style="columns"
      :aria-label="$t('pages.watch.events.progress', { name })"
    >
      <li
        v-for="step in steps"
        :key="step.key"
        :class="[
          'relative grid min-w-0 content-start justify-items-center gap-1 text-center',
          step.state,
        ]"
        :aria-current="step.state === 'current' ? 'step' : undefined"
      >
        <span
          aria-hidden="true"
          class="node grid h-4 w-4 place-items-center rounded-full"
        >
          <Check
            v-if="step.state === 'done'"
            class="h-2.5 w-2.5"
            :stroke-width="3.5"
          />
        </span>
        <b
          class="max-w-full truncate text-[0.8125rem] font-semibold max-sm:text-xs"
        >
          <span class="max-sm:hidden">{{ label(step) }}</span>
          <span class="sm:hidden">{{ label(step, true) }}</span>
          <span v-if="step.state === 'done'" class="sr-only">
            , {{ $t("pages.watch.events.step_done") }}
          </span>
        </b>
        <span
          v-if="step.state === 'current' && step.liveCount > 0"
          class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
        >
          <span class="relative inline-flex h-2 w-2 shrink-0">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
            ></span>
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-destructive"
            ></span>
          </span>
          {{ $t("pages.watch.events.live_count", { count: step.liveCount }) }}
        </span>
        <span
          v-else-if="sublabel(step)"
          class="max-w-full truncate text-xs tabular-nums text-muted-foreground"
        >
          <span class="max-sm:hidden">{{ sublabel(step) }}</span>
          <span class="sm:hidden">{{ sublabel(step, true) }}</span>
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.stepper li:not(:last-child)::after {
  content: "";
  position: absolute;
  top: 7px;
  left: calc(50% + 12px);
  right: calc(-50% + 12px);
  height: 2px;
  border-radius: 1px;
  background: hsl(var(--muted));
}
.stepper li.done:not(:last-child)::after {
  background: hsl(var(--muted-foreground) / 0.55);
}
.node {
  box-shadow: inset 0 0 0 2px hsl(var(--muted-foreground) / 0.45);
  color: hsl(var(--background));
}
.done .node {
  background: hsl(var(--muted-foreground) / 0.7);
  box-shadow: none;
}
.current .node {
  background: hsl(var(--tac-amber));
  box-shadow: 0 0 0 4px hsl(var(--tac-amber) / 0.2);
}
.done b {
  color: hsl(var(--foreground) / 0.7);
  font-weight: 500;
}
.current b {
  color: hsl(var(--tac-amber));
}
</style>
