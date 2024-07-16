<script setup lang="ts">
import {Badge} from "~/components/ui/badge";
</script>

<template>
  <template v-for="veto of matchMap.vetos">
    <template v-if="veto.type === 'Pick' && veto.match_lineup_id === lineup.id">
      <badge> Picked </badge>
    </template>
  </template>
  <br />

  <NuxtImg
      v-if="showTeamPatch"
      class="inline-block"
      :src="teamPatch"
      sizes="sm:18px"
  />
  {{ lineup.name }}:
  <span class="underline">{{ matchMap.lineup_1_score }}</span>
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
    lineup: {
      type: Object,
      required: true,
    },
    showTeamPatch: {
      required: true,
    }
  },
  computed: {
    matchLineups() {
      return getMatchLineups(this.match);
    },
    teamPatch() {
      return (this.matchLineups.lineup1.id === this.lineup.id ? this.matchMap.lineup_1_side : this.matchMap.lineup_2_side) === 'TERRORIST'
          ? '/img/teams/t-patch.png'
          : '/img/teams/ct-patch.webp';
    }
  },
}
</script>
