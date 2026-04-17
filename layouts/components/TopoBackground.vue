<script setup lang="ts">
// Renders precomputed topographic contour paths. The contour geometry is
// deterministic (fixed set of Gaussian peaks) so it's generated ahead of
// time by scripts/generate-topo.mjs into utilities/topoContours.ts —
// keeping ~225K cell evaluations + Chaikin smoothing off every page load.

import {
  TOPO_FLOW,
  TOPO_STATIC,
  TOPO_VIEW_HEIGHT,
  TOPO_VIEW_WIDTH,
} from "~/utilities/topoContours";

withDefaults(defineProps<{ animated?: boolean }>(), { animated: false });
</script>

<template>
  <div
    class="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    aria-hidden="true"
  >
    <div class="absolute inset-0 bg-background"></div>

    <svg
      class="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="`0 0 ${TOPO_VIEW_WIDTH} ${TOPO_VIEW_HEIGHT}`"
      preserveAspectRatio="xMidYMid slice"
    >
      <!-- Static base contours — the map -->
      <g
        :class="[
          '[shape-rendering:optimizeSpeed]',
          animated
            ? 'text-foreground/10 dark:text-white/[0.08]'
            : 'text-foreground/[0.03] dark:text-white/[0.02]',
        ]"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          v-for="(c, i) in TOPO_STATIC"
          :key="`s-${i}`"
          :d="c.d"
          :style="{ opacity: c.o }"
          vector-effect="non-scaling-stroke"
        />
      </g>

      <!-- Flowing light traveling around select contours.
           Glow is faked with a thicker, translucent companion stroke
           instead of a drop-shadow filter — filters re-rasterize every
           frame, stacked strokes don't. -->
      <template v-if="animated">
        <g
          class="text-foreground/[0.12] dark:text-[hsl(36_100%_70%/0.18)]"
          fill="none"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
        >
          <path
            v-for="(c, i) in TOPO_FLOW"
            :key="`fg-${i}`"
            :d="c.d"
            class="animate-topo-flow motion-reduce:animate-none motion-reduce:opacity-0"
            :style="{
              strokeDasharray: `${(c.len * 0.12).toFixed(1)} ${c.len}`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              '--flow-length': `${c.len}`,
            }"
            vector-effect="non-scaling-stroke"
          />
        </g>
        <g
          class="text-foreground/55 dark:text-[hsl(36_100%_70%/0.6)]"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        >
          <path
            v-for="(c, i) in TOPO_FLOW"
            :key="`f-${i}`"
            :d="c.d"
            class="animate-topo-flow motion-reduce:animate-none motion-reduce:opacity-0"
            :style="{
              strokeDasharray: `${(c.len * 0.12).toFixed(1)} ${c.len}`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              '--flow-length': `${c.len}`,
            }"
            vector-effect="non-scaling-stroke"
          />
        </g>
      </template>
    </svg>
  </div>
</template>
