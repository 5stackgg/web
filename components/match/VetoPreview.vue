<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <div class="flex gap-4 h-[150px] overflow-hidden mt-8 mb-8">
    <map-display
      :map="map.name"
      class="cursor-pointer"
      :class="{
        'bg-red-500': modelValue === map.id,
        'opacity-30 pointer-events-none': !availableMaps.includes(map),
      }"
      @click="$emit('update:modelValue', map.id)"
      v-for="map of maps"
    >
    </map-display>
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
    maps: {
      type: Array,
      required: false,
    },
    picks: {
      type: Array,
      required: false,
    },
  },
  computed: {
    availableMaps() {
      if (!this.maps) {
        return;
      }

      return this.maps.filter((map) => {
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
