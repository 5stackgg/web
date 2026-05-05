<script setup lang="ts">
import { ref } from "vue";
import { Tv } from "lucide-vue-next";
import OtherMatches from "~/components/match/OtherMatches.vue";
import RecentHighlights from "~/components/clips/RecentHighlights.vue";
import {
  e_match_status_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import TournamentFeatureCard from "~/components/tournament/TournamentFeatureCard.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
  tacticalTabIndicatorClasses,
  tacticalTabIndicatorLiveClasses,
  tacticalTabIndicatorUpcomingClasses,
  tacticalTabIndicatorFinishedClasses,
} from "~/utilities/tacticalClasses";

const activeTab = ref("live-matches");
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>
        <Tv class="h-3.5 w-3.5" />
        Live Feed
      </template>
      <template #title>{{ $t("pages.watch.title") }}</template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition
    v-if="liveTournaments && liveTournaments.length > 0"
    :delay="100"
    class="mt-6"
  >
    <div>
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        TOURNAMENT.FEED
      </div>
      <div class="space-y-3">
        <TournamentFeatureCard
          v-for="tournament in liveTournaments"
          :key="tournament.id"
          :tournament="tournament"
          status-variant="live"
          :status-label="$t('common.live')"
        />
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="150" class="mt-6">
    <div>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses"></span>
          MATCHES.FEED
        </div>
        <Tabs v-model="activeTab">
          <TabsList variant="underline" :class="tacticalTabsListClasses">
            <TabsTrigger value="live-matches" :class="tacticalTabsTriggerClasses">
              <span
                :class="[
                  tacticalTabIndicatorClasses,
                  tacticalTabIndicatorLiveClasses,
                ]"
              ></span>
              {{ $t("common.live") }}
            </TabsTrigger>
            <TabsTrigger value="upcoming-matches" :class="tacticalTabsTriggerClasses">
              <span
                :class="[
                  tacticalTabIndicatorClasses,
                  tacticalTabIndicatorUpcomingClasses,
                ]"
              ></span>
              {{ $t("pages.watch.upcoming_matches") }}
            </TabsTrigger>
            <TabsTrigger value="finished-matches" :class="tacticalTabsTriggerClasses">
              <span
                :class="[
                  tacticalTabIndicatorClasses,
                  tacticalTabIndicatorFinishedClasses,
                ]"
              ></span>
              {{ $t("common.finished") }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
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

  <!-- Recent highlights live below the matches feed and hide entirely
       when there are no public clips — see `sectionLabel` in
       RecentHighlights.vue. Avoids leaving a dead "RECENT.HIGHLIGHTS"
       header on quiet days. -->
  <PageTransition :delay="200" class="mt-6">
    <RecentHighlights section-label="RECENT.HIGHLIGHTS" />
  </PageTransition>

  <div id="pagination" class="mt-6"></div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";

export default {
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
