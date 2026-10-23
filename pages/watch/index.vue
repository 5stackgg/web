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

  <PageTransition :step="1">
    <WatchStreamStage
      v-if="!feedIsEmpty"
      :class="['mt-8', tacticalSectionSeparatorClasses]"
      @update:streamable-ids="streamableMatchIds = $event"
    />
  </PageTransition>

  <PageTransition v-if="feedIsEmpty" :step="1">
    <WatchColdStart :class="['mt-8', tacticalSectionSeparatorClasses]" />
  </PageTransition>

  <PageTransition :step="2">
    <WatchHighlights
      :class="['mt-8', tacticalSectionSeparatorClasses]"
      :compact="streamableMatchIds.length > 0"
      :ghost="feedIsEmpty"
    />
  </PageTransition>

  <PageTransition v-if="eventsEnabled" :step="3">
    <WatchEvents
      :class="['mt-8', tacticalSectionSeparatorClasses]"
      :compact="streamableMatchIds.length > 0"
      :ghost="feedIsEmpty"
      @tournament-ids="eventTournamentIds = $event"
    />
  </PageTransition>

  <PageTransition v-if="!feedIsEmpty" :step="3">
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
      hasMatches: null as boolean | null,
      hasTournaments: null as boolean | null,
    };
  },
  apollo: {
    $subscribe: {
      // A fresh install has no matches or tournaments at all; these two
      // ask for one of each so the page can show its cold start. They're
      // subscriptions so it clears itself the moment the first match lands.
      // One row, not a count: a signed-in viewer's count ran the matches
      // permission over every match there is, on every poll.
      hasMatches: {
        query: typedGql("subscription")({
          matches: [{ limit: 1 }, { id: true }],
        }),
        result({ data }: any) {
          this.hasMatches = (data?.matches?.length ?? 0) > 0;
        },
        error(error: any) {
          console.error("[watch] matches subscription error:", error);
        },
      },
      hasTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            { where: { _and: [NOT_LEAGUE_TOURNAMENT] }, limit: 1 },
            { id: true },
          ],
        }),
        result({ data }: any) {
          this.hasTournaments = (data?.tournaments?.length ?? 0) > 0;
        },
        error(error: any) {
          console.error("[watch] tournaments subscription error:", error);
        },
      },
    },
  },
  computed: {
    eventsEnabled(): boolean {
      return useApplicationSettingsStore().eventsEnabled;
    },
    feedIsEmpty(): boolean {
      return this.hasMatches === false && this.hasTournaments === false;
    },
  },
};
</script>
