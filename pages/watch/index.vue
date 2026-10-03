<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import WatchTicker from "~/components/watch/WatchTicker.vue";
import WatchStreamStage from "~/components/watch/WatchStreamStage.vue";
import WatchColdStart from "~/components/watch/WatchColdStart.vue";
import WatchHighlights from "~/components/watch/WatchHighlights.vue";
import WatchEvents from "~/components/watch/WatchEvents.vue";
import WatchTournaments from "~/components/watch/WatchTournaments.vue";
import { tacticalSectionSeparatorClasses } from "~/utilities/tacticalClasses";
</script>

<template>
  <PageTransition>
    <WatchTicker
      :ghost="feedIsEmpty"
      :streamable-match-ids="streamableMatchIds"
    />
  </PageTransition>

  <PageTransition :delay="50">
    <WatchStreamStage
      v-if="!feedIsEmpty"
      :class="['mt-8', tacticalSectionSeparatorClasses]"
      @update:streamable-ids="streamableMatchIds = $event"
    />
  </PageTransition>

  <PageTransition v-if="feedIsEmpty" :delay="50">
    <WatchColdStart :class="['mt-8', tacticalSectionSeparatorClasses]" />
  </PageTransition>

  <PageTransition :delay="100">
    <WatchHighlights
      :class="['mt-8', tacticalSectionSeparatorClasses]"
      :compact="streamableMatchIds.length > 0"
      :ghost="feedIsEmpty"
    />
  </PageTransition>

  <PageTransition v-if="eventsEnabled" :delay="125">
    <WatchEvents
      :class="['mt-8', tacticalSectionSeparatorClasses]"
      :compact="streamableMatchIds.length > 0"
      :ghost="feedIsEmpty"
      @tournament-ids="eventTournamentIds = $event"
    />
  </PageTransition>

  <PageTransition v-if="!feedIsEmpty" :delay="150">
    <WatchTournaments
      :class="['mt-8', tacticalSectionSeparatorClasses]"
      :exclude-ids="eventTournamentIds"
    />
  </PageTransition>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { NOT_LEAGUE_TOURNAMENT } from "~/graphql/tournamentFilters";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

export default {
  data() {
    return {
      // Live matches the stage can show; the ticker marks and swaps them.
      streamableMatchIds: [] as string[],
      // Tournaments already previewed inside an event card, so the
      // tournaments section doesn't list them twice.
      eventTournamentIds: [] as string[],
      // null until the first result lands -- the cold start must not flash
      // in front of a feed that is about to render.
      matchesCount: null as number | null,
      tournamentsCount: null as number | null,
    };
  },
  apollo: {
    $subscribe: {
      // A fresh install has no matches or tournaments at all; these two
      // counts detect that so the page can show its cold start. They're
      // subscriptions so it clears itself the moment the first match lands.
      matchesCount: {
        query: typedGql("subscription")({
          matches_aggregate: [{}, { aggregate: { count: true } }],
        }),
        result({ data }: any) {
          this.matchesCount = data?.matches_aggregate?.aggregate?.count ?? 0;
        },
        error(error: any) {
          console.error("[watch] matches count subscription error:", error);
        },
      },
      tournamentsCount: {
        query: typedGql("subscription")({
          tournaments_aggregate: [
            { where: { _and: [NOT_LEAGUE_TOURNAMENT] } },
            { aggregate: { count: true } },
          ],
        }),
        result({ data }: any) {
          this.tournamentsCount =
            data?.tournaments_aggregate?.aggregate?.count ?? 0;
        },
        error(error: any) {
          console.error("[watch] tournaments count subscription error:", error);
        },
      },
    },
  },
  computed: {
    eventsEnabled(): boolean {
      return useApplicationSettingsStore().eventsEnabled;
    },
    feedIsEmpty(): boolean {
      return this.matchesCount === 0 && this.tournamentsCount === 0;
    },
  },
};
</script>
