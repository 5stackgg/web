<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Gauge, HelpCircle } from "lucide-vue-next";
import {
  humanizeUtilityToken,
  utilityDifficultyKey,
  utilityDifficultyMeasured,
  utilityDifficultyTone,
} from "~/utilities/utilityDisplay";

const props = withDefaults(
  defineProps<{
    difficulty?: string | null;
    compact?: boolean;
  }>(),
  {
    difficulty: null,
    compact: false,
  },
);

const { t } = useI18n();

const token = computed(() => (props.difficulty ?? "").trim());

// Nothing at all is not a grade and not "unmeasured" either — the aggregate has
// simply not spoken about this lineup, and a chip saying so on every card would
// be noise dressed as information.
const show = computed(() => token.value.length > 0);

const key = computed(() => utilityDifficultyKey(token.value));

const measured = computed(() => utilityDifficultyMeasured(token.value));

const label = computed(() => {
  if (key.value) {
    return t(`pages.utility.difficulty.levels.${key.value}`);
  }
  return humanizeUtilityToken(token.value);
});

const note = computed(() => {
  if (key.value) {
    return t(`pages.utility.difficulty.notes.${key.value}`);
  }
  return t("pages.utility.difficulty.notes.unknown");
});
</script>

<template>
  <span
    v-if="show"
    class="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono uppercase tracking-[0.12em]"
    :class="[
      utilityDifficultyTone(token),
      compact ? 'text-[0.58rem]' : 'text-[0.62rem]',
    ]"
    :title="note"
  >
    <Gauge v-if="measured" class="h-3 w-3" />
    <HelpCircle v-else class="h-3 w-3" />
    {{ label }}
  </span>
</template>
