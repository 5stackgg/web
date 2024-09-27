<script lang="ts" setup>
import TournamentRoundLineup from "~/components/tournament/TournamentRoundLineup.vue";
</script>

<template>
  <div
    :key="bracket.id"
    v-for="bracket in brackets"
    class="tournament-match my-4"
  >
    <div class="items-center m-2">
      <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
        <TournamentRoundLineup
          :bracket="bracket"
          :match="bracket.match"
          :lineup="bracket.match.lineup_1"
          v-if="bracket.match"
        ></TournamentRoundLineup>
        <template v-else> Team 1 </template>
      </div>
    </div>

    <div class="items-center m-2">
      <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
        <TournamentRoundLineup
          :bracket="bracket"
          :match="bracket.match"
          :lineup="bracket.match.lineup_2"
          v-if="bracket.match"
        ></TournamentRoundLineup>
        <template v-else> Team 2 </template>
      </div>
    </div>

    <div class="text-center">
      <Badge>Round {{ round }} - Match {{ bracket.match_number }}</Badge>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    round: {
      type: Number,
      required: true,
    },
    brackets: {
      type: Array,
      required: true,
    },
  },
};
</script>
