<script setup lang="ts">
import { computed } from "vue";
import { humanizeCallout } from "~/utilities/mapCallouts";
import type { MapCallout } from "~/utilities/mapCallouts";

const props = withDefaults(
  defineProps<{
    callouts: MapCallout[];
    project: (p: {
      x: number;
      y: number;
      z?: number;
    }) => { x: number; y: number } | null;
    zoom?: number;
    labels?: boolean;
  }>(),
  {
    zoom: 1,
    labels: true,
  },
);

// Under this many square radar pixels a label is unreadable and the box it sits
// in is a smudge, so the area keeps its outline and loses its name.
const MIN_LABEL_AREA = 900;

type DrawnBox = { x: number; y: number; w: number; h: number };
type DrawnCallout = {
  name: string;
  label: string;
  boxes: DrawnBox[];
  labelAt: { x: number; y: number } | null;
};

const drawn = computed<DrawnCallout[]>(() => {
  const out: DrawnCallout[] = [];

  for (const callout of props.callouts ?? []) {
    const boxes: DrawnBox[] = [];
    let widest: DrawnBox | null = null;

    for (const box of callout.boxes ?? []) {
      // Each box is projected at its OWN centre height, not the board's: on
      // Nuke and Vertigo the projection reads Z to decide which level's inset a
      // point belongs in, so a shared height would stack both floors.
      const z = (box.min[2] + box.max[2]) / 2;
      const corners = [
        props.project({ x: box.min[0], y: box.min[1], z }),
        props.project({ x: box.max[0], y: box.min[1], z }),
        props.project({ x: box.max[0], y: box.max[1], z }),
        props.project({ x: box.min[0], y: box.max[1], z }),
      ];
      if (corners.some((c) => !c)) {
        continue;
      }

      const xs = corners.map((c) => c!.x);
      const ys = corners.map((c) => c!.y);
      const drawnBox = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      };
      boxes.push(drawnBox);
      if (!widest || drawnBox.w * drawnBox.h > widest.w * widest.h) {
        widest = drawnBox;
      }
    }

    if (!boxes.length || !widest) {
      continue;
    }

    out.push({
      name: callout.name,
      label: humanizeCallout(callout.name),
      boxes,
      labelAt:
        widest.w * widest.h >= MIN_LABEL_AREA
          ? { x: widest.x + widest.w / 2, y: widest.y + widest.h / 2 }
          : null,
    });
  }

  return out;
});

// Held constant on screen while the board zooms -- a label that scales with the
// map is either illegible zoomed out or enormous zoomed in.
const strokeWidth = computed(() => 1.25 / (props.zoom || 1));
const fontSize = computed(() => 14 / (props.zoom || 1));
</script>

<template>
  <g class="pointer-events-none">
    <g v-for="callout of drawn" :key="callout.name">
      <rect
        v-for="(box, index) of callout.boxes"
        :key="index"
        :x="box.x"
        :y="box.y"
        :width="box.w"
        :height="box.h"
        fill="hsl(var(--tac-amber) / 0.05)"
        stroke="hsl(var(--tac-amber) / 0.35)"
        :stroke-width="strokeWidth"
        stroke-dasharray="6 5"
        rx="3"
      />
      <text
        v-if="labels && callout.labelAt"
        :x="callout.labelAt.x"
        :y="callout.labelAt.y"
        text-anchor="middle"
        dominant-baseline="middle"
        :font-size="fontSize"
        font-family="Oxanium, system-ui, sans-serif"
        font-weight="600"
        letter-spacing="0.08em"
        fill="hsl(var(--tac-amber) / 0.85)"
        stroke="hsl(var(--background))"
        :stroke-width="fontSize / 4"
        paint-order="stroke"
      >
        {{ callout.label.toUpperCase() }}
      </text>
    </g>
  </g>
</template>
