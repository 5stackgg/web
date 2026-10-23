<script setup lang="ts">
import { provide } from "vue";
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import { TooltipProvider } from "~/components/ui/tooltip";
import { demoBracketTournament } from "~/utilities/landing/demoBracket";

// The welcome page's "Compete" visual: the tournament page's own bracket,
// drawn from a made-up playoff. Fits `height` the way the bracket preview
// does, and scrolls sideways in its own box when the panel is too narrow.
withDefaults(
  defineProps<{ height?: number; hideFinishedRounds?: boolean }>(),
  { height: 380, hideFinishedRounds: false },
);

provide("bracket-readonly", true);

const tournament = demoBracketTournament();
const stage = tournament.stages[0];
</script>

<template>
  <TooltipProvider>
    <div class="min-w-0">
      <TournamentStage
        :stage="stage"
        :tournament="tournament"
        :is-final-stage="true"
        :available-height="height"
        :hide-finished-rounds="hideFinishedRounds"
        embed
      />
    </div>
  </TooltipProvider>
</template>
