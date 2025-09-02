<script lang="ts" setup>
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
</script>

<template>
  <div class="flex gap-2">
    <template v-if="match">
      <MatchLineupScoreDisplay
        :match="match"
        :lineup="lineup"
      ></MatchLineupScoreDisplay>
    </template>
    <span>
      {{ lineup_name }}
    </span>
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
    lineup_name: {
      type: String,
      required: true,
    },
  },
};
</script>
