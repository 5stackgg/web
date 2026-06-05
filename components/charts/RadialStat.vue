<script setup lang="ts">
import { computed } from "vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import StatChevron from "~/components/StatChevron.vue";
import { toneColor, type StatLevel } from "~/utils/statTiers";

const props = defineProps<{
  value: string | number;
  label: string;
  // Raw fill 0–100. Used only when `score` is not supplied.
  percentage?: number;
  // 0..1 quality on this stat's own scale. When given it drives the ring's
  // color (red→amber→green), its opacity (faint when bad → solid when good),
  // and its arc length — so a mediocre stat reads as a short, dim, reddish arc
  // instead of a loud full white ring.
  score?: number | null;
  strokeColor?: string;
  // Quality of this stat, rendered as a chevron inside the ring.
  level?: StatLevel | null;
}>();

const radius = 54;
const circumference = 2 * Math.PI * radius;

const hasScore = computed(() => props.score !== null && props.score !== undefined);
const t = computed(() =>
  hasScore.value ? Math.min(Math.max(props.score as number, 0), 1) : 0,
);

// Arc length follows the quality scale when scored, else the raw percentage.
const fillPct = computed(() =>
  hasScore.value
    ? t.value * 100
    : Math.min(Math.max(props.percentage ?? 0, 0), 100),
);

const ringColor = computed(() =>
  hasScore.value ? toneColor(t.value) : props.strokeColor || "#fff",
);

// Floor the opacity so even a bottom-of-scale value stays legible against the
// background ring rather than vanishing entirely. Capped well under full so a
// great stat reads as a calm ring, not an in-your-face one.
const ringOpacity = computed(() =>
  hasScore.value ? 0.25 + 0.45 * t.value : 1,
);

const dashOffset = computed(
  () => circumference - (fillPct.value / 100) * circumference,
);
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div class="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32">
      <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <!-- background ring -->
        <circle
          cx="60"
          cy="60"
          :r="radius"
          stroke="hsl(var(--border))"
          stroke-width="10"
          fill="none"
        />

        <!-- progress ring -->
        <circle
          cx="60"
          cy="60"
          :r="radius"
          :stroke="ringColor"
          :stroke-opacity="ringOpacity"
          stroke-width="10"
          fill="none"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          class="transition-[stroke-dashoffset,stroke,stroke-opacity] duration-500 ease-out"
        />
      </svg>

      <!-- center content -->
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <div class="flex items-center gap-1">
          <AnimatedStat
            :value="value"
            class="text-lg sm:text-xl font-bold leading-none"
          />
          <StatChevron v-if="level" :level="level" class="h-3.5 w-3.5" />
        </div>
        <span
          class="text-[8px] sm:text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {{ label }}
        </span>
      </div>
    </div>
  </div>
</template>
