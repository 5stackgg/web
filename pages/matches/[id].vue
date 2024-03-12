<template>
  <template v-if="match">
    <div class="px-4 sm:px-6 lg:px-8">
      <div class="mt-5 lg:mt-16 grid lg:grid-cols-3 gap-8 lg:gap-12">
        <div class="lg:col-span-1">
          <h2
            class="font-bold text-2xl md:text-3xl text-gray-800 dark:text-gray-200"
          >
            {{ match.lineup_1.name }} vs {{ match.lineup_2.name }}
          </h2>
          <h3>{{ match.map }}</h3>
          <h4>{{ match.lineup_1.score }} - {{ match.lineup_2.score }}</h4>
          <h6 v-if="match.status != 'Finished'">
            <span
              class="text-purple-400 underline flex"
              v-if="match.connection_string"
            >
              <clip-board :data="match.connection_string"></clip-board>
              <a :href="`https://api.5stack.gg${match.connection_link}`">
                {{ match.connection_string }}
              </a>
            </span>
            <span v-else-if="!match.server_id" class="text-red-400 underline">
              Server has not been assigned
            </span>
            <span v-else> Server has been assigned. </span>
          </h6>
        </div>

        <div class="lg:col-span-2">
          <div class="grid sm:grid-cols-2 gap-8 md:gap-12">
            <div class="flex gap-x-5">
              <svg
                class="flex-shrink-0 mt-1 w-6 h-6 text-blue-600 dark:text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <div class="grow">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                  Match Status
                </h3>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                  <template v-if="match.status == 'Finished'">
                    Match Finished @ {{ endOfMatch }}
                  </template>
                  <template v-else-if="match.status == 'Warmup'">
                    Warmups
                  </template>
                  <template v-else-if="match.status == 'Knife'"> </template>
                  <template v-else-if="match.status == 'Scheduled'">
                    Match is Scheduled for
                    <template v-if="match.scheduled_at">
                      <time-ago :date="match.scheduled_at"></time-ago>
                    </template>
                    <template v-else> ASAP </template>
                  </template>
                  <template v-else-if="startOfMatch">
                    Match has been going on for
                    <time-ago :date="startOfMatch"></time-ago>
                  </template>
                  <template v-else>
                    {{ match.status }}
                  </template>
                </p>
              </div>
            </div>

            <div class="flex gap-x-5">
              <svg
                class="flex-shrink-0 mt-1 w-6 h-6 text-blue-600 dark:text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <div class="grow">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                  {{ match.type }}
                </h3>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                  First to {{ match.mr + 1 }} with
                  <template v-if="match.overtime">overtime</template>
                </p>
              </div>
            </div>

            <div class="flex gap-x-5">
              <svg
                class="flex-shrink-0 mt-1 w-6 h-6 text-blue-600 dark:text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="18" height="10" x="3" y="11" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" x2="8" y1="16" y2="16" />
                <line x1="16" x2="16" y1="16" y2="16" />
              </svg>
              <div class="grow">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                  Captains:
                </h3>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                  Captain 1:
                  <captain-info
                    :captain="match.lineup_1.captain"
                  ></captain-info>
                  <br />
                  Captain 2:
                  <captain-info
                    :captain="match.lineup_2.captain"
                  ></captain-info>
                </p>
              </div>
            </div>

            <div class="flex gap-x-5">
              <svg
                class="flex-shrink-0 mt-1 w-6 h-6 text-blue-600 dark:text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M7 10v12" />
                <path
                  d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"
                />
              </svg>
              <div class="grow" v-if="match.knife_round">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
                  Knife Round
                </h3>
                <p class="mt-1 text-gray-600 dark:text-gray-400">
                  <template v-if="match.knife_round_winner">
                    {{ match.knife_round_winner.name }} won knife round. Picked
                    {{ match.knife_round_winner.starting_side }}.
                  </template>
                  <template v-else>
                    Knife Round has not been finished.
                  </template>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <hr class="mt-8 mb-8 border-gray-600" />

    <div
      class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto"
      v-if="
        match.status === 'PickingPlayers' &&
        match.organizer_steam_id == me.steam_id
      "
    >
      <h1>Assign lineups</h1>

      <div class="grid md:grid-cols-2 gap-12">
        <div
          class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
        >
          <form @submit.prevent.stop>
            <five-stack-search-input
              label="Team 1"
              placeholder="Find Player"
              v-model="form.lineup_1"
              :search="searchPlayers"
            ></five-stack-search-input>
          </form>
        </div>

        <div
          class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
        >
          <form @submit.prevent.stop>
            <five-stack-search-input
              label="Team 2"
              placeholder="Find Player"
              v-model="form.lineup_2"
              :search="searchPlayers"
            ></five-stack-search-input>
          </form>
        </div>
      </div>
    </div>

    TODO - add round breakdown as we are already going by it

    <tabs>
      <tab title="Overview">
        <lineup-overview
          :match="match"
          :lineup="match.lineup_1"
        ></lineup-overview>
        <br />
        <lineup-overview
          :match="match"
          :lineup="match.lineup_2"
        ></lineup-overview>
      </tab>
      <tab title="Utility">
        <lineup-utility
          :match="match"
          :lineup="match.lineup_1"
        ></lineup-utility>
        <br />
        <lineup-utility
          :match="match"
          :lineup="match.lineup_2"
        ></lineup-utility>
      </tab>
      <tab title="Opening Duels">
        <lineup-opening-duels
          :match="match"
          :lineup="match.lineup_1"
        ></lineup-opening-duels>
        <br />
        <lineup-opening-duels
          :match="match"
          :lineup="match.lineup_2"
        ></lineup-opening-duels>
      </tab>
      <tab title="Clutches"> </tab>
    </tabs>
  </template>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import CaptainInfo from "~/components/CaptainInfo.vue";
