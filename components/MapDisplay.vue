<template>
  <div class="relative w-auto h-full">
    <NuxtImg :src="poster" class="rounded-[3px]" sizes="sm:200px md:400px" />

    <div class="absolute inset-0 bg-black bg-opacity-35"></div>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <slot name="header"></slot>

      <NuxtImg :src="icon" sizes="sm:10vw md:64px lg:64px" />

      <span class="text-white text-xl font-bold uppercase">
        {{ map.replace("de_", "") }}
      </span>
      <slot name="default"></slot>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    map: {
      type: String,
      required: true,
    },
  },
  computed: {
    poster(): string {
      return `/img/maps/${this.map
        .toLowerCase()
        .replace("de_", "")}_poster.webp`;
    },
    icon(): string {
      return `/img/maps/${this.map.toLowerCase().replace("de_", "")}_icon.webp`;
    },
  },
};
</script>
