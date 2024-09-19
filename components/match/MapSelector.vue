<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <div
    class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-4 my-8"
  >
    <MapDisplay
      v-for="map of mapPool"
      :key="map.id"
      :map="map"
      class="cursor-pointer h-[150px]"
      :class="{
        grayscale: modelValue && modelValue !== map.id,
        ring: modelValue === map.id,
        'opacity-10 pointer-events-none': !availableMaps.includes(map),
      }"
      @click="$emit('update:modelValue', map.id)"
    >
    </MapDisplay>
  </div>
</template>

<script lang="ts">
export default {
  emits: ["update:modelValue"],
  props: {
    modelValue: {
      type: String,
      required: false,
    },
    mapPool: {
      type: Array,
      required: false,
      default: [],
    },
    picks: {
      type: Array,
      required: false,
    },
  },
  computed: {
    availableMaps() {
      if (!this.mapPool) {
        return;
      }

      return this.mapPool.filter((map) => {
        return (
          this.picks?.find((pick) => {
            return pick.map.id === map.id;
          }) === undefined
        );
      });
    },
  },
};
</script>
