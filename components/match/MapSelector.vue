<script setup lang="ts">
import { Button } from "@/components/ui/button";
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <div class="container mx-auto px-4">
    <div
      class="grid grid-cols-2 lg:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-6"
    >
      <div v-for="map in mapPool" :key="map.id" class="relative group">
        <MapDisplay
          :map="map"
          class="cursor-pointer h-[180px] transition-all duration-300 ease-in-out transform hover:scale-105"
          :class="{
            'ring-4 ring-primary ring-opacity-50': selectedMap?.id === map.id,
            'opacity-30 pointer-events-none filter grayscale':
              !availableMaps.includes(map),
          }"
          @click="selectMap(map)"
        />
        <div
          v-if="selectedMap?.id === map.id && availableMaps.includes(map)"
          class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 cursor-pointer rounded-lg"
        >
          <Button variant="destructive" @click="confirmMap">
            <slot></slot>
          </Button>
        </div>
      </div>
    </div>
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
  data() {
    return {
      selectedMap: undefined,
    };
  },
  methods: {
    selectMap(map) {
      this.selectedMap = map;
    },
    confirmMap() {
      this.$emit("update:modelValue", this.selectedMap.id);
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
