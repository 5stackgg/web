<script lang="ts" setup>
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
</script>

<template>
  <div>
    {{ lineup.name }}
    <template v-if="bracket.match">
      <Badge>
        <NuxtLink :to="{ name: 'matches', params: { id: bracket.match.id } }">{{
          bracket.match.status
        }}</NuxtLink>
      </Badge>
      <MatchLineupScoreDisplay
        :match="bracket.match"
        :lineup="lineup"
      ></MatchLineupScoreDisplay>
    </template>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    lineup: {
      type: Object,
      required: true,
    },
    match: {
      type: Object,
      required: true,
    },
    bracket: {
      type: Object,
      required: true,
    },
  },
};
</script>
