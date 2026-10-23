<script setup lang="ts">
import { useId } from "vue";

// Two smoke plumes drifting up and to the right, billowing wider as they rise:
// the utility library's mark. The taller plume stands in front, cut clear of
// the one behind it.
const FRONT: Array<[number, number, number]> = [
  [11.6, 20.3, 1.2],
  [12.3, 17.8, 1.8],
  [13.6, 14.6, 2.5],
  [15.7, 11.2, 3],
  [14.2, 7.6, 2.6],
  [18.2, 7.8, 2.7],
  [16.6, 4.8, 2.4],
];
const BACK: Array<[number, number, number]> = [
  [4.6, 20.5, 1],
  [5.2, 18.4, 1.5],
  [6.3, 15.7, 2.1],
  [8, 12.6, 2.5],
  [6.6, 9.6, 2.1],
  [9.9, 9.4, 2.2],
];
const mask = useId();
</script>

<template>
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <defs>
      <mask :id="mask">
        <rect width="24" height="24" fill="#fff" />
        <g fill="#000" stroke="#000" stroke-width="2.2">
          <circle
            v-for="([cx, cy, r], index) in FRONT"
            :key="index"
            :cx="cx"
            :cy="cy"
            :r="r"
          />
        </g>
      </mask>
    </defs>
    <g :mask="`url(#${mask})`">
      <circle
        v-for="([cx, cy, r], index) in BACK"
        :key="index"
        :cx="cx"
        :cy="cy"
        :r="r"
      />
    </g>
    <circle
      v-for="([cx, cy, r], index) in FRONT"
      :key="index"
      :cx="cx"
      :cy="cy"
      :r="r"
    />
  </svg>
</template>
