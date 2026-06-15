<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
} from "lucide-vue-next";

const { t } = useI18n();
import {
  LEVEL_CLASS,
  statLevelFor,
  statLevelFromRange,
  type StatLevel,
  type StatTierConfig,
} from "~/utils/statTiers";

const props = defineProps<{
  // Discrete cuts mode
  cfg?: StatTierConfig;
  // Continuous range mode (lower-is-better -> good < bad)
  good?: number;
  bad?: number;
  // Shared value for cfg / range modes
  value?: number | null;
  // Pre-computed level overrides everything
  level?: StatLevel | null;
  class?: string;
}>();

const resolvedLevel = computed<StatLevel | null>(() => {
  if (props.level !== undefined) return props.level;
  if (props.cfg) return statLevelFor(props.cfg, props.value);
  if (props.good !== undefined && props.bad !== undefined) {
    return statLevelFromRange(props.value, props.good, props.bad);
  }
  return null;
});

const icon = computed(() => {
  switch (resolvedLevel.value) {
    case 2:
      return ChevronsUp;
    case 1:
      return ChevronUp;
    case -1:
      return ChevronDown;
    case -2:
      return ChevronsDown;
    default:
      return null;
  }
});

const colorClass = computed(() => {
  const lvl = resolvedLevel.value;
  return lvl ? LEVEL_CLASS[lvl] : "";
});

const label = computed(() => {
  switch (resolvedLevel.value) {
    case 2:
      return t("stat.level.best");
    case 1:
      return t("stat.level.above_average");
    case -1:
      return t("stat.level.below_average");
    case -2:
      return t("stat.level.poor");
    default:
      return "";
  }
});
</script>

<template>
  <component
    :is="icon"
    v-if="icon"
    :class="[
      'inline-block align-middle h-3.5 w-3.5 shrink-0',
      colorClass,
      props.class,
    ]"
    :aria-label="label"
    role="img"
  />
</template>
