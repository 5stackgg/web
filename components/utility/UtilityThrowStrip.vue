<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import UtilityTechniqueIcon from "~/components/utility/UtilityTechniqueIcon.vue";
import UtilityThrowIcon from "~/components/utility/UtilityThrowIcon.vue";
import { utilityThrowButtonsKey } from "~/utilities/utilityDisplay";
import {
  utilityRunUpCaps,
  utilityRunUpSeconds,
} from "~/utilities/utilityThrowGuide";
import type { UtilityRunUp } from "~/utilities/utilityThrowGuide";
import type { UtilityTechnique, UtilityThrowStrength } from "~/types/utility";

// How to throw it, as one strip you glance at mid-match: the stance, its word,
// and the mouse. The mouse says which button on its own, so it has no words;
// the stance keeps its word because the figures alone are not that obvious.
const props = withDefaults(
  defineProps<{
    technique: UtilityTechnique | null | undefined;
    strength: UtilityThrowStrength | null | undefined;
    runUp?: UtilityRunUp | null;
    /** One quiet line under the technique: how much of the data agrees. */
    techniqueNote?: string | null;
  }>(),
  { runUp: null, techniqueNote: null },
);

const { t } = useI18n();

const throwLabel = computed(() =>
  t(`pages.utility.throw_buttons.${utilityThrowButtonsKey(props.strength)}`),
);

const runUpLine = computed(() => {
  const runUp = props.runUp;
  if (!runUp) {
    return null;
  }
  const keys = utilityRunUpCaps(runUp).join(" + ");
  const seconds = utilityRunUpSeconds(runUp);
  return {
    text: t("pages.utility.run_up.first", { keys, seconds }),
    title: t(
      runUp.jump
        ? "pages.utility.run_up.summary_jump"
        : "pages.utility.run_up.summary_throw",
      { keys, seconds },
    ),
  };
});
</script>

<template>
  <div
    class="flex h-14 min-w-0 items-center gap-3 rounded-md border border-border bg-background/50 pl-2 pr-3"
  >
    <UtilityTechniqueIcon
      :technique="technique ?? 'Stationary'"
      class="size-[2.125rem] shrink-0"
    />
    <span class="flex min-w-0 flex-col leading-[1.15]">
      <span class="whitespace-nowrap text-[1.0625rem] font-bold">
        {{ $t(`pages.utility.techniques.${technique ?? "Stationary"}`) }}
      </span>
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
        enter-from-class="opacity-0"
      >
        <span
          v-if="runUpLine"
          class="truncate text-[0.72rem] text-muted-foreground"
          :title="runUpLine.title"
        >
          {{ runUpLine.text }}
        </span>
        <span
          v-else-if="techniqueNote"
          class="truncate text-[0.72rem] text-muted-foreground"
        >
          {{ techniqueNote }}
        </span>
      </Transition>
    </span>
    <span
      aria-hidden="true"
      class="h-0 min-w-4 flex-1 border-t border-dashed border-muted-foreground/30"
    />
    <UtilityThrowIcon
      :strength="strength"
      :label="throwLabel"
      class="h-10 w-7 shrink-0"
    />
  </div>
</template>
