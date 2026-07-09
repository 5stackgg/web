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
import LiveStreamFeatureCard from "~/components/match/LiveStreamFeatureCard.vue";
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

  <PageTransition
    v-if="streamingMatches && streamingMatches.length > 0"
    :delay="115"
    class="mt-6"
  >
    <div>
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.watch.section_streaming_now") }}
      </div>
      <div class="space-y-3">
        <LiveStreamFeatureCard
          v-for="match in streamingMatches"
          :key="match.id"
          :match="match"
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
      :exclude-ids="streamingMatchIds"
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
      source="5stack"
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
import { NOT_LEAGUE_TOURNAMENT } from "~/graphql/tournamentFilters";
import { $, order_by } from "~/generated/zeus";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";

export default {
  data() {
    return {
      liveTournaments: [] as any[],
      streamingMatches: [] as any[],
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
                _and: [NOT_LEAGUE_TOURNAMENT],
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
      // Live matches with at least one stream attached. Lifted into the
      // featured "Streaming Now" section above so we can show a
      // thumbnail tile instead of a generic compact row.
      streamingMatches: {
        query: typedGql("subscription")({
          matches: [
            {
              where: {
                status: { _eq: $("status", "e_match_status_enum") },
                streams: {},
              },
              order_by: [{}, { started_at: order_by.desc }],
              limit: 6,
            },
            {
              ...simpleMatchFields,
              streams: [
                { order_by: [{ priority: order_by.asc }] },
                {
                  id: true,
                  link: true,
                  title: true,
                  is_game_streamer: true,
                },
              ],
              match_maps: [
                { order_by: [{ order: order_by.asc }] },
                {
                  id: true,
                  is_current_map: true,
                  lineup_1_score: true,
                  lineup_2_score: true,
                  winning_lineup_id: true,
                  map: { id: true, name: true, label: true },
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            status: e_match_status_enum.Live,
          };
        },
        result({ data }: any) {
          // Anti-cheat: never surface a live match's stream in the featured
          // "Streaming Now" area to its own players/coaches — they'd gain an
          // in-game advantage. Those matches still appear in "Live Matches"
          // below (MatchTableRow already hides the watch button for them).
          // Guests aren't in any lineup, so they still see the card (with the
          // "login to view" overlay).
          const rows = (data?.matches || []).filter(
            (m: any) =>
              (m.streams?.length ?? 0) > 0 && !m.is_in_lineup && !m.is_coach,
          );
          this.streamingMatches = rows;
        },
      },
    },
  },
  computed: {
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
    streamingMatchIds(): string[] {
      return (this.streamingMatches || []).map((m: any) => m.id);
    },
  },
};
</script>