import Tab from "~/components/tabs/Tab.vue";
import FiveStackSearchInput from "~/components/forms/FiveStackSearchInput.vue";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import LineupOverview from "~/components/match-details/LineupOverview.vue";
import LineupMember from "~/components/match-details/LineupMember.vue";
import LineupUtility from "~/components/match-details/LineupUtility.vue";
import LineupOpeningDuels from "~/components/match-details/LineupOpeningDuels.vue";
import ClipBoard from "~/components/ClipBoard.vue";

export default {
  components: {
    ClipBoard,
    LineupOpeningDuels,
    LineupUtility,
    LineupMember,
    LineupOverview,
    FiveStackSearchInput,
    Tab,
    CaptainInfo,
  },
  data() {
    return {
      match: undefined,
      form: {
        lineup_1: undefined,
        lineup_2: undefined,
      },
    };
  },
  apollo: {
    $subscribe: {
      matches_by_pk: {
        query: typedGql("subscription")({
          matches_by_pk: [
            {
              id: $("matchId", "uuid!"),
            },
            {
              id: true,
              map: true,
              server_id: true,
              overtime: true,
              knife_round: true,
              mr: true,
              organizer_steam_id: true,
              connection_string: true,
              connection_link: true,
              status: true,
              type: true,
              scheduled_at: true,
              knife_round_winner: {
                name: true,
                starting_side: true,
              },
              lineup_1: {
                id: true,
                name: true,
                score: true,
                captain: {
                  placeholder_name: true,
                  player: {
                    name: true,
                    steam_id: true,
                  },
                },
                lineup_players: [
                  {},
                  {
                    captain: true,
                    steam_id: true,
                    player: {
                      name: true,
                      steam_id: true,
                      kills_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              count: true,
                            },
                          ],
                        },
                      ],
                      assists_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              count: true,
                            },
                          ],
                        },
                      ],
                      damage_dealt_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              sum: {
                                damage: true,
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
              lineup_2: {
                id: true,
                name: true,
                score: true,
                captain: {
                  placeholder_name: true,
                  player: {
                    name: true,
                    steam_id: true,
                  },
                },
                lineup_players: [
                  {},
                  {
                    captain: true,
                    steam_id: true,
                    player: {
                      name: true,
                      steam_id: true,
                      kills_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              count: true,
                            },
                          ],
                        },
                      ],
                      assists_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              count: true,
                            },
                          ],
                        },
                      ],
                      damage_dealt_aggregate: [
                        {
                          where: {
                            match_id: {
                              _eq: $("matchId", "uuid!"),
                            },
                          },
                        },
                        {
                          aggregate: [
                            {},
                            {
                              sum: {
                                damage: true,
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
              rounds: [
                {},
                {
                  round: true,
                  team_1_score: true,
                  team_2_score: true,
                  created_at: true,
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            matchId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.match = data.matches_by_pk;
        },
      },
    },
  },
  watch: {
    ["form.lineup_1"]: {
      handler(member) {
        if (member) {
          this.form.lineup_1 = undefined;
          this.addMember(member.value.steam_id, this.match.lineup_1.id);
        }
      },
    },
    ["form.lineup_2"]: {
      handler(member) {
        if (member) {
          this.form.lineup_2 = undefined;
          this.addMember(member.value.steam_id, this.match.lineup_2.id);
        }
      },
    },
  },
  methods: {
    async searchPlayers(query) {
      const { data } = await this.$apollo.query({
        query: generateQuery({
          players: [
            {
              where: {
                ...(/^[0-9]+$/.test(query)
                  ? {
                      steam_id: {
                        _eq: $("playerSteamIdQuery", "bigint"),
                      },
                    }
                  : {
                      name: {
                        _ilike: $("playerQuery", "String"),
                      },
                    }),
              },
            },
            {
              name: true,
              steam_id: true,
              avatar_url: true,
            },
          ],
        }),
        variables: {
          playerQuery: `%${query}%`,
          playerSteamIdQuery: query,
        },
      });

      return (
        data.players
          // .filter((player) => {
          //   return (
          //       this.form.players.lineup_1.indexOf(player) === -1 ||
          //       this.form.players.lineup_2.indexOf(player) === -1
          //   );
          // })
          .map((player) => {
            return {
              value: player,
              display: `<img class="inline-block h-[2.875rem] w-[2.875rem] rounded-lg"src="${player.avatar_url}"> ${player.name} <small>[${player.steam_id}]</small>`,
            };
          })
      );
    },
    async addMember(steam_id: bigint, match_lineup_id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_match_lineup_players_one: [
            {
              object: {
                steam_id,
                match_lineup_id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    startOfMatch() {
      return this.match?.rounds?.[0]?.created_at;
    },
    endOfMatch() {
      let lastRound =
        this.match?.rounds?.[this.match?.rounds.length - 1].created_at;
      if (lastRound) {
        return new Date(lastRound).toLocaleString();
      }
    },
  },
};
</script>
