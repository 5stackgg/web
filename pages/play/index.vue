<script setup lang="ts">
import MyUpcoming from "~/components/MyUpcoming.vue";
import Matchmaking from "~/components/matchmaking/Matchmaking.vue";
import OpenMatches from "~/components/match/OpenMatches.vue";
import CustomMatch from "~/components/CustomMatch.vue";
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
</script>

<template>
  <PageTransition>
    <div>
      <template v-if="matchmakingAllowed">
        <Matchmaking></Matchmaking>
        <Separator v-if="showSeparators" class="my-4" />
      </template>
      <template v-else-if="canCreateMatch">
        <CustomMatch class="bg-card p-8 rounded-lg" />
      </template>
    </div>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <MyUpcoming></MyUpcoming>
  </PageTransition>

  <PageTransition :delay="200" class="mt-6">
    <div v-if="openRegistrationTournaments?.length > 0" class="p-4">
      <CardHeader>
        <CardTitle>{{
          $t("pages.play.open_registration_tournaments.title")
        }}</CardTitle>
        <CardDescription>
          {{ $t("pages.play.open_registration_tournaments.description") }}
        </CardDescription>
      </CardHeader>
      <TournamentTableRow
        v-for="tournament of openRegistrationTournaments"
        :key="tournament.id"
        :tournament="tournament"
      ></TournamentTableRow>
    </div>
  </PageTransition>

  <Separator v-if="openRegistrationTournaments?.length > 0 && showSeparators" class="my-4" />

  <PageTransition :delay="300" class="mt-6">
    <div>
      <div class="mb-2">
        <div class="text-xl font-semibold">
          {{ $t("pages.play.open_matches.title") }}
        </div>
        <div class="text-muted-foreground text-sm">
          {{ $t("pages.play.open_matches.description") }}
        </div>
      </div>
      <OpenMatches />
    </div>
  </PageTransition>

  <div id="pagination"></div>
</template>

<script lang="ts">
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { mapFields } from "~/graphql/mapGraphql";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      openRegistrationTournaments: [],
    };
  },
  apollo: {
    $subscribe: {
      openRegistrationTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              where: {
                status: {
                  _eq: e_tournament_status_enum.RegistrationOpen,
                },
                _not: {
                  rosters: {
                    player_steam_id: {
                      _eq: $("steam_id", "bigint!"),
                    },
                  },
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
            steam_id: useAuthStore().me?.steam_id,
          };
        },
        result({ data }: { data: { tournaments: any[] } }) {
          this.openRegistrationTournaments = data.tournaments;
        },
        skip: function () {
          return !useAuthStore().me?.steam_id;
        },
      },
    },
  },
  computed: {
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    me() {
      return useAuthStore().me;
    },
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
    matchmakingAllowed() {
      return useApplicationSettingsStore().matchmakingAllowed;
    },
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
  },
};
</script>
