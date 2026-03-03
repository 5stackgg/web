<script setup lang="ts">
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchMaps from "~/components/match/MatchMaps.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import CheckIntoMatch from "~/components/match/CheckIntoMatch.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";
import {
  e_match_status_enum,
  e_player_roles_enum,
  e_lobby_access_enum,
} from "~/generated/zeus";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import ScheduleMatch from "~/components/match/ScheduleMatch.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { CardContent } from "~/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import { useAuthStore } from "~/stores/AuthStore";
</script>

<template>
  <div
    class="grid items-start gap-4 md:gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-[minmax(320px,_400px)_1fr]"
    v-if="match"
  >
    <div class="grid grid-cols-1 gap-y-4 md:gap-y-6">
      <PageTransition>
        <ScheduleMatch :match="match" v-if="match.can_schedule" />
      </PageTransition>

      <PageTransition :delay="100">
        <div class="flex flex-col gap-4">
          <CheckIntoMatch :match="match"></CheckIntoMatch>
          <QuickMatchConnect :match="match"></QuickMatchConnect>
          <MatchInfo :match="match"></MatchInfo>
        </div>
      </PageTransition>

      <PageTransition :delay="200">
        <ChatLobby
          class="max-h-96"
          instance="matches/id"
          type="match"
          :lobby-id="match.id"
          :play-notification-sound="match.status !== e_match_status_enum.Live"
          v-if="canJoinLobby"
        />
      </PageTransition>
    </div>

    <div class="grid grid-cols-1 gap-y-4 md:gap-y-6">
      <PageTransition>
        <div
          class="flex gap-4 flex-col 2xl:flex-row 2xl:items-start"
          v-if="
            (match.match_maps.length > 0 &&
              match.status !== e_match_status_enum.Veto) ||
            (showLiveStreams && match.streams.length > 0)
          "
        >
          <div
            v-if="showLiveStreams && match.streams.length > 0"
            class="flex w-full min-w-0 flex-col gap-4 2xl:min-w-[320px] 2xl:flex-1 2xl:max-w-[600px]"
          >
            <StreamEmbed :streams="match.streams" />
          </div>
          <div
            v-if="
              match.match_maps.length > 0 &&
              match.status !== e_match_status_enum.Veto
            "
            class="flex min-w-0 flex-1 flex-col gap-4 justify-around 2xl:flex-row"
          >
            <div v-for="match_map of match.match_maps">
              <MatchMaps :match="match" :match-map="match_map"></MatchMaps>
            </div>
          </div>
        </div>
      </PageTransition>

      <Separator
        v-if="
          showSeparators &&
          match.match_maps.length > 0 &&
          match.status !== e_match_status_enum.Veto
        "
      />

      <PageTransition :delay="100">
        <template
          v-if="
            regions.length === 0 && match.options.region_veto && !match.region
          "
        >
          <Alert variant="destructive" class="bg-red-600 text-white max-w-md">
            <AlertTitle>{{
              $t("match.region_veto.no_regions_available")
            }}</AlertTitle>
            <AlertDescription>
              {{ $t("match.region_veto.no_regions_available_description") }}
            </AlertDescription>
          </Alert>
        </template>
      </PageTransition>

      <PageTransition :delay="100">
        <MatchRegionVeto :match="match"></MatchRegionVeto>
      </PageTransition>

      <PageTransition :delay="100">
        <MatchMapVeto :match="match"></MatchMapVeto>
      </PageTransition>
    </div>

    <PageTransition :delay="200" class="lg:col-span-2">
      <CardContent class="p-4">
        <MatchTabs :match="match"></MatchTabs>
      </CardContent>
    </PageTransition>
  </div>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { mapFields } from "~/graphql/mapGraphql";
import { matchLineups } from "~/graphql/matchLineupsGraphql";
import { playerFields } from "~/graphql/playerFields";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { useMatchContext } from "~/composables/useMatchContext";

export default {
  unmounted() {
    useMatchContext().value = null;
  },
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
              label: true,
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
              is_match_server_available: true,
              cancels_at: true,
              scheduled_at: true,
              ended_at: true,
              organizer: playerFields,
              options: {
                lobby_access: true,
                ...matchOptionsFields,
              },
              tournament_brackets: [
                { limit: 1 },
                {
                  stage: {
                    tournament: {
                      id: true,
                      name: true,
                    },
                  },
                },
              ],
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
                  demos: {
                    size: true,
                    download_url: true,
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
                      has_backup_file: true,
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
              streams: [
                {
                  order_by: [
                    {
                      priority: order_by.asc,
                    },
                    {
                      title: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  link: true,
                  title: true,
                  priority: true,
                },
              ],
            },
          ],
        }),
        result: function ({ data }) {
          this.match = data.matches_by_pk;

          const match = data.matches_by_pk;
          if (match) {
            const mc = useMatchContext();
            const displayText =
              match.label ||
              `${match.lineup_1?.name ?? "TBD"} vs ${match.lineup_2?.name ?? "TBD"}`;
            const tournament =
              match.tournament_brackets?.[0]?.stage?.tournament;
            mc.value = {
              id: match.id,
              displayText,
              ...(tournament
                ? { tournament: { id: tournament.id, name: tournament.name } }
                : {}),
            };
          }
        },
      },
    },
  },
  computed: {
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    matchId() {
      return this.$route.params.id;
    },
    regions() {
      return useApplicationSettingsStore().availableRegions.filter((region) => {
        return region.is_lan === false;
      });
    },
    canJoinLobby() {
      if (!this.match) {
        return false;
      }

      if (
        ![
          e_match_status_enum.Live,
          e_match_status_enum.PickingPlayers,
          e_match_status_enum.Scheduled,
          e_match_status_enum.Veto,
          e_match_status_enum.WaitingForCheckIn,
          e_match_status_enum.WaitingForServer,
        ].includes(this.match.status)
      ) {
        return false;
      }

      return (
        this.match.is_in_lineup ||
        this.match.is_organizer ||
        this.match.is_coach
      );
    },
    showLiveStreams() {
      if (
        [
          e_match_status_enum.Finished,
          e_match_status_enum.Forfeit,
          e_match_status_enum.Surrendered,
          e_match_status_enum.Tie,
          e_match_status_enum.Canceled,
        ].includes(this.match?.status)
      ) {
        if (this.match?.ended_at) {
          const allowExtraTime = new Date(this.match.ended_at);
          allowExtraTime.setMinutes(allowExtraTime.getMinutes() + 10);

          if (allowExtraTime > new Date()) {
            return true;
          }
        }

        return false;
      }

      return true;
    },
  },
};
</script>
