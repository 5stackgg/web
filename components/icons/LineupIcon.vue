<script setup lang="ts">
import { useId } from "vue";

// A throw's dotted arc landing in a smoke: the utility library's mark.
const ground = useId();
</script>

<template>
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="ground">
        <rect width="24" height="20.6" />
      </clipPath>
    </defs>
    <path d="M2.5 20.5C3.6 15.4 6 11.6 9.6 9.4" stroke-dasharray="0.1 3" />
    <path d="M10 20.8h12" />
    <g fill="currentColor" stroke="none" :clip-path="`url(#${ground})`">
      <circle cx="11.6" cy="18.6" r="2.4" />
      <circle cx="14.4" cy="15.4" r="3.3" />
      <circle cx="18.2" cy="14.6" r="3.4" />
      <circle cx="20.2" cy="18.2" r="2.6" />
      <rect x="11" y="17" width="10.5" height="4" />
    </g>
  </svg>
</template>
