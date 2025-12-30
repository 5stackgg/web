<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import OtherMatches from "~/components/match/OtherMatches.vue";
import {
  e_match_status_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
</script>

<template>
  <PageHeading>
    <template #title>{{ $t("pages.watch.title") }}</template>
    <template #description>{{ $t("pages.watch.description") }}</template>
  </PageHeading>
  <Separator class="my-4" />

  <div
    v-if="liveTournaments && liveTournaments.length > 0"
    class="my-4 space-y-4"
  >
    <!-- @ts-expect-error - Type inference issues with GraphQL subscription data -->
    <TournamentTableRow
      v-for="tournament in liveTournaments"
      :key="tournament.id"
      :tournament="tournament"
    ></TournamentTableRow>
  </div>

  <Card class="p-4">
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
  </Card>

  <div id="pagination"></div>
</template>

<script lang="ts">
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import { mapFields } from "~/graphql/mapGraphql";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";

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
            {
              id: true,
              name: true,
              start: true,
              description: true,
              e_tournament_status: {
                description: true,
              },
              options: {
                type: true,
                best_of: true,
                map_pool: {
                  id: true,
                  type: true,
                  e_type: {
                    description: true,
                  },
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
                  match_options: {
                    type: true,
                    best_of: true,
                    map_pool: {
                      id: true,
                      type: true,
                      e_type: {
                        description: true,
                      },
                      maps: [{}, mapFields],
                    },
                  },
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
