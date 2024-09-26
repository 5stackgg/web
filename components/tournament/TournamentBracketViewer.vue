<script lang="ts" setup>
import TournamentRound from "~/components/tournament/TournamentRound.vue";
</script>

<template>
  <div class="tournament-bracket">
    <div :class="`grid grid-cols-${rounds.size}`">
      <template v-for="round of Array.from(rounds.keys())">
        <TournamentRound
          :round="round"
          :brackets="rounds.get(round)"
        ></TournamentRound>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    rounds: {
      type: Map,
      required: true,
    },
  },
};
</script>
