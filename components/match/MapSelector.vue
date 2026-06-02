<script setup lang="ts">
import { Check } from "lucide-vue-next";
import MapDisplay from "~/components/MapDisplay.vue";
import { Spinner } from "~/components/ui/spinner";
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
              : !loading && vetoTileHoverClasses,
            !availableMaps.includes(map) && vetoTileDisabledClasses,
            loading && selectedMap?.id !== map.id && vetoTileDisabledClasses,
          ]"
          @click="!loading && selectMap(map)"
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
              @click.stop="!loading && confirmMap()"
            >
              <div :class="vetoTileConfirmPillClasses">
                <Spinner v-if="loading" />
                <Check v-else class="w-4 h-4" />
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
    loading: {
      type: Boolean,
      default: false,
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
