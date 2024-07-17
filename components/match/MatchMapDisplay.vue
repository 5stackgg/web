<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { Badge } from "~/components/ui/badge";
import MatchMapDisplayLineup from "~/components/match/MatchMapDisplayLineup.vue";
</script>

<template>
  <map-display :map="matchMap.map.name">
    <template v-slot:header>
      <div v-if="isLeftOver" class="absolute top-3">
        <badge variant="destructive">Decider</badge>
      </div>

      <badge class="mb-2">{{ matchMap.status }}</badge>
    </template>
    <template v-slot:default>
      <div class="absolute bottom-3 left-3 right-3 flex justify-between">
        <div class="flex flex-col items-start justify-end gap-1">
          <match-map-display-lineup
            :match="match"
            :match-map="matchMap"
            :lineup="matchLineups.lineup1"
            :showTeamPatch="showTeamPatch"
          ></match-map-display-lineup>
        </div>
        <div class="flex flex-col items-end justify-end gap-1">
          <match-map-display-lineup
            :reverse="true"
            :match="match"
            :match-map="matchMap"
            :lineup="matchLineups.lineup2"
            :showTeamPatch="showTeamPatch"
          ></match-map-display-lineup>
        </div>
      </div>
    </template>
  </map-display>
</template>

<script lang="ts">
import getMatchLineups from "~/utilities/getMatchLineups";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    matchMap: {
      type: Object,
      required: true,
    },
  },
  computed: {
    matchLineups() {
      return getMatchLineups(this.match);
    },
    showTeamPatch() {
      return !this.isLeftOver || this.matchMap.status === "Live";
    },
    isLeftOver() {
      return this.matchMap.vetos.find(({ type }) => {
        return type === "LeftOver";
      });
    },
  },
};
</script>
