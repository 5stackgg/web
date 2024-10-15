<script lang="ts" setup>
import BooleanToText from "../BooleanToText.vue";
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <ul class="space-y-4">
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Max Rounds</span>
      <span>{{ options.mr }}</span>
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">TV Delay</span>
      <span>{{ options.tv_delay }} seconds</span>
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Coaches</span>
      <BooleanToText :value="options.coaches" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Overtime</span>
      <BooleanToText :value="options.overtime" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Knife Round</span>
      <BooleanToText :value="options.knife_round" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Map Veto</span>
      <BooleanToText :value="options.map_veto" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Region Veto</span>
      <BooleanToText :value="options.region_veto" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Substitutes</span>
      <span>{{ options.number_of_substitutes }}</span>
    </li>

    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Timeout Setting</span>
      <span>{{ options.timeout_setting }}</span>
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">Tech Timeout Setting</span>
      <span>{{ options.tech_timeout_setting }}</span>
    </li>
  </ul>

  <template v-if="options.map_veto">
    <Separator class="my-8" />
    <div>
      <h3 class="text-lg font-semibold mb-2">Map Pool</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <MapDisplay
          v-for="map in options.map_pool.maps"
          :key="map.id"
          :map="map"
        />
      </div>
    </div>
  </template>
</template>

<script lang="ts">
export default {
  props: {
    options: {
      type: Object,
      required: true,
    },
  },
};
</script>
