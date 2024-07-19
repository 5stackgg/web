<script lang="ts" setup>
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
</script>

<template>
  <div v-for="stage of tournament.stages" :key="stage.id">
    <TournamentStage :stage="stage"></TournamentStage>
  </div>

  <h1>Add Another Stage</h1>
  <TournamentStageForm
    :order="tournament.stages.length + 1"
  ></TournamentStageForm>
</template>

<script lang="ts">
export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
};
</script>
