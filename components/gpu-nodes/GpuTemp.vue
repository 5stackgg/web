<script setup lang="ts">
import { computed } from "vue";
import { TriangleAlert } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TweenNumber from "~/components/game-server-nodes/TweenNumber.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import {
  GPU_TEMP_CRIT,
  GPU_TEMP_HOT,
  tempTone,
} from "~/components/gpu-nodes/gpuDevices";

// A card's temperature: amber with a warning icon from GPU_TEMP_HOT, red from
// GPU_TEMP_CRIT. `tip` puts the reason in a tooltip; off where an outer
// tooltip already reads it out.
const props = withDefaults(
  defineProps<{ value: number | null; tip?: boolean }>(),
  { tip: true },
);

const { t } = useI18n();

const tone = computed(() => tempTone(props.value));

const reason = computed(() =>
  tone.value === "bad"
    ? t("pages.gpu_nodes.plate.too_hot", { limit: GPU_TEMP_CRIT })
    : t("pages.gpu_nodes.plate.hot", { limit: GPU_TEMP_HOT }),
);
</script>

<template>
  <FiveStackToolTip
    as-child
    :delay-duration="120"
    :disabled="!tip || tone === 'ok'"
  >
    <template #trigger>
      <span
        class="inline-flex items-center gap-[3px] whitespace-nowrap"
        :class="tone !== 'ok' && TONE_TEXT[tone]"
        :data-tone="tone"
        :tabindex="tip && tone !== 'ok' ? 0 : undefined"
      >
        <TriangleAlert
          v-if="tone !== 'ok'"
          class="size-3 shrink-0"
          :aria-label="reason"
          data-testid="gpu-temp-warn"
        />
        <TweenNumber
          :value="value == null ? null : Math.round(value)"
          suffix=" °C"
        />
      </span>
    </template>
    {{ reason }}
  </FiveStackToolTip>
</template>
