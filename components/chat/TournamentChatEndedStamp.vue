<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "@vueuse/core";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { FINISHED_TOURNAMENT_CHAT_MS } from "~/constants/chat";
import { badgePopTransition } from "~/utilities/badgeCount";

const props = defineProps<{
  finishedAt: string;
}>();

const { t } = useI18n();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const now = useNow({ interval: 60_000 });

const remaining = computed(
  () =>
    new Date(props.finishedAt).getTime() +
    FINISHED_TOURNAMENT_CHAT_MS -
    now.value.getTime(),
);

const time = computed(() => {
  if (remaining.value >= DAY) {
    return t("layouts.chat_panel.tournament_ended_days", {
      count: Math.floor(remaining.value / DAY),
    });
  }
  if (remaining.value >= HOUR) {
    return t("layouts.chat_panel.tournament_ended_hours", {
      count: Math.floor(remaining.value / HOUR),
    });
  }
  return `<${t("layouts.chat_panel.tournament_ended_hours", { count: 1 })}`;
});

const label = computed(() =>
  t("layouts.chat_panel.tournament_ended", { time: time.value }),
);

const explanation = computed(() =>
  t("layouts.chat_panel.tournament_ended_tooltip"),
);
</script>

<template>
  <Transition v-bind="badgePopTransition" appear>
    <span v-if="remaining > 0" class="inline-flex shrink-0">
      <FiveStackToolTip as-child side="bottom">
        <template #trigger>
          <span
            :aria-label="`${label}. ${explanation}`"
            class="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1 py-0.5 font-mono text-[0.55rem] font-bold uppercase leading-none tracking-wider text-[hsl(var(--tac-amber))]"
          >
            {{ label }}
          </span>
        </template>
        {{ explanation }}
      </FiveStackToolTip>
    </span>
  </Transition>
</template>
