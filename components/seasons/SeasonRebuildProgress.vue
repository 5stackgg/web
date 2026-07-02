<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSeasonBackfill } from "~/composables/useSeasonBackfill";

const props = defineProps<{ seasonId: string }>();

const { t } = useI18n();
const backfill = useSeasonBackfill();

const active = computed(
  () =>
    backfill.running.value &&
    backfill.status.value?.season_id === props.seasonId,
);
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out motion-reduce:!duration-0"
    enter-from-class="opacity-0 -translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in motion-reduce:!duration-0"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-1"
  >
    <div v-if="active" class="mt-2.5 space-y-1">
    <div class="flex items-center justify-between gap-2">
      <span
        class="inline-flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))]"
      >
        <span
          class="inline-block h-[6px] w-[6px] rotate-45 animate-pulse bg-[hsl(var(--tac-amber))]"
        ></span>
        {{ t("pages.seasons.backfill_running") }}
        <span class="text-muted-foreground"
          >· {{ backfill.status.value?.completed || 0 }}/{{
            backfill.status.value?.total || 0
          }}
          {{ t("pages.seasons.matches_label") }}</span
        >
      </span>
      <button
        type="button"
        class="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
        :disabled="backfill.canceling.value"
        @click="backfill.cancelBackfill()"
      >
        {{ t("common.cancel") }}
      </button>
    </div>
    <div class="relative h-1 w-full overflow-hidden rounded-full bg-muted/40">
      <div
        class="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-500"
        :style="{ width: (backfill.progress.value || 0) + '%' }"
      ></div>
    </div>
    </div>
  </Transition>
</template>
