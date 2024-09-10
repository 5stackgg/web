<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { Badge } from "~/components/ui/badge";
import MatchMapDisplayLineup from "~/components/match/MatchMapLineup.vue";
import formatBits from "~/utilities/formatBits";
</script>

<template>
  <MapDisplay
    :map="matchMap.map"
    :class="{
      'ring-1 ring-red-500': matchMap.is_current_map,
    }"
  >
    <template v-slot:header>
      <div class="absolute top-3">
        <badge class="mb-2">{{ matchMap.status }}</badge>
      </div>

      <badge variant="destructive" v-if="isDecider && match.options.best_of > 1"
        >Decider</badge
      >
      <!-- TODO - env variable url -->
      <div class="absolute top-3 right-3">
        <a
          target="_blank"
          :href="`${useRuntimeConfig().public.webHost}/${matchMap.demos_download_url}`"
        >
          <Button size="sm" variant="outline" v-if="matchMap.demos_total_size">
            Download Demos (<small>{{
              formatBits(matchMap.demos_total_size)
            }}</small
            >)
          </Button>
        </a>
      </div>
    </template>
    <template v-slot:default>
      <div class="absolute bottom-3 left-3 right-3 flex justify-between">
        <div class="flex flex-col items-start justify-end gap-1">
          <match-map-display-lineup
            :match="match"
            :match-map="matchMap"
            :lineup="match.lineup_1"
            :showTeamPatch="showTeamPatch"
          ></match-map-display-lineup>
        </div>
        <div class="flex flex-col items-end justify-end gap-1">
          <match-map-display-lineup
            :reverse="true"
            :match="match"
            :match-map="matchMap"
            :lineup="match.lineup_2"
            :showTeamPatch="showTeamPatch"
          ></match-map-display-lineup>
        </div>
      </div>
    </template>
  </MapDisplay>
</template>

<script lang="ts">
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
