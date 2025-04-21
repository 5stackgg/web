<script setup lang="ts">
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchMaps from "~/components/match/MatchMaps.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import CheckIntoMatch from "~/components/match/CheckIntoMatch.vue";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import JoinMatch from "~/components/match/JoinMatch.vue";
import { e_match_status_enum } from "~/generated/zeus";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import ScheduleMatch from "~/components/match/ScheduleMatch.vue";
</script>

<template>
  <div
    class="grid items-start gap-8 grid-cols-1 lg:grid-cols-[minmax(320px,_400px)_1fr]"
    v-if="match"
  >
    <div class="grid grid-cols-1 gap-y-4">
      <Card v-if="match.can_schedule">
        <CardHeader class="p-4">
          <CardTitle class="flex justify-between">{{
            $t("pages.matches.detail.schedule")
          }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-col space-y-4">
            <template v-if="match.can_schedule">
              <ScheduleMatch :match="match" />
            </template>
          </div>
        </CardContent>
      </Card>

      <CheckIntoMatch :match="match"></CheckIntoMatch>
      <JoinMatch :match="match"></JoinMatch>
      <MatchInfo :match="match"></MatchInfo>
      <ChatLobby
        instance="matches/id"
        type="match"
        :lobby-id="match.id"
        v-if="canJoinLobby"
      />
    </div>

    <div class="grid grid-cols-1 gap-y-4">
      <template
        v-if="
          match.match_maps.length > 0 &&
          match.status !== e_match_status_enum.Veto
        "
      >
        <div class="flex gap-4 justify-around flex-col 2xl:flex-row">
          <div
            v-for="match_map of match.match_maps"
            class="max-h-[150px] md:max-h-[250px] lg:max-h-[350px]"
          >
            <MatchMaps :match="match" :match-map="match_map"></MatchMaps>
          </div>
        </div>

        <Separator />
      </template>

      <MatchRegionVeto :match="match"></MatchRegionVeto>
      <MatchMapVeto
        :match="match"
        v-if="match.region && match.options.map_veto"
      ></MatchMapVeto>

      <MatchTabs :match="match"></MatchTabs>
    </div>
  </div>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { mapFields } from "~/graphql/mapGraphql";
import { matchLineups } from "~/graphql/matchLineupsGraphql";
import { playerFields } from "~/graphql/playerFields";

export default {
  data() {
    return {
      match: undefined,
    };
  },
  apollo: {
    $subscribe: {
      matches_by_pk: {
        variables: function () {
          return {
            matchId: this.$route.params.id,
            order_by_name: order_by.asc,
            order_by_round_kills: order_by.asc,
            order_by_round: order_by.asc,
          };
        },
        query: typedGql("subscription")({
          matches_by_pk: [
            {
              id: $("matchId", "uuid!"),
            },
            {
              id: true,
              status: true,
              invite_code: true,
              e_match_status: {
                description: true,
              },
              region: true,
              e_region: {
                description: true,
              },
              is_coach: true,
              is_captain: true,
              is_in_lineup: true,
              is_organizer: true,
              can_start: true,
              can_schedule: true,
              can_check_in: true,
              requested_organizer: true,
              is_tournament_match: true,
              can_cancel: true,
              can_assign_server: true,
              min_players_per_lineup: true,
              max_players_per_lineup: true,
              server_id: true,
              server_type: true,
              server_region: true,
              is_server_online: true,
              lineup_1_id: true,
              lineup_2_id: true,
              winning_lineup_id: true,
              map_veto_type: true,
              map_veto_picking_lineup_id: true,
              region_veto_picking_lineup_id: true,
              connection_link: true,
              connection_string: true,
              tv_connection_string: true,
              tv_connection_link: true,
              is_match_server_available: true,
              cancels_at: true,
              scheduled_at: true,
              ended_at: true,
              organizer: playerFields,
              options: {
                id: true,
                type: true,
                mr: true,
                best_of: true,
                coaches: true,
                tv_delay: true,
                map_veto: true,
                region_veto: true,
                overtime: true,
                knife_round: true,
                number_of_substitutes: true,
                timeout_setting: true,
                tech_timeout_setting: true,
                ready_setting: true,
                lobby_access: true,
                map_pool: {
                  type: true,
                  e_type: {
                    description: true,
                  },
                  maps: [{}, mapFields],
                },
              },
              region_veto_picks: {
                type: true,
                region: true,
              },
              match_maps: [
                {
                  order_by: {
                    order: order_by.asc,
                  },
                },
                {
                  id: true,
                  order: true,
                  lineup_1_side: true,
                  lineup_2_side: true,
                  map: mapFields,
                  is_current_map: true,
                  demos_total_size: true,
                  demos_download_url: true,
                  status: true,
                  lineup_1_score: true,
                  lineup_2_score: true,
                  winning_lineup_id: true,
                  vetos: {
                    side: true,
                    type: true,
                    match_lineup_id: true,
                  },
                  rounds: [
                    {
                      order_by: {
                        round: $("order_by_round", "order_by"),
                      },
                    },
                    {
                      lineup_1_score: true,
                      lineup_2_score: true,
                      lineup_1_side: true,
                      lineup_2_side: true,
                      winning_side: true,
                      round: true,
                      kills: [
                        {
                          order_by: {
                            time: $("order_by_round_kills", "order_by"),
                          },
                        },
                        {
                          player: {
                            steam_id: true,
                          },
                          attacked_player: {
                            steam_id: true,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
              lineup_1: [{}, matchLineups],
              lineup_2: [{}, matchLineups],
            },
          ],
        }),
        result: function ({ data }) {
          this.match = data.matches_by_pk;
        },
      },
    },
  },
  computed: {
    matchId() {
      return this.$route.params.id;
    },
    canJoinLobby() {
      if (!this.match) {
        return false;
      }

      return (
        this.match.is_in_lineup ||
        this.match.is_organizer ||
        this.match.is_coach
      );
    },
  },
};
</script>
