<script setup lang="ts">
import { ref, computed } from "vue";
import gql from "graphql-tag";
import { useForm } from "vee-validate";
import { ArrowLeft, ArrowRight, CalendarClock } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { setupOptionsVariables } from "~/utilities/setupOptions";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import MatchOptions from "~/components/MatchOptions.vue";
import DateTimePicker from "~/components/common/DateTimePicker.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import DraftTeamPanel from "~/components/draft-games/DraftTeamPanel.vue";
import { Button } from "~/components/ui/button";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalCtaButtonClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({ middleware: ["match-schedule"] });

const { t } = useI18n();

const validatorComponent: any = { $t: t };
const form = useForm({
  keepValuesOnUnmount: true,
  validationSchema: toTypedSchema(
    matchOptionsValidator(
      validatorComponent,
      {},
      useApplicationSettingsStore().settings,
    ),
  ),
  initialValues: {},
});
validatorComponent.form = form;

const PER_TEAM: Record<string, number> = {
  Competitive: 5,
  Wingman: 2,
  Duel: 1,
};
const matchType = computed(() => (form.values as any).type);
const perTeam = computed(() => PER_TEAM[matchType.value] || 5);

const step = ref(1);
const steps = [
  "pages.matches.schedule.step_settings",
  "pages.matches.schedule.step_teams",
];
const submitting = ref(false);

const scheduledAtLocal = ref("");
const scheduledValid = computed(
  () =>
    !!scheduledAtLocal.value &&
    new Date(scheduledAtLocal.value).getTime() > Date.now(),
);

type Side = {
  mode: "team" | "individual";
  teamId: string | null;
  members: Array<{ steam_id: string; player: any }>;
};
const lineups = ref<Side[]>([
  { mode: "team", teamId: null, members: [] },
  { mode: "team", teamId: null, members: [] },
]);

const sourceOptions = computed(() => [
  { key: "team", label: t("pages.matches.schedule.team") },
  { key: "individual", label: t("pages.matches.schedule.individual") },
]);

const excludedSteamIds = computed(() =>
  lineups.value.flatMap((s) => s.members.map((m) => m.steam_id)),
);

const addPlayer = (sideIndex: number, player: { steam_id: string }) => {
  const side = lineups.value[sideIndex];
  if (
    side.members.length >= perTeam.value ||
    side.members.some((m) => m.steam_id === player.steam_id)
  ) {
    return;
  }
  side.members.push({ steam_id: player.steam_id, player });
};
const removePlayer = (sideIndex: number, steamId: string) => {
  lineups.value[sideIndex].members = lineups.value[sideIndex].members.filter(
    (m) => m.steam_id !== steamId,
  );
};

const sideValid = (side: Side) =>
  side.mode === "team"
    ? !!side.teamId
    : side.members.length >= perTeam.value;
const teamsReady = computed(() => lineups.value.every(sideValid));

const goToTeams = async () => {
  const { valid } = await form.validate();
  if (valid && scheduledValid.value) {
    step.value = 2;
  }
};

const buildLineup = (side: Side) =>
  side.mode === "team"
    ? { team_id: side.teamId }
    : { steam_ids: side.members.map((m) => m.steam_id) };

const submit = form.handleSubmit(async (values: any) => {
  if (submitting.value || !teamsReady.value || !scheduledValid.value) {
    return;
  }
  if (values.custom_map_pool) {
    values.map_pool_id = undefined;
  }
  const options = setupOptionsVariables(values, {
    mapPoolId: values.map_pool_id,
  });

  submitting.value = true;
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: gql`
        mutation CreateScheduledMatch(
          $options: jsonb!
          $scheduled_at: String!
          $lineup_1: ScheduledLineupInput!
          $lineup_2: ScheduledLineupInput!
        ) {
          createScheduledMatch(
            options: $options
            scheduled_at: $scheduled_at
            lineup_1: $lineup_1
            lineup_2: $lineup_2
          ) {
            matchId
          }
        }
      `,
      variables: {
        options,
        scheduled_at: new Date(scheduledAtLocal.value).toISOString(),
        lineup_1: buildLineup(lineups.value[0]),
        lineup_2: buildLineup(lineups.value[1]),
      },
    });
    const matchId = data?.createScheduledMatch?.matchId;
    if (matchId) {
      navigateTo(`/matches/${matchId}`);
    }
  } finally {
    submitting.value = false;
  }
});
</script>

