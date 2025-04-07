<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
</script>

<template>
  <template v-for="veto of matchMap.vetos">
    <template v-if="veto.type === 'Pick' && veto.match_lineup_id === lineup.id">
      <badge class="mb-2">{{ $t("match.map_lineup.picked") }}</badge>
    </template>
  </template>

  <div
    class="flex items-center gap-2"
    :class="`${reverse ? 'flex-row-reverse' : ''}`"
  >
    <img
      v-if="showTeamPatch"
      :src="teamPatch"
      class="max-w-[24px] w-full inline-block"
      sizes="sm:18px"
    />
    <div>
      <MatchLineupScoreDisplay
        :match="match"
        :lineup="lineup"
        :match-map="matchMap"
      ></MatchLineupScoreDisplay>
    </div>
  </div>

  <div class="truncate max-w-full" :title="lineup.name">
    {{ lineup.name }}
  </div>
</template>

<script lang="ts">
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
    lineup: {
      type: Object,
      required: true,
    },
    showTeamPatch: {
      required: true,
    },
    reverse: {
      type: Boolean,
      required: false,
    },
  },
  computed: {
    teamPatch() {
      return (this.match.lineup_1_id === this.lineup.id
        ? this.matchMap.lineup_1_side
        : this.matchMap.lineup_2_side) === "TERRORIST"
        ? "/img/teams/t_logo.svg"
        : "/img/teams/ct_logo.svg";
    },
  },
};
</script>
