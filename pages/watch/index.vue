<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import OtherMatches from "~/components/match/OtherMatches.vue";
import {
  e_match_status_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageTransition>
      <PageHeading>
        <template #title>{{ $t("pages.watch.title") }}</template>
        <template #description>{{ $t("pages.watch.description") }}</template>
      </PageHeading>
    </PageTransition>

    <PageTransition :delay="100">
      <div
        v-if="liveTournaments && liveTournaments.length > 0"
        class="space-y-4"
      >
        <!-- @ts-expect-error - Type inference issues with GraphQL subscription data -->
        <TournamentTableRow
          v-for="tournament in liveTournaments"
          :key="tournament.id"
          :tournament="tournament"
        ></TournamentTableRow>
      </div>
    </PageTransition>

    <PageTransition :delay="200">
      <AnimatedCard variant="gradient" class="p-4">
        <Tabs default-value="live-matches">
          <TabsList>
            <TabsTrigger value="live-matches">{{
              $t("pages.watch.live_matches")
            }}</TabsTrigger>
            <TabsTrigger value="upcoming-matches">{{
              $t("pages.watch.upcoming_matches")
            }}</TabsTrigger>
            <TabsTrigger value="finished-matches">{{
              $t("pages.watch.finished_matches")
            }}</TabsTrigger>
          </TabsList>

          <TabsContent value="live-matches">
            <OtherMatches
              :is-in-lineup="true"
              :statuses="[
                e_match_status_enum.Live,
                e_match_status_enum.WaitingForCheckIn,
                e_match_status_enum.WaitingForServer,
                e_match_status_enum.Veto,
              ]"
            ></OtherMatches>
          </TabsContent>
          <TabsContent value="upcoming-matches">
            <OtherMatches
              :is-in-lineup="true"
              :statuses="[e_match_status_enum.Scheduled]"
            ></OtherMatches>
          </TabsContent>
          <TabsContent value="finished-matches">
            <OtherMatches
              :is-in-lineup="true"
              :statuses="[e_match_status_enum.Finished]"
            ></OtherMatches>
          </TabsContent>
        </Tabs>
      </AnimatedCard>
    </PageTransition>

    <div id="pagination"></div>
  </div>
</template>

<script lang="ts">
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import { mapFields } from "~/graphql/mapGraphql";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";

export default {
  components: {
    TournamentTableRow,
  },
  data() {
    return {
      liveTournaments: [] as any[],
    };
  },
  apollo: {
    $subscribe: {
      liveTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              where: {
                status: {
                  _eq: $("status", "e_tournament_status_enum"),
                },
              },
              order_by: [
                {},
                {
                  start: order_by.asc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            status: e_tournament_status_enum.Live,
          };
        },
        result({ data }: any) {
          this.liveTournaments = data?.tournaments || [];
        },
      },
    },
  },
  computed: {
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
  },
};
</script>
