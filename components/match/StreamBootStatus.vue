<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { FastForward } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import StreamStatusPanel from "~/components/match/StreamStatusPanel.vue";
import type { BootMode } from "~/composables/useBootStages";
import { useBootProgress } from "~/composables/useBootProgress";

// A streamer pod's boot as one line plus a step bar, for the bottom tier of
// the stream caption. The full per-stage list stays on the stream deck
// (BootSequence).
const props = withDefaults(
  defineProps<{
    mode: BootMode;
    histories?: Array<Array<any> | null | undefined>;
    status?: string | null;
    lastStatusAt?: string | null;
    errorMessage?: string | null;
    title: string;
    failedTitle: string;
    // Stage names are operator detail; viewers get the step count only.
    showStage?: boolean;
    canSkip?: boolean;
    skipping?: boolean;
    standalone?: boolean;
  }>(),
  {
    histories: () => [],
    showStage: false,
    canSkip: false,
    skipping: false,
    standalone: false,
  },
);

const emit = defineEmits<{ (e: "skip"): void }>();

const { t } = useI18n();

const { bootInfo, isErrored, visibleStages, currentStage, currentIndex, pct } =
  useBootProgress(() => ({
    mode: props.mode,
    histories: props.histories,
    status: props.status,
    lastStatusAt: props.lastStatusAt,
  }));

const progress = computed(() => {
  const steps = visibleStages.value.length;
  if (!bootInfo.value || steps === 0 || currentIndex.value < 0) {
    return isErrored.value ? null : ("indeterminate" as const);
  }
  return {
    steps,
    current: currentIndex.value,
    fraction: bootInfo.value.currentProgress,
  };
});

const detail = computed(() => {
  if (!props.showStage || !currentStage.value?.label) return null;
  return pct.value !== null && !isErrored.value
    ? `${currentStage.value.label} ${Math.round(pct.value)}%`
    : currentStage.value.label;
});

const trailing = computed(() => {
  const p = progress.value;
  if (!p || p === "indeterminate") return null;
  return t("match.stream.step_of", { current: p.current + 1, total: p.steps });
});

const canSkipShaders = computed(
  () =>
    props.canSkip &&
    !isErrored.value &&
    currentStage.value?.key === "processing_shaders",
);
</script>

<template>
  <StreamStatusPanel
    :title="isErrored ? failedTitle : title"
    :detail="detail"
    :hint="isErrored ? errorMessage : null"
    :trailing="trailing"
    :tone="isErrored ? 'error' : 'default'"
    :progress="progress"
    :standalone="standalone"
  >
    <template v-if="canSkipShaders || $slots.actions" #actions>
      <Button
        v-if="canSkipShaders"
        size="sm"
        variant="outline"
        :loading="skipping"
        @click="emit('skip')"
      >
        <FastForward class="size-3.5" />
        {{ t("live_stages.skip_shaders") }}
      </Button>
      <slot name="actions" :errored="isErrored" />
    </template>
  </StreamStatusPanel>
</template>
