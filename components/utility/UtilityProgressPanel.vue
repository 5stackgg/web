<script setup lang="ts">
import { computed } from "vue";
import { Flame, Target, Trophy } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { UTILITY_MASTERY_STREAK, myUtilityProgress } from "~/utilities/utilityDisplay";
import type { UtilityLineupProgress } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    progress?: UtilityLineupProgress[] | null;
    compact?: boolean;
  }>(),
  {
    progress: null,
    compact: false,
  },
);

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

const mine = computed(() => myUtilityProgress(props.progress, mySteamId.value));

const attempts = computed(() => mine.value?.attempts ?? 0);
const successes = computed(() => mine.value?.successes ?? 0);
const currentStreak = computed(() => mine.value?.current_streak ?? 0);
const bestStreak = computed(() => mine.value?.best_streak ?? 0);
const mastered = computed(() => !!mine.value?.mastered_at);

const hitRate = computed(() => {
  if (attempts.value <= 0) {
    return null;
  }
  return Math.round((successes.value / attempts.value) * 100);
});

// The pips are the mastery rule made visible: five in a row inside the success
// radius is the whole bar, so a half-filled row is a half-earned badge.
const pips = computed(() =>
  Array.from({ length: UTILITY_MASTERY_STREAK }, (_, index) => ({
    index,
    lit: mastered.value || currentStreak.value > index,
  })),
);
</script>

<template>
  <div
    v-if="mine"
    class="rounded-md border px-2.5 py-1.5"
    :class="
      mastered
        ? 'border-success/40 bg-success/10'
        : 'border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)]'
    "
  >
    <div class="flex items-center justify-between gap-2">
      <span
        class="flex items-center gap-1.5 font-mono uppercase tracking-[0.14em]"
        :class="[
          compact ? 'text-[0.55rem]' : 'text-[0.62rem]',
          mastered ? 'text-success' : 'text-[hsl(var(--tac-amber))]',
        ]"
      >
        <Trophy v-if="mastered" class="h-3.5 w-3.5" />
        <Target v-else class="h-3.5 w-3.5" />
        {{
          mastered
            ? $t("pages.utility.progress.mastered")
            : $t("pages.utility.progress.drilled")
        }}
      </span>
      <span
        class="font-mono tabular-nums text-muted-foreground"
        :class="compact ? 'text-[0.6rem]' : 'text-[0.7rem]'"
      >
        {{
          $t("pages.utility.progress.record", {
            successes,
            attempts,
          })
        }}
        <template v-if="hitRate !== null">
          · {{ $t("pages.utility.progress.hit_rate", { percent: hitRate }) }}
        </template>
      </span>
    </div>

    <div class="mt-1.5 flex items-center justify-between gap-2">
      <span
        class="flex items-center gap-1"
        :title="$t('pages.utility.progress.streak_hint')"
      >
        <span
          v-for="pip of pips"
          :key="pip.index"
          aria-hidden="true"
          class="h-1.5 w-4 rounded-[1px]"
          :class="
            pip.lit
              ? mastered
                ? 'bg-success'
                : 'bg-[hsl(var(--tac-amber))]'
              : 'bg-border'
          "
        />
      </span>
      <span
        class="flex items-center gap-2 font-mono tabular-nums text-muted-foreground"
        :class="compact ? 'text-[0.6rem]' : 'text-[0.65rem]'"
      >
        <span class="inline-flex items-center gap-1">
          <Flame class="h-3 w-3" />
          {{
            $t("pages.utility.progress.current_streak", { count: currentStreak })
          }}
        </span>
        <span>
          {{ $t("pages.utility.progress.best_streak", { count: bestStreak }) }}
        </span>
      </span>
    </div>

    <div
      v-if="!compact && mine.last_practiced_at"
      class="mt-1 text-[0.65rem] text-muted-foreground"
    >
      {{ $t("pages.utility.progress.last_practiced") }}
      <TimeAgo :date="mine.last_practiced_at" hide-icon />
    </div>
  </div>
</template>
