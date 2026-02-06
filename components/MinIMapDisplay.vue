<script lang="ts" setup>
import cleanMapName from "~/utilities/cleanMapName";
</script>

<template>
   <div
        :key="map.id"
        class="flex items-center space-x-2 bg-muted/50 rounded-lg px-2 py-1 border border-border"
      >
        <img
          v-if="map.patch"
          :src="map.patch"
          :alt="map.name"
          class="w-5 h-5"
          @error="
            ($event.target as HTMLImageElement).style.display = 'none'
          "
        />
        <span class="text-xs font-medium first-letter:uppercase">{{
          cleanMapName(map.name)
        }}</span>
      </div>
</template>

<script lang="ts">
export default {
  props: {
    map: {
      type: Object,
      required: true,
    },
    patch: {
      type: Boolean,
      default: true,
    },
  },
};
</script>
