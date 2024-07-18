<template>
  <div class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]">
    <NuxtImg
      :src="map.poster"
      class="w-full h-full object-cover min-w-[150px]"
      sizes="sm:200px md:400px lg:1200"
      v-if="map.poster"
    />
    <div v-else class="w-[200px] h-full">
      <!-- TODO -->
      &nbsp;
    </div>

    <div class="absolute inset-0 bg-black bg-opacity-45"></div>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <slot name="header"></slot>

      <NuxtImg :src="map.patch" sizes="sm:10vw md:64px lg:64px" v-if="map.patch" />

      <span class="text-white text-xl font-bold uppercase">
        {{ map.name.replace("de_", "") }}
      </span>
      <slot name="default"></slot>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    map: {
      type: Object,
      required: true,
    },
  },
};
</script>
