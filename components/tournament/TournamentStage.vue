<template>
  <h1>Stage {{ stage.order }}</h1>
  <div class="flex" >
    <template v-for="round of Array.from(rounds.keys())">
      <TournamentRound :matches="rounds.get(round)"></TournamentRound>
    </template>
  </div>
</template>

<script lang="ts">
import TournamentRound from "~/components/tournament/TournamentRound.vue";

export default {
  components: {TournamentRound},
  props: {
    stage: {
      type: Object,
      required: true,
    }
  },
  computed: {
    rounds() {
      const rounds = new Map();
      for (const bracket of this.stage?.brackets) {
        let matches = rounds.get(bracket.round) || [];

        matches.push(bracket);

        rounds.set(bracket.round, matches);
      }

      return rounds;
    },
  }
}
</script>