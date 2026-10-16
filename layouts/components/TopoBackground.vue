<script setup lang="ts">
import { defineAsyncComponent } from "vue";

withDefaults(defineProps<{ animated?: boolean }>(), { animated: false });

// The static map is the same file the pre-loader already drew, generated from
// the same contours (scripts/generate-topo.mjs) and pixel-identical to
// rendering them inline -- so it costs no download and no DOM. Only the
// animated variant needs the contour data in JS, to drive its flowing strokes.
const TopoAnimated = defineAsyncComponent(
  () => import("~/layouts/components/TopoAnimated.vue"),
);
</script>

<template>
  <div
    class="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    aria-hidden="true"
  >
    <div class="absolute inset-0 bg-background"></div>

    <TopoAnimated v-if="animated" />
    <img
      v-else
      src="/topo.svg"
      alt=""
      decoding="async"
      class="absolute inset-0 w-full h-full"
    />
  </div>
</template>
