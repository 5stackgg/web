<script lang="ts" setup>
import BooleanToText from "../BooleanToText.vue";
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
  </ul>
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
