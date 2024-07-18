<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <div class="flex gap-4 h-[150px] overflow-hidden my-8">
    <MapDisplay
      :map="map"
      class="cursor-pointer p-1"
      :class="{
        'bg-red-500': modelValue === map.id,
        'opacity-30 pointer-events-none': !availableMaps.includes(map),
      }"
      @click="$emit('update:modelValue', map.id)"
      v-for="map of mapPool"
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
