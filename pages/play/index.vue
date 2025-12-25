<script setup lang="ts">
import MyUpcoming from "~/components/MyUpcoming.vue";
import Matchmaking from "~/components/matchmaking/Matchmaking.vue";
import OpenMatches from "~/components/match/OpenMatches.vue";
import CustomMatch from "~/components/CustomMatch.vue";
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="matchmakingAllowed">
      <Matchmaking></Matchmaking>
      <Separator class="my-4" />
    </template>
    <template v-else-if="canCreateMatch">
      <CustomMatch class="bg-card p-8 rounded-lg" />
    </template>

    <MyUpcoming></MyUpcoming>

    <Card class="p-4" v-if="openRegistrationTournaments?.length > 0">
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
    </Card>

    <Card class="p-4">
      <CardHeader>
        <CardTitle>{{ $t("pages.play.open_matches.title") }}</CardTitle>
        <CardDescription>
          {{ $t("pages.play.open_matches.description") }}
        </CardDescription>
      </CardHeader>
      <OpenMatches> </OpenMatches>
    </Card>

    <div id="pagination"></div>
  </div>
</template>

<script lang="ts">
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { mapFields } from "~/graphql/mapGraphql";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";

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
            {
              id: true,
              name: true,
              start: true,
              e_tournament_status: {
                description: true,
              },
              options: {
                type: true,
                map_pool: {
                  maps: [{}, mapFields],
                },
              },
              stages: [
                {
                  order_by: [
                    {
                      order: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  type: true,
                  e_tournament_stage_type: {
                    description: true,
                  },
                  order: true,
                },
              ],
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ],
            },
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
