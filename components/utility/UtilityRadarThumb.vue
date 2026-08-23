<script setup lang="ts">
import { computed } from "vue";
import { MapPinOff } from "lucide-vue-next";
import { useRadarProjection } from "~/composables/useRadarProjection";
import type { UtilityTrajectoryPoint } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    mapName: string;
    origin: UtilityTrajectoryPoint;
    landing?: UtilityTrajectoryPoint | null;
    color?: string;
    /** Rendered edge in px. The crop scales with it, the markers do not. */
    size?: number;
  }>(),
  {
    landing: null,
    color: "#ffffff",
    size: 34,
  },
);

const { radarSrc, projectCalibrated, CANVAS } = useRadarProjection(
  () => props.mapName,
);

const from = computed(() => projectCalibrated(props.origin));
const to = computed(() =>
  props.landing ? projectCalibrated(props.landing) : null,
);

/**
 * A square crop of the radar that holds both ends of the throw. Framed on the
 * throw rather than on the map, because the whole job of the tile is to make
 * one spot recognisable at 34px — a shrunk-down whole map would make every row
 * identical again, which is the thing it exists to fix.
 */
const view = computed(() => {
  const a = from.value;
  if (!a) {
    return null;
  }
  const b = to.value;
  const minX = Math.min(a.x, b?.x ?? a.x);
  const maxX = Math.max(a.x, b?.x ?? a.x);
  const minY = Math.min(a.y, b?.y ?? a.y);
  const maxY = Math.max(a.y, b?.y ?? a.y);

  // A floor, so a short throw is not magnified into abstraction, and padding so
  // neither marker sits on the tile's edge.
  const span = Math.max(maxX - minX, maxY - minY, 150) * 1.35;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Kept inside the image: a crop that runs off the canvas shows dead space on
  // one side and reads as a rendering fault rather than as an edge of the map.
  const half = Math.min(span / 2, CANVAS / 2);
  const x = Math.min(Math.max(cx - half, 0), CANVAS - half * 2);
  const y = Math.min(Math.max(cy - half, 0), CANVAS - half * 2);

  return { x, y, size: half * 2 };
});

// Marker geometry is expressed in the crop's own units so the dots stay the
// same visual size however far apart the two ends happen to be.
const unit = computed(() => (view.value ? view.value.size / props.size : 1));

// A 5px marker reads on a 40px tile and vanishes on a 112px map.
const mark = computed(() => (props.size >= 80 ? 1.6 : 1));
</script>

<template>
  <span
    class="relative block shrink-0 overflow-hidden rounded-[3px] border border-border bg-background"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg
      v-if="view && radarSrc && from"
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
        opacity="0.7"
      />
      <line
        v-if="to"
        :x1="from.x"
        :y1="from.y"
        :x2="to.x"
        :y2="to.y"
        :stroke="color"
        :stroke-width="unit * mark"
        :stroke-dasharray="`${unit * 2 * mark} ${unit * 2 * mark}`"
        opacity="0.75"
      />
      <rect
        :x="from.x - unit * 2.5 * mark"
        :y="from.y - unit * 2.5 * mark"
        :width="unit * 5 * mark"
        :height="unit * 5 * mark"
        fill="#e6ebf5"
      />
      <circle
        v-if="to && mark > 1"
        :cx="to.x"
        :cy="to.y"
        :r="unit * 8"
        fill="none"
        :stroke="color"
        :stroke-width="unit * 0.8"
        opacity="0.45"
      />
      <circle
        v-if="to"
        :cx="to.x"
        :cy="to.y"
        :r="unit * 3 * mark"
        :fill="color"
      />
    </svg>

    <MapPinOff
      v-else
      class="absolute inset-0 m-auto h-3 w-3 text-muted-foreground/40"
    />
  </span>
</template>
