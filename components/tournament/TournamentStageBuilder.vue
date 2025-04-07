<script lang="ts" setup>
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import Separator from "../ui/separator/Separator.vue";
</script>

<template>
  <div class="space-y-6">
    <div v-for="stage of tournament.stages" :key="stage.id" class="mb-4">
      <TournamentStage :stage="stage"></TournamentStage>
      <Separator v-if="tournament.stages.length > 1" class="my-8"></Separator>
    </div>

    <template v-if="tournament.is_organizer">
      <div v-if="tournament.stages.length === 0" class="text-center p-8">
        <h2 class="text-2xl font-bold mb-4">
          {{ $t("tournament.stage.no_stages") }}
        </h2>
        <p class="text-gray-600 mb-6">
          {{ $t("tournament.stage.start_building") }}
        </p>
      </div>

      <Card class="p-4 max-w-md mx-auto" v-if="tournament.stages.length === 0">
        <h2 class="text-xl font-semibold mb-4">
          {{
            tournament.stages.length === 0
              ? $t("tournament.stage.add_first")
              : $t("tournament.stage.add_another")
          }}
        </h2>
        <TournamentStageForm
          :order="tournament.stages.length + 1"
        ></TournamentStageForm>
      </Card>
    </template>
    <template v-else>
      <div v-if="tournament.stages.length === 0" class="text-center p-8">
        <h2 class="text-2xl font-bold mb-4">
          {{ $t("tournament.stage.not_setup") }}
        </h2>
      </div>
    </template>
  </div>
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
