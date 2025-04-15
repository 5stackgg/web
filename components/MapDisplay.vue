<script lang="ts" setup>
import cleanMapName from "~/utilities/cleanMapName";
</script>
<template>
  <div class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]">
    <NuxtImg
      :src="map.poster"
      class="w-full h-full object-cover min-w-[150px]"
      sizes="400px lg:600"
      :class="{
        'brightness-50': darken,
      }"
    />

    <div class="absolute inset-0 bg-black bg-opacity-45"></div>

    <div
      class="absolute inset-0 flex flex-col items-center justify-center"
      v-if="patch"
    >
      <slot name="header"></slot>
      <img
        :src="map.patch"
        class="max-w-[64px] sm:max-w-[96px] w-full h-auto max-h-[60%] object-contain drop-shadow-xl"
        v-if="map.patch"
      />
      <template v-else>
        <span
          class="text-white text-xl font-bold uppercase text-center font-sans"
        >
          {{ map.label || cleanMapName(map.name) }}
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
    darken: {
      type: Boolean,
      default: false,
    },
    patch: {
      type: Boolean,
      default: true,
    },
  },
};
</script>
