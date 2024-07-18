<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
</script>

<template>
  <template v-for="veto of matchMap.vetos">
    <template v-if="veto.type === 'Pick' && veto.match_lineup_id === lineup.id">
      <badge class="mb-2"> Picked </badge>
    </template>
  </template>

  <div
    class="flex items-center gap-2"
    :class="`${reverse ? 'flex-row-reverse' : ''}`"
  >
    <NuxtImg
      v-if="showTeamPatch"
      class="inline-block"
      :src="teamPatch"
      sizes="sm:18px"
    />
    <div>
      <span class="font-bold">{{ matchMap.lineup_1_score }}</span>
      [<span class="text-yellow-500">0</span>:<span class="text-blue-400"
        >0</span
      >]
    </div>
  </div>

  {{ lineup.name }}
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
    },
    reverse: {
      type: Boolean,
      required: false,
    },
  },
  computed: {
    matchLineups() {
      return getMatchLineups(this.match);
    },
    teamPatch() {
      return (this.matchLineups.lineup1.id === this.lineup.id
        ? this.matchMap.lineup_1_side
        : this.matchMap.lineup_2_side) === "TERRORIST"
        ? "/img/teams/patches/t.png"
        : "/img/teams/patches/ct.webp";
    },
  },
};
</script>
