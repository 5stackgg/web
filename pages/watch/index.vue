<script setup lang="ts">
import OtherMatches from "~/components/match/OtherMatches.vue";
import RecentHighlights from "~/components/clips/RecentHighlights.vue";
import {
  e_match_status_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import TournamentFeatureCard from "~/components/tournament/TournamentFeatureCard.vue";
import RecentTournaments from "~/components/tournament/RecentTournaments.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
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
        {{ $t("pages.watch.section_live_tournaments") }}
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

  <PageTransition :delay="125" class="mt-6">
    <OtherMatches
      :section-label="$t('pages.watch.section_live_matches')"
      :empty-label="$t('pages.watch.no_live_matches')"
      :is-in-lineup="true"
      :show-pagination="false"
      :use-subscription="true"
      compact
      :limit="12"
      :statuses="[
        e_match_status_enum.Live,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.WaitingForServer,
        e_match_status_enum.Veto,
      ]"
    />
  </PageTransition>

  <PageTransition :delay="150" class="mt-6">
    <RecentTournaments
      :section-label="$t('pages.watch.section_upcoming_tournaments')"
      :statuses="[
        e_tournament_status_enum.RegistrationOpen,
        e_tournament_status_enum.RegistrationClosed,
        e_tournament_status_enum.Setup,
      ]"
      status-variant="registration"
      :status-label="$t('pages.watch.upcoming')"
      order-direction="asc"
      horizontal
      hide-when-empty
      :limit="8"
    />
  </PageTransition>

  <PageTransition :delay="175" class="mt-6">
    <OtherMatches
      :section-label="$t('pages.watch.section_upcoming_matches')"
      :is-in-lineup="true"
      :show-pagination="false"
      :hide-when-empty="true"
      compact
      :limit="10"
      :statuses="[e_match_status_enum.Scheduled]"
    />
  </PageTransition>

  <PageTransition :delay="200" class="mt-6">
    <RecentHighlights
      :section-label="$t('pages.watch.section_recent_highlights')"
      horizontal
    />
  </PageTransition>

  <PageTransition :delay="225" class="mt-6">
    <OtherMatches
      :section-label="$t('pages.watch.section_recent_matches')"
      see-all-to="/matches"
      :is-in-lineup="true"
      :show-pagination="false"
      :hide-when-empty="true"
      compact
      :limit="10"
      :statuses="[e_match_status_enum.Finished]"
    />
  </PageTransition>

  <PageTransition :delay="250" class="mt-6">
    <RecentTournaments
      :section-label="$t('pages.watch.section_recent_tournaments')"
      :statuses="[e_tournament_status_enum.Finished]"
      status-variant="finished"
      :status-label="$t('common.finished')"
      order-direction="desc"
      horizontal
      hide-when-empty
      :limit="8"
    />
  </PageTransition>
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
