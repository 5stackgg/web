<script lang="ts" setup>
import BooleanToText from "../BooleanToText.vue";
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <ul class="space-y-4">
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.max_rounds")
      }}</span>
      <span>{{ options.mr }}</span>
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.tv_delay")
      }}</span>
      <span>{{ options.tv_delay }} {{ $t("match.options.seconds") }}</span>
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.coaches")
      }}</span>
      <BooleanToText :value="options.coaches" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.overtime")
      }}</span>
      <BooleanToText :value="options.overtime" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.knife_round")
      }}</span>
      <BooleanToText :value="options.knife_round" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.map_veto_enabled")
      }}</span>
      <BooleanToText :value="options.map_veto" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.region_veto")
      }}</span>
      <BooleanToText :value="options.region_veto" />
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.substitutes")
      }}</span>
      <span>{{ options.number_of_substitutes }}</span>
    </li>

    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.timeout_setting")
      }}</span>
      <span>{{ options.timeout_setting }}</span>
    </li>
    <li class="flex items-center justify-between">
      <span class="text-muted-foreground">{{
        $t("match.options.tech_timeout_setting")
      }}</span>
      <span>{{ options.tech_timeout_setting }}</span>
    </li>
  </ul>

  <template v-if="options.map_veto">
    <Separator class="my-8" />
    <div>
      <h3 class="text-lg font-semibold mb-2">
        {{ $t("match.options.map_pool") }}
      </h3>
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
