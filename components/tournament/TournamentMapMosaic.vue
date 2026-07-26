<script setup lang="ts">
withDefaults(
  defineProps<{
    posters: string[];
    // Skew angle for the slices; the images counter-skew so they stay square.
    skew?: number;
  }>(),
  { skew: 14 },
);
</script>

<template>
  <!-- Overhangs the card so the skewed outer slices never leave bare
       triangles at the left/right edges. -->
  <div
    aria-hidden="true"
    class="pointer-events-none absolute -inset-x-[18%] inset-y-0 flex gap-[2px] overflow-hidden"
  >
    <div
      v-for="(poster, index) in posters"
      :key="index"
      class="relative flex-1 overflow-hidden bg-[#0c0e12]"
      :style="{ transform: `skewX(-${skew}deg)` }"
    >
      <img
        :src="poster"
        alt=""
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover opacity-60 saturate-[0.55]"
        :style="{ transform: `skewX(${skew}deg) scale(1.45)` }"
      />
    </div>
  </div>
</template>
