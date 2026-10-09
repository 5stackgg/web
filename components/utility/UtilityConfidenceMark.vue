<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { TriangleAlert } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  UTILITY_AIM_DELTA_WARN_DEGREES,
  utilityAimDelta,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

// A recorded lineup is the ordinary case and wears nothing. Only one whose
// stance and angles were worked out rather than captured is marked, so the
// mark means something when it shows.
const props = defineProps<{
  lineup: Pick<
    UtilityLineup,
    "confidence" | "view_yaw_delta" | "view_pitch_delta"
  >;
}>();

const { t } = useI18n();

const state = computed(() => {
  const confidence = props.lineup.confidence;
  if (!confidence || confidence === "exact") {
    return null;
  }
  let key = "low";
  if (confidence === "derived") {
    const delta = utilityAimDelta(props.lineup);
    key =
      delta !== null && delta >= UTILITY_AIM_DELTA_WARN_DEGREES
        ? "derived_off"
        : "derived";
  }
  return {
    key,
    title: t(`pages.utility.confidence.${key}`),
    note: t(`pages.utility.confidence.${key}_note`),
  };
});
</script>

<template>
  <FiveStackToolTip v-if="state" as-child :delay-duration="120">
    <template #trigger>
      <span
        tabindex="0"
        role="img"
        :data-confidence-mark="state.key"
        class="inline-flex shrink-0 rounded-sm text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))]"
        :aria-label="`${state.title}. ${state.note}`"
        @keydown.enter.stop
        @keydown.space.stop
      >
        <TriangleAlert class="h-3.5 w-3.5" />
      </span>
    </template>
    <span class="font-semibold">{{ state.title }}</span>
    <span class="block max-w-[32ch] text-muted-foreground">
      {{ state.note }}
    </span>
  </FiveStackToolTip>
</template>
