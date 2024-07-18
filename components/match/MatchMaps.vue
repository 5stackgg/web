<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { Badge } from "~/components/ui/badge";
import MatchMapDisplayLineup from "~/components/match/MatchMapLineup.vue";
</script>

<template>
  <map-display :map="matchMap.map.name">
    <template v-slot:header>
      <div v-if="isDecider && match.best_of > 1" class="absolute top-3">
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
import { e_match_status_enum, e_veto_pick_types_enum } from "~/generated/zeus";

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
      return (
        !this.isDecider || this.matchMap.status === e_match_status_enum.Live
      );
    },
    isDecider() {
      return this.matchMap.vetos.find(({ type }) => {
        return type === e_veto_pick_types_enum.Decider;
      });
    },
  },
};
</script>
