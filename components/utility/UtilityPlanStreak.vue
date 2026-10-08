<script setup lang="ts">
import { computed } from "vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { UTILITY_MASTERY_STREAK } from "~/utilities/utilityDisplay";

// Your streak on one lineup, as the mastery rule made visible: five in a row
// is the whole bar. It is the right-hand column of a plan row, where the
// library's rows carry how many players throw it.
const props = defineProps<{
  /** Null when you have never thrown it. */
  streak: number | null;
}>();

const lit = computed(() =>
  Math.max(0, Math.min(UTILITY_MASTERY_STREAK, props.streak ?? 0)),
);

const done = computed(() => lit.value >= UTILITY_MASTERY_STREAK);
</script>

<template>
  <FiveStackToolTip as-child :delay-duration="120" :tap-toggle="false">
    <template #trigger>
      <span class="flex w-14 shrink-0 flex-col items-end gap-1.5">
        <span
          class="text-[0.7rem] leading-none tabular-nums"
          :class="
            streak === null
              ? 'font-medium text-muted-foreground/60'
              : 'font-bold'
          "
        >
          {{
            streak === null
              ? $t("pages.utility.plan.new")
              : `${lit}/${UTILITY_MASTERY_STREAK}`
          }}
        </span>
        <span aria-hidden="true" class="flex gap-0.5">
          <span
            v-for="pip of UTILITY_MASTERY_STREAK"
            :key="pip"
            class="h-1 w-2 rounded-[1px] transition-colors duration-300"
            :class="
              pip <= lit
                ? done
                  ? 'bg-success'
                  : 'bg-[hsl(var(--tac-amber))]'
                : 'bg-white/10'
            "
          />
        </span>
      </span>
    </template>
    {{ $t("pages.utility.progress.streak_hint") }}
  </FiveStackToolTip>
</template>
