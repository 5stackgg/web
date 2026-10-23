<script setup lang="ts">
import { useId } from "vue";

// Three smoke plumes rising from the ground and fanning out: the utility
// library's mark. The middle plume stands in front, cut clear of the other two.
const FRONT: Array<[number, number, number]> = [
  [12, 20.4, 1.3],
  [12.1, 17.8, 1.9],
  [11.6, 14.5, 2.5],
  [12.5, 10.8, 2.9],
  [10.5, 7.6, 2.4],
  [13.9, 7.2, 2.5],
  [12.1, 4.7, 2.3],
];
const BACK: Array<[number, number, number]> = [
  [6.7, 20.6, 1.1],
  [6, 18.4, 1.6],
  [5, 15.5, 2.1],
  [4.2, 12.3, 2.3],
  [3.2, 9.7, 1.8],
  [5.4, 9.6, 1.8],
  [17.3, 20.6, 1.1],
  [18, 18.4, 1.6],
  [19, 15.5, 2.1],
  [19.8, 12.3, 2.3],
  [20.8, 9.7, 1.8],
  [18.6, 9.6, 1.8],
];
const mask = useId();
</script>

<template>
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
    <rect x="2" y="22" width="20" height="1.3" rx="0.65" />
  </svg>
</template>
