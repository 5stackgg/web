<script lang="ts" setup>
import { ArrowRight } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <div
    class="relative w-80 h-48 overflow-hidden rounded-lg transition-all duration-300 transform hover:scale-105 cursor-pointer"
    @click="goToTournament"
  >
    <div class="flex w-full h-full">
      <MapDisplay
        class="rounded-none"
        v-for="map of tournament.options.map_pool.maps"
        :key="map.id"
        :map="map"
        :patch="false"
      ></MapDisplay>
    </div>
    <div
      class="absolute inset-0 bg-black bg-opacity-50 flex flex-col p-4 justify-between hover:bg-opacity-10 duration-300"
    >
      <div class="flex justify-between items-start w-full">
        <Badge>{{ tournament.e_tournament_status.description }}</Badge>
        <ArrowRight></ArrowRight>
      </div>

      <div>
        <div class="flex items-center space-x-2">
          {{ tournament.name }}
        </div>
        <div class="flex items-center space-x-2">
          <TimeAgo
            :date="tournament.start"
            class="text-sm text-gray-600 dark:text-gray-400"
          ></TimeAgo>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  methods: {
    goToTournament() {
      this.$router.push(`/tournaments/${this.tournament.id}`);
    },
  },
};
</script>
