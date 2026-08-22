<script setup lang="ts">
import TournamentFeatureCard from "~/components/tournament/TournamentFeatureCard.vue";
import TournamentCompactCard from "~/components/tournament/TournamentCompactCard.vue";
import SimpleTournamentDisplay from "~/components/tournament/SimpleTournamentDisplay.vue";
import type {
  TournamentCardVariant,
  TournamentStatusVariant,
} from "~/components/tournament/tournamentCard";

withDefaults(
  defineProps<{
    tournament: any;
    variant?: TournamentCardVariant;
    statusVariant?: TournamentStatusVariant;
    statusLabel?: string;
    // Threaded through to the feature card's banner. Only the first card in a
    // list should set it -- see TournamentFeatureCard for why.
    priority?: boolean;
  }>(),
  {
    variant: "feature",
    statusVariant: "default",
    statusLabel: undefined,
    priority: false,
  },
);
</script>

<template>
  <TournamentCompactCard
    v-if="variant === 'compact'"
    :tournament="tournament"
    :status-variant="statusVariant"
    :status-label="statusLabel"
  />
  <!-- The simple card renders status straight off the tournament, so it takes
       no variant/label overrides. -->
  <SimpleTournamentDisplay
    v-else-if="variant === 'simple'"
    :tournament="tournament"
  />
  <TournamentFeatureCard
    v-else
    :tournament="tournament"
    :status-variant="statusVariant"
    :status-label="statusLabel"
    :priority="priority"
  />
</template>
