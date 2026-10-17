<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSeasonBackfill } from "~/composables/useSeasonBackfill";
import { dateLocale } from "~/utilities/dateLocale";

const props = defineProps<{ seasonId: string }>();

const { t } = useI18n();
const backfill = useSeasonBackfill();

const active = computed(
  () =>
    backfill.running.value &&
    backfill.status.value?.season_id === props.seasonId,
);

const count = (n: number | undefined) =>
  new Intl.NumberFormat(dateLocale()).format(n || 0);

const failed = computed(() => backfill.status.value?.failed || 0);
const canceling = computed(
  () => backfill.canceling.value || !!backfill.status.value?.canceled,
);
</script>

<template>
  <Transition name="season-rebuild">
    <div v-if="active" class="grid gap-1.5 rounded-lg bg-muted/30 px-3 py-2.5">
      <div class="flex items-center gap-3">
        <span class="flex-1 text-[0.8rem] tabular-nums text-muted-foreground">
          {{
            t("pages.seasons.rebuild_progress.label", {
              completed: count(backfill.status.value?.completed),
              total: count(backfill.status.value?.total),
            })
          }}
          <span v-if="failed" class="text-destructive">
            ·
            {{
              t(
                "pages.seasons.rebuild_progress.failed",
                { count: failed },
                failed,
              )
            }}
          </span>
        </span>
        <button
          type="button"
          class="text-xs text-muted-foreground transition-colors duration-150 hover:text-destructive disabled:opacity-50"
          :disabled="canceling"
          @click="backfill.cancelBackfill()"
        >
          {{
            canceling
              ? t("pages.seasons.rebuild_progress.canceling")
              : t("common.cancel")
          }}
        </button>
      </div>
      <div class="h-1 overflow-hidden rounded-full bg-muted/60">
        <div
          class="h-full origin-left rounded-full bg-[hsl(var(--tac-amber))] transition-transform duration-500 ease-out motion-reduce:transition-none"
          :style="{
            transform: `scaleX(${(backfill.progress.value || 0) / 100})`,
          }"
        ></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.season-rebuild-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.season-rebuild-leave-active {
  transition: opacity 110ms ease-in;
}
.season-rebuild-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.season-rebuild-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .season-rebuild-enter-active,
  .season-rebuild-leave-active {
    transition-duration: 1ms;
  }
}
</style>
