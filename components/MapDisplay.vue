<template>
  <div class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]">
    <NuxtImg
      :src="map.poster"
      class="w-full h-full object-cover min-w-[150px]"
      sizes="sm:200px md:400px lg:600"
    />
    <div class="absolute inset-0 bg-black bg-opacity-45"></div>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <slot name="header"></slot>
      <img :src="map.patch" class="max-w-[96px] w-full" v-if="map.patch" />
      <template v-else>
        <span class="text-white text-xl font-bold uppercase">
          {{ map.name.replace("de_", "").replace("_", " ") }}
        </span>
      </template>

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
