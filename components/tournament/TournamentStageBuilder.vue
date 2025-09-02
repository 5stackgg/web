<script lang="ts" setup>
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import Separator from "../ui/separator/Separator.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { e_tournament_status_enum } from "~/generated/zeus";
</script>

<template>
  <div class="space-y-6">
    <!-- Display stages organized by stage number in tabs -->
    <div v-if="tournament.stages.length > 0">
      <Tabs default-value="stage-1" class="w-full">
        <TabsList
          :class="{
            'grid w-full':
              !tournament.is_organizer ||
              tournament.status !== e_tournament_status_enum.Setup,
          }"
          :style="{ gridTemplateColumns: `repeat(${maxStageNumber}, 1fr)` }"
        >
          <TabsTrigger
            v-for="stageNumber in maxStageNumber"
            :key="stageNumber"
            :value="`stage-${stageNumber}`"
            class="text-sm"
          >
            {{ $t("tournament.stage.stage_tab", { stage: stageNumber }) }}
          </TabsTrigger>
          <TabsTrigger
            value="add-stage"
            class="text-sm"
            v-if="
              tournament.is_organizer &&
              tournament.status === e_tournament_status_enum.Setup
            "
          >
            {{ $t("tournament.stage.add_another") }}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="stageNumber in maxStageNumber"
          :key="stageNumber"
          :value="`stage-${stageNumber}`"
          class="mt-6"
        >
          <div class="space-y-6">
            <div
              v-for="stage of tournament.stages.filter(
                (s: any) => s.order === stageNumber,
              )"
              :key="stage.id"
              class="mb-4"
            >
              <div class="mb-2">
                <div
                  v-if="stageNumber < maxStageNumber"
                  class="text-sm text-muted-foreground mt-1"
                >
                  {{ $t("tournament.stage.advances_to_next_stage") }}
                </div>
              </div>
              <TournamentStage
                :stage="stage"
                :is-final-stage="stageNumber === maxStageNumber"
              ></TournamentStage>
              <Separator
                v-if="
                  tournament.stages.filter((s: any) => s.order === stageNumber)
                    .length > 1
                "
                class="my-4"
              ></Separator>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="add-stage" class="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {{ $t("tournament.stage.add_another") }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TournamentStageForm
                :order="tournament.stages.length + 1"
              ></TournamentStageForm>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
          {{ $t("tournament.stage.add_first") }}
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
  computed: {
    maxStageNumber() {
      if (!this.tournament.stages?.length) return 0;
      return Math.max(...this.tournament.stages.map((s: any) => s.order || 1));
    },
  },
};
</script>
