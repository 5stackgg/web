<script setup lang="ts">
import { computed } from "vue";
import { useSubscription } from "@vue/apollo-composable";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";
import { tournamentBracketStageFields } from "~/graphql/tournamentBracketFields";
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { Skeleton } from "~/components/ui/skeleton";

const props = withDefaults(
  defineProps<{ tournamentId: string; height?: number }>(),
  { height: 380 },
);

const { result } = useSubscription(
  typedGql("subscription")({
    tournaments_by_pk: [
      { id: $("id", "uuid!") },
      {
        id: true,
        name: true,
        status: true,
        stages: tournamentBracketStageFields,
      },
    ],
  } as any),
  () => ({ id: props.tournamentId }),
);

const tournament = computed(
  () => (result.value as any)?.tournaments_by_pk ?? null,
);

// The first stage with a match still to decide, same as the embed's
// "current" link; the last stage once everything is settled.
const stage = computed(() => {
  const stages = tournament.value?.stages ?? [];
  return (
    stages.find((candidate: any) =>
      (candidate.brackets || []).some(
        (bracket: any) =>
          !bracket.bye &&
          (bracket.team_1 || bracket.team_2) &&
          !bracket.match?.winning_lineup_id,
      ),
    ) ??
    stages[stages.length - 1] ??
    null
  );
});

const isFinalStage = computed(() => {
  const stages = tournament.value?.stages ?? [];
  return (
    !!stage.value && stage.value.order === stages[stages.length - 1]?.order
  );
});
</script>

<template>
  <FadeSwap>
    <Skeleton
      v-if="!tournament"
      key="loading"
      class="w-full rounded-md"
      :style="{ height: `${height}px` }"
    />
    <div
      v-else-if="stage"
      key="stage"
      class="min-w-0 overflow-y-auto overscroll-contain"
      :style="{ maxHeight: `${height + 96}px` }"
    >
      <TournamentStage
        :stage="stage"
        :tournament="tournament"
        :is-final-stage="isFinalStage"
        :available-height="height"
        embed
        hide-finished-rounds
      />
    </div>
  </FadeSwap>
</template>
