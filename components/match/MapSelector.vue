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
          class="cursor-pointer h-[180px] transition-all duration-300 ease-in-out transform"
          :class="{
            'scale-110 ring-2 ring-primary': selectedMap?.id === map.id,
            'opacity-30 scale-95':
              selectedMap &&
              selectedMap.id !== map.id &&
              availableMaps.includes(map),
            'hover:scale-105': !selectedMap || selectedMap.id !== map.id,
            'opacity-30 pointer-events-none filter grayscale':
              !availableMaps.includes(map),
          }"
          @click="selectMap(map)"
        />
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 scale-50"
          enter-to-class="opacity-100 scale-100"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-50"
        >
          <div
            v-if="selectedMap?.id === map.id && availableMaps.includes(map)"
            class="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer rounded-lg"
            @click="confirmMap"
          >
            <div
              class="absolute -inset-1 rounded-lg border border-primary/50 animate-pulse"
            />
            <span class="text-sm font-bold text-green-400 drop-shadow-md">
              <slot>Confirm</slot>
            </span>
          </div>
        </Transition>
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