<template>
  <PageTransition>
    <div class="mx-auto max-w-4xl pb-24 pt-4">
      <TacticalPageHeader>
        <template #title>{{ $t("pages.matches.schedule.title") }}</template>
      </TacticalPageHeader>

      <div class="mt-5 flex items-center gap-2">
        <template v-for="(label, index) in steps" :key="label">
          <button
            type="button"
            class="flex flex-1 basis-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-center transition-colors"
            :class="
              step === index + 1
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.1)] text-foreground'
                : step > index + 1
                  ? 'border-[hsl(var(--tac-amber)/0.4)] text-muted-foreground'
                  : 'border-border text-muted-foreground/60'
            "
            @click="index === 0 ? (step = 1) : goToTeams()"
          >
            <span
              class="grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.6rem] font-bold"
              :class="
                step >= index + 1
                  ? 'border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))]'
                  : 'border-border'
              "
            >
              {{ index + 1 }}
            </span>
            <span
              class="font-mono text-[0.62rem] uppercase tracking-[0.16em] sm:inline"
            >
              {{ $t(label) }}
            </span>
          </button>
          <div
            v-if="index < steps.length - 1"
            class="h-px w-4 shrink-0 bg-border sm:w-8"
          ></div>
        </template>
      </div>

      <!-- Step 1: kickoff + match options (the draft's settings tab) -->
      <Transition name="step">
        <div v-show="step === 1" class="mt-6 space-y-5">
          <section>
            <div :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.matches.schedule.kickoff") }}
            </div>
            <DateTimePicker v-model="scheduledAtLocal" />
            <p
              v-if="scheduledAtLocal && !scheduledValid"
              class="mt-1.5 text-[0.72rem] text-destructive"
            >
              {{ $t("pages.matches.schedule.kickoff_future") }}
            </p>
          </section>

          <MatchOptions :form="form" />

          <div class="flex justify-end">
            <Button :disabled="!scheduledValid" @click="goToTeams">
              {{ $t("common.next") }}
              <ArrowRight class="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Transition>

      <!-- Step 2: teams — select a team or assign players individually -->
      <Transition name="step">
        <div v-show="step === 2" class="mt-6 space-y-5">
          <p class="text-sm text-muted-foreground">
            {{ $t("pages.matches.schedule.lineups_desc", { count: perTeam }) }}
          </p>

          <div class="grid items-start gap-4 sm:grid-cols-2">
            <div
              v-for="(side, index) in lineups"
              :key="index"
              class="space-y-3"
            >
              <AnimatedFilters
                v-model="side.mode"
                :options="sourceOptions"
                square
                block
              />

              <TeamSearch
                v-if="side.mode === 'team'"
                :label="$t('pages.matches.schedule.select_team')"
                :model-value="side.teamId"
                :min-players="perTeam"
                :exclude="
                  lineups[index === 0 ? 1 : 0].teamId
                    ? [lineups[index === 0 ? 1 : 0].teamId]
                    : []
                "
                @selected="(team) => (side.teamId = team.id)"
              />

              <DraftTeamPanel
                v-else
                :title="$t('pages.matches.schedule.team_n', { n: index + 1 })"
                :players="side.members"
                :per-team="perTeam"
                :accent="index === 0 ? 'amber' : 'blue'"
                addable
                removable
                :exclude-steam-ids="excludedSteamIds"
                @add="(steamId, player) => addPlayer(index, player)"
                @remove="(steamId) => removePlayer(index, steamId)"
              />
            </div>
          </div>

          <div class="flex justify-between">
            <Button variant="outline" @click="step = 1">
              <ArrowLeft class="mr-1.5 h-4 w-4" />
              {{ $t("common.back") }}
            </Button>
            <button
              type="button"
              :class="tacticalCtaButtonClasses"
              :disabled="!teamsReady || submitting"
              @click="submit"
            >
              <CalendarClock class="mr-1.5 h-4 w-4" />
              {{ $t("pages.matches.schedule.submit") }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </PageTransition>
</template>

<style scoped>
.step-enter-active,
.step-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.step-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.step-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
