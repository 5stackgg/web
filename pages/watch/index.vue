<script setup lang="ts">
import { ref } from "vue";
import OtherMatches from "~/components/match/OtherMatches.vue";
import {
  e_match_status_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const activeTab = ref("live-matches");
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #title>{{ $t("pages.watch.title") }}</template>
      <template #actions="{ tabs }">
        <Tabs v-model="activeTab">
          <TabsList variant="underline" :class="tabs.listClass">
            <TabsTrigger value="live-matches" :class="tabs.triggerClass">
              <span
                :class="[tabs.indicatorClass, tabs.indicatorLiveClass]"
              ></span>
              {{ $t("common.live") }}
            </TabsTrigger>
            <TabsTrigger value="upcoming-matches" :class="tabs.triggerClass">
              <span
                :class="[tabs.indicatorClass, tabs.indicatorUpcomingClass]"
              ></span>
              {{ $t("pages.watch.upcoming_matches") }}
            </TabsTrigger>
            <TabsTrigger value="finished-matches" :class="tabs.triggerClass">
              <span
                :class="[tabs.indicatorClass, tabs.indicatorFinishedClass]"
              ></span>
              {{ $t("common.finished") }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition
    :delay="100"
    v-if="liveTournaments && liveTournaments.length > 0"
    class="mt-6"
  >
    <div>
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        TOURNAMENT.FEED
      </div>
      <div class="space-y-4">
        <!-- @ts-expect-error - Type inference issues with GraphQL subscription data -->
        <TournamentTableRow
          v-for="tournament in liveTournaments"
          :key="tournament.id"
          :tournament="tournament"
        ></TournamentTableRow>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="200" class="mt-6">
    <div>
      <div
        v-if="liveTournaments && liveTournaments.length > 0"
        :class="tacticalSectionLabelClasses"
      >
        <span :class="tacticalSectionTickClasses"></span>
        MATCHES.FEED
      </div>
      <Tabs v-model="activeTab">
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
    </div>
  </PageTransition>

  <div id="pagination" class="mt-6"></div>
</template>

<script lang="ts">
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
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
