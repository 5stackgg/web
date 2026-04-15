<script setup lang="ts">
import { Check } from "lucide-vue-next";
import MapDisplay from "~/components/MapDisplay.vue";
import {
  vetoTileClasses,
  vetoTileHoverClasses,
  vetoTileActiveClasses,
  vetoTileDisabledClasses,
  vetoTileConfirmOverlayClasses,
  vetoTileConfirmPillClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <div class="container mx-auto px-4">
    <div class="flex flex-wrap justify-center gap-6">
      <div v-for="map in mapPool" :key="map.id" class="relative w-[150px]">
        <div
          class="h-[180px]"
          :class="[
            vetoTileClasses,
            selectedMap?.id === map.id
              ? vetoTileActiveClasses
              : vetoTileHoverClasses,
            !availableMaps.includes(map) && vetoTileDisabledClasses,
          ]"
          @click="selectMap(map)"
        >
          <MapDisplay :map="map" class="h-full w-full" />
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
              :class="vetoTileConfirmOverlayClasses"
              @click.stop="confirmMap"
            >
              <div :class="vetoTileConfirmPillClasses">
                <Check class="w-4 h-4" />
                <span>{{ confirmLabel || $t("common.confirm") }}</span>
              </div>
            </div>
          </Transition>
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
    confirmLabel: {
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
