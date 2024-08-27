<script setup lang="ts">
import MatchMapSelection from "~/components/match/MatchMapSelection.vue";
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchMaps from "~/components/match/MatchMaps.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import CheckIntoMatch from "~/components/match/CheckIntoMatch.vue";
import MatchLobbyChat from "~/components/match/MatchLobbyChat.vue";
</script>

<template>
  <template v-if="match">
    <div
      class="grid items-start gap-8 grid-cols-[1fr] lg:grid-cols-[minmax(320px,_400px)_1fr]"
    >
      <div class="grid grid-cols-1 gap-y-4">
        <CheckIntoMatch
          :match="match"
          v-if="match.can_check_in"
        ></CheckIntoMatch>
        <MatchInfo :match="match"></MatchInfo>
        <div>
          <MatchLobbyChat
            v-if="match.is_in_lineup || match.is_organizer || match.is_coach"
            :match-id="match.id"
            :messages="messages"
          ></MatchLobbyChat>
        </div>
      </div>
      <div class="grid gap-y-4">
        <div
          class="flex gap-4 justify-around flex-col lg:flex-row"
          v-if="match.match_maps.length > 0"
        >
          <div
            v-for="match_map of match.match_maps"
            class="max-h-[150px] md:max-h-[500px]"
          >
            <MatchMaps :match="match" :match-map="match_map"></MatchMaps>
          </div>
        </div>

        <div class="hidden lg:block">
          <MatchMapSelection :match="match"></MatchMapSelection>
        </div>

        <MatchTabs :match="match"></MatchTabs>
      </div>
    </div>
  </template>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { mapFields } from "~/graphql/mapGraphql";
import { matchLineups } from "~/graphql/matchLineupsGraphql";
import socket from "~/web-sockets/Socket";

export default {
  data() {
    return {
      messages: [],
      match: undefined,
      listeners: [],
    };
  },
  apollo: {
    $subscribe: {
      matches_by_pk: {
        variables: function () {
          return {
            matchId: this.$route.params.id,
            order_by_name: order_by.asc,
            order_by_kills: order_by.desc,
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
              region: true,
              is_coach: true,
              is_captain: true,
              is_in_lineup: true,
              is_organizer: true,
              can_start: true,
              can_schedule: true,
              can_check_in: true,
              is_tournament_match: true,
              can_cancel: true,
              can_assign_server: true,
              min_players_per_lineup: true,
              max_players_per_lineup: true,
              server_id: true,
              server_type: true,
              server_region: true,
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
              organizer: {
                name: true,
                steam_id: true,
                avatar_url: true,
              },
              options: {
                type: true,
                mr: true,
                best_of: true,
                coaches: true,
                tv_delay: true,
                map_veto: true,
                overtime: true,
                knife_round: true,
                number_of_substitutes: true,
                map_pool: {
                  type: true,
                  e_type: {
                    description: true,
                  },
                },
              },
              e_match_status: {
                description: true,
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
                  vetos: {
                    side: true,
                    type: true,
                    match_lineup_id: true,
                  },
                  status: true,
                  lineup_1_score: true,
                  lineup_2_score: true,
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
  created() {
    this.stopListeners();

    this.listeners.push(
      socket.listen("lobby:list", (data) => {
        if (data.matchId == this.matchId) {
          useMatchLobbyStore().set(this.matchId, data.lobby);
        }
      }),
    );

    this.listeners.push(
      socket.listen("lobby:joined", (data) => {
        if (data.matchId == this.matchId) {
          useMatchLobbyStore().add(this.matchId, data.user);
        }
      }),
    );

    this.listeners.push(
      socket.listen("lobby:left", (data) => {
        if (data.matchId == this.matchId) {
          useMatchLobbyStore().remove(this.matchId, data.user);
        }
      }),
    );

    this.listeners.push(
      socket.listen("lobby:messages", (data) => {
        if (data.matchId == this.matchId) {
          this.messages = data.messages.sort((a, b) => {
            return a.timestamp - b.timestamp;
          });
        }
      }),
    );
  },
  computed: {
    matchId() {
      return this.$route.params.id;
    },
  },
  mounted() {
    this.$watch(
      () => [
        this.match?.is_in_lineup,
        this.match?.is_rganizer,
        this.match?.is_coach,
      ],
      {
        immediate: true,
        handler() {
          if (
            this.match &&
            (this.match.is_in_lineup ||
              this.match.is_organizer ||
              this.match.is_coach)
          ) {
            socket.join("lobby", {
              matchId: this.matchId,
            });
          }
        },
      },
    );
  },
  methods: {
    stopListeners() {
      for (const listener of this.listeners) {
        listener.stop();
      }
    },
  },
  unmounted() {
    if (
      this.match &&
      (this.match.is_in_lineup ||
        this.match.is_organizer ||
        this.match.is_coach)
    ) {
      socket.leave("lobby", {
        matchId: this.matchId,
      });
    }
    this.stopListeners();
  },
};
</script>
