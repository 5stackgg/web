<script setup lang="ts">
import { computed } from "vue";
import { useRadarProjection } from "~/composables/useRadarProjection";
import {
  UTILITY_TYPE_COLORS,
  utilityLanding,
  utilityOrigin,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

// A set of throws as one picture: where each lands, in its utility's colour,
// on a crop of the radar that holds them all. A collection or an execute is
// told apart by its shape on the map before its name is read.
const props = withDefaults(
  defineProps<{
    mapName: string;
    lineups: UtilityLineup[];
    /** Rendered edge in px. */
    size?: number;
  }>(),
  { size: 40 },
);

const throws = computed(() =>
  props.lineups.map((lineup) => ({
    id: lineup.id,
    origin: utilityOrigin(lineup),
    landing: utilityLanding(lineup),
    color: UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff",
  })),
);

const { radarSrc, projectCalibrated, CANVAS } = useRadarProjection(
  () => props.mapName,
  {
    volumePoints: () =>
      throws.value.map((entry) => entry.landing ?? entry.origin),
  },
);

const marks = computed(() =>
  throws.value
    .map((entry) => ({
      id: entry.id,
      color: entry.color,
      from: projectCalibrated(entry.origin),
      to: entry.landing ? projectCalibrated(entry.landing) : null,
    }))
    .filter((entry) => !!entry.from),
);

const view = computed(() => {
  const points = marks.value.flatMap((entry) =>
    entry.to ? [entry.from!, entry.to] : [entry.from!],
  );
  if (!points.length) {
    return null;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // A floor, so two throws a step apart are not magnified into abstraction.
  const span = Math.max(maxX - minX, maxY - minY, 260) * 1.25;
  const half = Math.min(span / 2, CANVAS / 2);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: Math.min(Math.max(cx - half, 0), CANVAS - half * 2),
    y: Math.min(Math.max(cy - half, 0), CANVAS - half * 2),
    size: half * 2,
  };
});

const unit = computed(() => (view.value ? view.value.size / props.size : 1));
</script>

<template>
  <span
    class="relative block shrink-0 overflow-hidden rounded-[3px] border border-border bg-background"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg
      v-if="view && radarSrc"
      :viewBox="`${view.x} ${view.y} ${view.size} ${view.size}`"
      class="h-full w-full"
      aria-hidden="true"
    >
      <image
        :href="radarSrc"
        x="0"
        y="0"
        :width="CANVAS"
        :height="CANVAS"
        opacity="0.6"
      />
      <template v-for="mark of marks" :key="mark.id">
        <line
          v-if="mark.to"
          :x1="mark.from!.x"
          :y1="mark.from!.y"
          :x2="mark.to.x"
          :y2="mark.to.y"
          :stroke="mark.color"
          :stroke-width="unit * 0.75"
          opacity="0.45"
        />
        <circle
          :cx="(mark.to ?? mark.from!).x"
          :cy="(mark.to ?? mark.from!).y"
          :r="unit * 2.4"
          :fill="mark.color"
        />
      </template>
    </svg>
  </span>
</template>
