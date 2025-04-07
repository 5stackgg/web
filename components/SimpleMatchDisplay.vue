<script lang="ts" setup>
import { ArrowRight } from "lucide-vue-next";
import TimeAgo from "./TimeAgo.vue";
import MapDisplay from "./MapDisplay.vue";
import MatchLineupScoreDisplay from "./match/MatchLineupScoreDisplay.vue";
import { e_match_status_enum } from "~/generated/zeus";
</script>

<template>
  <div
    class="relative w-80 h-48 overflow-hidden rounded-lg transition-all duration-300 transform hover:scale-105 cursor-pointer"
    @click="goToMatch"
  >
    <div class="flex w-full h-full">
      <template v-if="match.match_maps.length === 0">
        <div
          class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]"
        >
          <NuxtImg
            src="/img/maps/screenshots/default.webp"
            class="w-full h-full object-cover min-w-[150px]"
            sizes="400px lg:600"
          />
        </div>
      </template>
      <template v-else>
        <MapDisplay
          class="rounded-none"
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
        <Badge>
          {{ match.e_match_status.description }}
          <template v-if="match.status === e_match_status_enum.PickingPlayers">
            ({{ totalPlayers }} / {{ match.min_players_per_lineup * 2 }})
          </template>
        </Badge>
        <ArrowRight></ArrowRight>
      </div>

      <h1 class="text-2xl flex gap-1" v-if="match.match_maps.length > 0">
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="
            match.lineup_1.is_on_lineup ? match.lineup_1 : match.lineup_2
          "
        />:
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="
            match.lineup_2.is_on_lineup ? match.lineup_1 : match.lineup_2
          "
        />
      </h1>

      <div>
        <div class="flex items-center space-x-2">
          <span class="font-bold">{{
            match.lineup_1.is_on_lineup
              ? match.lineup_1.name
              : match.lineup_2.name
          }}</span>
          <span class="text-gray-500">{{ $t("match.simple.vs") }}</span>
          <span class="font-bold">{{
            match.lineup_1.is_on_lineup
              ? match.lineup_2.name
              : match.lineup_1.name
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
  computed: {
    totalPlayers() {
      return (
        Math.min(
          this.match.lineup_counts.lineup_1_count,
          this.match.min_players_per_lineup,
        ) +
        Math.min(
          this.match.lineup_counts.lineup_2_count,
          this.match.min_players_per_lineup,
        )
      );
    },
  },
};
</script>
