<script lang="ts" setup>
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
</script>

<template>
  <div class="tournament-bracket">
    <div :class="`grid grid-cols-${rounds.size}`">
      <div
        v-for="round of Array.from(rounds.keys())"
        class="flex flex-col justify-around mr-20"
      >
        <TournamentMatch
          :round="round"
          :brackets="rounds.get(round)"
        ></TournamentMatch>
      </div>
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

<style lang="scss">

</style>
