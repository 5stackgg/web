<script lang="ts" setup>
import { ArrowRight } from "lucide-vue-next";
import TimeAgo from "./TimeAgo.vue";
import MapDisplay from "./MapDisplay.vue";
import MatchLineupScoreDisplay from "./match/MatchLineupScoreDisplay.vue";
</script>

<template>
  <div class="cursor-pointer max-w-sm" @click="goToMatch">
    <div
      class="relative w-full h-48 overflow-hidden rounded-lg transition-all duration-300 transform hover:scale-105"
    >
      <div class="flex w-full h-full">
        <template v-if="match.match_maps.length === 0">
          <div
            class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]"
          >
            <NuxtImg
              src="/img/maps/screenshots/default.webp"
              class="w-full h-full object-cover min-w-[150px]"
              sizes="sm:200px md:400px lg:1200"
            />
          </div>
        </template>
        <template v-else>
          <MapDisplay
            class="rounded-[0px]"
            v-for="{ map } of match.match_maps"
            :key="map.id"
            :map="map"
            :patch="false"
          ></MapDisplay>
        </template>
      </div>
      <div
        class="absolute inset-0 bg-black bg-opacity-50 flex flex-col p-4 justify-between hover:bg-opacity-10 duration-300"
      >
        <div class="flex justify-between items-start w-full">
          <Badge>{{ match.status }}</Badge>
          <ArrowRight></ArrowRight>
        </div>

        <h1 v-if="match.match_maps.length > 0">
          <MatchLineupScoreDisplay
            :match="match"
            :lineup="match.is_on_lineup_1 ? match.lineup_1 : match.lineup_2"
          />:
          <MatchLineupScoreDisplay
            :match="match"
            :lineup="match.is_on_lineup_1 ? match.lineup_2 : match.lineup_1"
          />
        </h1>

        <div>
          <div class="flex items-center space-x-2">
            <span class="font-bold">{{
              match.is_on_lineup_1 ? match.lineup_1.name : match.lineup_2.name
            }}</span>
            <span class="text-gray-500">vs</span>
            <span class="font-bold">{{
              match.is_on_lineup_1 ? match.lineup_2.name : match.lineup_1.name
            }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <TimeAgo
              :date="match.scheduled_at || match.created_at"
              class="text-sm text-gray-600 dark:text-gray-400"
            ></TimeAgo>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  methods: {
    goToMatch() {
      this.$router.push(`/matches/${this.match.id}`);
    },
  },
};
</script>
