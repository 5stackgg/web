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
    class="topo-bg"
    :class="{ 'topo-bg--ambient': !animated }"
    aria-hidden="true"
  >
    <div class="topo-bg__base"></div>

    <svg
      class="topo-bg__svg"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="`0 0 ${TOPO_VIEW_WIDTH} ${TOPO_VIEW_HEIGHT}`"
      preserveAspectRatio="xMidYMid slice"
    >
      <!-- Static base contours — the map -->
      <g
        class="topo-bg__static"
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
          class="topo-bg__flow topo-bg__flow--glow"
          fill="none"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
        >
          <path
            v-for="(c, i) in TOPO_FLOW"
            :key="`fg-${i}`"
            :d="c.d"
            class="topo-bg__flow-path"
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
          class="topo-bg__flow"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        >
          <path
            v-for="(c, i) in TOPO_FLOW"
            :key="`f-${i}`"
            :d="c.d"
            class="topo-bg__flow-path"
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

<style scoped>
.topo-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.topo-bg__base {
  position: absolute;
  inset: 0;
  background: hsl(var(--background));
}

.topo-bg__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.topo-bg__static {
  color: hsl(var(--foreground) / 0.1);
  shape-rendering: optimizeSpeed;
}

.topo-bg--ambient .topo-bg__static {
  color: hsl(var(--foreground) / 0.03);
}

.topo-bg__flow {
  color: hsl(var(--foreground) / 0.55);
}

.topo-bg__flow--glow {
  color: hsl(var(--foreground) / 0.12);
}

.topo-bg__flow-path {
  animation-name: topo-flow;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes topo-flow {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: calc(var(--flow-length) * -1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .topo-bg__flow-path {
    animation: none;
    opacity: 0;
  }
}
</style>

<style>
.dark .topo-bg__static {
  color: hsl(0 0% 100% / 0.08);
}
.dark .topo-bg--ambient .topo-bg__static {
  color: hsl(0 0% 100% / 0.02);
}
.dark .topo-bg__flow {
  color: hsl(36 100% 70% / 0.6);
}
.dark .topo-bg__flow--glow {
  color: hsl(36 100% 70% / 0.18);
}
</style>
