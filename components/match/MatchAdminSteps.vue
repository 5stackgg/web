<script setup lang="ts">
import { computed } from "vue";
import { Check } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_match_map_status_enum, e_match_status_enum } from "~/generated/zeus";
import {
  type MatchAdminStep,
  currentMatchAdminStep,
  matchAdminSteps,
  upcomingAdminActions,
} from "~/utilities/matchAdminSteps";

const props = defineProps<{
  match: Record<string, any>;
}>();

const steps = computed(() => matchAdminSteps(props.match));
const currentIndex = computed(() =>
  steps.value.indexOf(currentMatchAdminStep(props.match)),
);

const upcoming = computed(() =>
  upcomingAdminActions(props.match, (role) => useAuthStore().isRoleAbove(role)),
);

function labelKey(step: MatchAdminStep) {
  if (
    step === "live" &&
    props.match.match_maps?.find((map: any) => map.is_current_map)?.status ===
      e_match_map_status_enum.Paused
  ) {
    return "match.admin_bar.steps.paused";
  }
  if (
    step === "finished" &&
    props.match.status === e_match_status_enum.Canceled
  ) {
    return "match.admin_bar.steps.canceled";
  }
  return `match.admin_bar.steps.${step}`;
}

function unlocksAt(step: MatchAdminStep) {
  return upcoming.value.filter((action) => action.step === step);
}
</script>

<template>
  <ol
    class="flex min-w-0 items-center"
    :aria-label="$t('match.admin_bar.steps.label')"
  >
    <li v-for="(step, index) of steps" :key="step" class="flex items-center">
      <span
        v-if="index > 0"
        aria-hidden="true"
        class="mx-1 h-px w-2 sm:w-3"
        :class="index <= currentIndex ? 'bg-muted-foreground/60' : 'bg-border'"
      ></span>
      <FiveStackToolTip as-child side="top" :delay-duration="120">
        <template #trigger>
          <span
            tabindex="0"
            class="inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))]"
            :class="
              index === currentIndex
                ? 'text-foreground'
                : index < currentIndex
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground/50'
            "
            :aria-current="index === currentIndex ? 'step' : undefined"
          >
            <span
              class="grid size-2.5 shrink-0 place-items-center rounded-full border"
              :class="
                index === currentIndex
                  ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] shadow-[0_0_0_3px_hsl(var(--tac-amber)/0.18)]'
                  : index < currentIndex
                    ? 'border-muted-foreground bg-muted-foreground text-background'
                    : 'border-current'
              "
            >
              <Check v-if="index < currentIndex" class="size-2" />
            </span>
            <span :class="index !== currentIndex && 'sr-only md:not-sr-only'">
              {{ $t(labelKey(step)) }}
            </span>
          </span>
        </template>

        <template v-if="index < currentIndex">
          {{ $t("match.admin_bar.steps.done") }}
        </template>
        <template v-else-if="index === currentIndex">
          {{ $t("match.admin_bar.steps.now") }}
        </template>
        <template v-else-if="unlocksAt(step).length">
          <span class="block font-semibold">
            {{ $t("match.admin_bar.steps.unlocks") }}
          </span>
          <span
            v-for="action of unlocksAt(step)"
            :key="action.key"
            class="block"
          >
            {{ $t(action.label) }}
          </span>
        </template>
        <template v-else>
          {{ $t("match.admin_bar.steps.nothing_new") }}
        </template>
      </FiveStackToolTip>
    </li>
  </ol>
</template>
