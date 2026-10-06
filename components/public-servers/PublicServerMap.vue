<script setup lang="ts">
// Map screenshot for a server. An asleep server is drained of colour so a
// glance down the page tells the awake ones apart.
defineProps<{
  map: string;
  asleep?: boolean;
}>();

function onError(event: Event) {
  const img = event.target as HTMLImageElement;
  if (!img.src.endsWith("/default.webp")) {
    img.src = "/img/maps/screenshots/default.webp";
  }
}
</script>

<template>
  <img
    :src="`/img/maps/screenshots/${map}.webp`"
    alt=""
    loading="lazy"
    :class="[
      'h-full w-full object-cover transition-[transform,filter] duration-700',
      asleep ? 'brightness-[.65] grayscale' : 'saturate-[.85]',
    ]"
    @error="onError"
  />
</template>
