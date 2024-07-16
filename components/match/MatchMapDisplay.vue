<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import { Badge } from "~/components/ui/badge";
</script>

<template>
  <map-display :map="matchMap.map.name">
    <template v-slot:header>
      <template v-for="veto of matchMap.vetos">
        <div v-if="veto.type === 'LeftOver'" class="absolute top-3">
          <badge variant="destructive">Decider</badge>
        </div>
      </template>

      <badge class="mb-2">{{ matchMap.status }}</badge>
    </template>
    <template v-slot:default>
      <div
        class="absolute bottom-0 left-0 right-0 flex justify-between pl-3 pr-3"
      >
        <div class="text-left">
          <template v-for="veto of matchMap.vetos">
            <template
              v-if="
                veto.type === 'Pick' &&
                veto.match_lineup_id === matchLineups.lineup1.id
              "
            >
              <badge> Picked </badge>
            </template>
          </template>
          <br />

          <NuxtImg
            class="inline-block"
            :src="
              matchMap.lineup_1_side === 'TERRORIST'
                ? '/img/teams/t-patch.png'
                : '/img/teams/ct-patch.webp'
            "
            sizes="sm:24px"
          />
          {{ matchLineups.lineup1.name }}:
          <span class="underline">{{ matchMap.lineup_1_score }}</span>
        </div>
        <div class="text-right">
          <template v-for="veto of matchMap.vetos">
            <template
              v-if="
                veto.type === 'Pick' &&
                veto.match_lineup_id === matchLineups.lineup2.id
              "
            >
              <badge> Picked </badge>
            </template>
          </template>
          <br />

          <NuxtImg
            :src="
              matchMap.lineup_2_side === 'TERRORIST'
                ? '/img/teams/t-patch.png'
                : '/img/teams/ct-patch.webp'
            "
            sizes="sm:24px"
          />

          {{ matchLineups.lineup2.name }}:
          <span class="underline">{{ matchMap.lineup_2_score }}</span>
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
      requried: true,
    },
  },
  computed: {
    matchLineups() {
      return getMatchLineups(this.match);
    },
  },
};
</script>
