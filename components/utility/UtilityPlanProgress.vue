<script setup lang="ts">
import { computed } from "vue";
import cleanMapName from "~/utilities/cleanMapName";
import { UTILITY_MASTERY_STREAK } from "~/utilities/utilityDisplay";

// How far along you are on this map, in one line and one bar: what you have
// mastered, what you have started, and what is left. It sits above the queue
// because the queue is only the next few steps of it.
const props = defineProps<{
  mapName: string;
  mastered: number;
  /** Thrown at least once, not mastered. */
  going: number;
  /** Every lineup you can see on the map. Null until that count has loaded. */
  total: number | null;
}>();

const map = computed(() => cleanMapName(props.mapName));

// Nothing drilled is where everybody starts, so it reads as a start and not
// as a zero.
const fresh = computed(() => props.mastered + props.going === 0);

const rest = computed(() =>
  props.total === null
    ? null
    : Math.max(0, props.total - props.mastered - props.going),
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between gap-2">
      <span class="min-w-0 truncate text-sm font-bold leading-tight">
        <template v-if="fresh">
          {{ $t("pages.utility.plan.progress.fresh") }}
        </template>
        <template v-else-if="total !== null">
          {{
            $t("pages.utility.plan.progress.mastered_of", {
              mastered,
              total,
              map,
            })
          }}
        </template>
        <template v-else>
          {{ $t("pages.utility.plan.progress.mastered", { mastered, map }) }}
        </template>
      </span>
      <span
        class="shrink-0 font-mono text-[0.6rem] uppercase leading-none tracking-[0.1em] text-muted-foreground"
      >
        {{
          $t("pages.utility.plan.progress.rule", {
            count: UTILITY_MASTERY_STREAK,
          })
        }}
      </span>
    </div>

    <!-- Every throw in a practice server moves this while you watch, so the
         three parts ease into their new shares. -->
    <div
      role="img"
      class="flex h-1.5 gap-0.5 overflow-hidden rounded-sm bg-white/[0.07]"
      :aria-label="
        $t('pages.utility.plan.progress.bar', {
          mastered,
          going,
          rest: rest ?? 0,
        })
      "
    >
      <span
        class="h-full basis-0 bg-success transition-[flex-grow] duration-300 motion-reduce:transition-none"
        :style="{ flexGrow: mastered }"
      />
      <span
        class="h-full basis-0 bg-[hsl(var(--tac-amber))] transition-[flex-grow] duration-300 motion-reduce:transition-none"
        :style="{ flexGrow: going }"
      />
      <span
        class="h-full basis-0 bg-white/10 transition-[flex-grow] duration-300 motion-reduce:transition-none"
        :style="{ flexGrow: fresh ? 1 : (rest ?? 0) }"
      />
    </div>

    <p
      class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.62rem] uppercase leading-snug tracking-[0.14em] tabular-nums text-muted-foreground"
    >
      <template v-if="fresh">
        <template v-if="total !== null">
          <span>
            {{
              $t("pages.utility.plan.progress.none_of", { total })
            }}
          </span>
          <span aria-hidden="true" class="text-border">/</span>
        </template>
        <span>{{ $t("pages.utility.plan.progress.order") }}</span>
      </template>
      <template v-else>
        <span>
          {{ $t("pages.utility.plan.progress.going", { count: going }) }}
        </span>
        <template v-if="rest !== null">
          <span aria-hidden="true" class="text-border">/</span>
          <span>
            {{ $t("pages.utility.plan.progress.rest", { count: rest }) }}
          </span>
        </template>
      </template>
    </p>
  </div>
</template>
