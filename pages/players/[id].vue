<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { e_player_roles_enum } from "~/generated/zeus";
import LastTenWinsAndLosses from "~/components/charts/LastTenWinsAndLosses.vue";
import PlayerEloChart from "~/components/charts/PlayerEloChart.vue";
import formatStatValue from "~/utilities/formatStatValue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import PlayerChangeName from "~/components/PlayerChangeName.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import { kdrStrokeColor } from "~/utilities/kdrColor";
import { PlayIcon, MoreHorizontal } from "lucide-vue-next";
import { useSidebar } from "~/components/ui/sidebar/utils";
import RadialStat from "~/components/charts/RadialStat.vue";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";

definePageMeta({
  alias: ["/me"],
});

const { isMobile } = useSidebar();
</script>

<template>
  <div class="flex-grow flex flex-col gap-6" v-if="player">
    <!-- Header Section with Fade In -->
    <Transition
      appear
      enter-active-class="transition-all duration-600 ease-out"
      enter-from-class="opacity-0 translate-y-5"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-600 ease-out"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-5"
    >
      <PageHeading>
        <template #title>
          <div class="flex items-center justify-center gap-4">
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <PlayerChangeName :player="player" class="hidden sm:flex" />
                <PlayerSanctions :playerId="playerId" class="hidden sm:flex" />
              </div>
              <div class="flex items-center gap-4">
                <PlayerDisplay
                  :player="player"
                  size="xl"
                  :show-steam-id="true"
                  v-if="player"
                />
                <a
                  v-if="player?.profile_url"
                  :href="player.profile_url"
                  target="_blank"
                  class="flex items-center justify-center p-2 rounded-md border border-border bg-background hover:bg-accent/50 hover:scale-110 transition-all duration-200"
                  title="View Steam Profile"
                >
                  <SteamIcon class="size-5 fill-foreground" />
                </a>
              </div>
              <div
                v-if="player?.teams && player.teams.length > 0"
                class="flex flex-wrap gap-2 mt-2"
              >
                <NuxtLink
                  v-for="(team, index) in player.teams"
                  :key="team.id"
                  :to="`/teams/${team.id}`"
                  :style="{ animationDelay: `${index * 50}ms` }"
                  class="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/50 hover:shadow-lg hover:scale-105 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="w-2 h-2 rounded-full bg-primary/60 group-hover:bg-primary group-hover:animate-pulse transition-colors"
                    ></div>
                    <span
                      class="font-medium text-sm text-foreground group-hover:text-primary transition-colors"
                    >
                      {{ team.name }}
                    </span>
                    <span
                      v-if="team.short_name"
                      class="text-xs text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded"
                    >
                      {{ team.short_name }}
                    </span>
                  </div>
                </NuxtLink>
              </div>
            </div>
          </div>
        </template>

        <template #actions>
          <div class="md:hidden">
            <!-- Mobile: Show dropdown menu with actions -->
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="outline" size="sm">
                  <MoreHorizontal class="w-4 h-4 mr-1" />
                  <span class="text-xs">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div class="p-1">
                  <PlayerChangeName :player="player" />
                </div>
                <template v-if="canSanction">
                  <div class="p-1">
                    <SanctionPlayer :player="player" />
                  </div>
                  <div class="p-1">
                    <PlayerRoleForm :player="player" />
                  </div>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <!-- Desktop: Show sanction and role buttons -->
          <template v-if="canSanction">
            <div class="hidden sm:flex items-center gap-2">
              <SanctionPlayer :player="player" />
              <PlayerRoleForm :player="player" />
            </div>
          </template>

          <div class="items-center gap-2 hidden md:flex">
            <NuxtLink to="/play" v-if="me && player.steam_id === me.steam_id">
              <Button
                variant="default"
                :size="isMobile ? 'default' : 'lg'"
                class="shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold group"
              >
                <PlayIcon
                  class="w-5 h-5 group-hover:rotate-12 transition-transform duration-300"
                />
                <span class="hidden md:inline ml-2">{{
                  $t("pages.players.detail.play_a_match")
                }}</span>
              </Button>
            </NuxtLink>
          </div>
        </template>
      </PageHeading>
    </Transition>

    <div class="flex flex-col gap-6" v-if="player">
      <!-- Stats and Elo Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Performance Stats -->
        <Transition
          appear
          enter-active-class="transition-all duration-600 ease-out delay-100"
          enter-from-class="opacity-0 translate-y-5"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-600 ease-out"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-5"
        >
          <Card class="flex flex-col h-full">
            <CardContent class="flex-1 p-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                <!-- Win Rate Column -->
                <div class="flex flex-col items-center justify-center gap-4">
                  <RadialStat
                    :value="winPercentage.toFixed(0) + '%'"
                    :percentage="winPercentage"
                    :label="$t('pages.players.detail.win_rate')"
                    :stroke-color="
                      winPercentage >= 50
                        ? 'hsl(142, 71%, 45%)'
                        : 'hsl(0, 84%, 60%)'
                    "
                  />
                  <div class="flex items-center gap-4">
                    <div class="flex flex-col items-center group/stat">
                      <span
                        class="text-xl md:text-lg lg:text-2xl font-bold text-green-500 group-hover/stat:scale-110 transition-transform duration-300"
                        >{{ player.wins || 0 }}</span
                      >
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                        >{{ $t("pages.players.detail.wins") }}</span
                      >
                    </div>
                    <div
                      class="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-border to-transparent"
                    ></div>
                    <div class="flex flex-col items-center group/stat">
                      <span
                        class="text-xl md:text-lg lg:text-2xl font-bold text-red-500 group-hover/stat:scale-110 transition-transform duration-300"
                        >{{ player.losses || 0 }}</span
                      >
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                        >{{ $t("pages.players.detail.losses") }}</span
                      >
                    </div>
                  </div>
                </div>

                <!-- K/D Column -->
                <div class="flex flex-col items-center justify-center gap-4">
                  <RadialStat
                    :value="kd"
                    :percentage="kdPercentage"
                    :label="$t('pages.players.detail.kd')"
                    :stroke-color="kdrStrokeColor(Number(kd))"
                  />
                  <div
                    class="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-2 gap-y-3"
                  >
                    <template
                      v-for="(stat, index) in combatStats"
                      :key="stat.key"
                    >
                      <div class="flex flex-col items-center group/stat">
                        <span
                          class="text-lg md:text-base lg:text-xl font-bold group-hover/stat:scale-110 transition-transform duration-300"
                          :class="stat.colorClass"
                        >
                          {{ stat.value }}
                        </span>
                        <span
                          class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                          >{{ stat.label }}</span
                        >
                      </div>
                      <div
                        v-if="index < combatStats.length - 1"
                        class="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-border to-transparent"
                      ></div>
                    </template>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Transition>

        <!-- Elo History Chart -->
        <Transition
          appear
          enter-active-class="transition-all duration-600 ease-out delay-200"
          enter-from-class="opacity-0 translate-y-5"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-600 ease-out"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-5"
        >
          <Card class="flex flex-col h-full" v-if="player?.elo_history">
            <CardHeader>
              <CardTitle
                class="text-lg md:text-base lg:text-xl font-bold text-center"
              >
                {{ $t("pages.players.detail.elo_history") }}
              </CardTitle>
            </CardHeader>
            <CardContent
              class="flex-1 min-h-[200px] sm:min-h-[250px] md:min-h-[300px]"
            >
              <template v-if="player.elo_history.length > 0">
                <PlayerEloChart :elo-history="player.elo_history" />
              </template>
              <template v-else>
                <div
                  class="flex justify-center items-center h-full uppercase text-muted-foreground text-center flex-col"
                >
                  {{ $t("pages.players.detail.no_elo_history") }}
                  <NuxtLink v-if="me" to="/play" class="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      class="hover:scale-105 transition-transform"
                      >{{ $t("pages.players.detail.play_a_match") }}</Button
                    >
                  </NuxtLink>
                </div>
              </template>
            </CardContent>
          </Card>
        </Transition>
      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Recent Wins/Losses -->
        <Transition
          appear
          enter-active-class="transition-all duration-600 ease-out delay-300"
          enter-from-class="opacity-0 translate-y-5"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-600 ease-out"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-5"
        >
          <Card class="flex flex-col h-full">
            <CardHeader>
              <CardTitle
                class="text-lg md:text-base lg:text-xl font-bold text-center"
              >
                {{ $t("pages.players.detail.recent_wins_and_losses") }}
              </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col h-full">
              <LastTenWinsAndLosses
                class="max-h-[250px] sm:max-h-[300px] md:max-h-[375px] w-full flex-grow"
                :steam_id="playerId"
              />
            </CardContent>
          </Card>
        </Transition>

        <!-- Weapon Kills -->
        <Transition
          appear
          enter-active-class="transition-all duration-600 ease-out delay-500"
          enter-from-class="opacity-0 translate-y-5"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-600 ease-out"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-5"
        >
          <Card class="flex flex-col h-full">
            <CardHeader>
              <CardTitle
                class="text-lg md:text-base lg:text-xl font-bold text-center"
              >
                {{ $t("pages.players.detail.weapon_kills") }}
              </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col h-full">
              <div
                v-if="
                  !player?.kills_by_weapons ||
                  player.kills_by_weapons.length === 0
                "
                class="text-center py-8 flex-grow flex items-center justify-center"
              >
                <p class="text-sm md:text-base text-muted-foreground">
                  {{ $t("pages.players.detail.no_weapon_kills") }}
                </p>
              </div>
              <div
                v-else
                class="overflow-hidden rounded-lg border border-border/50"
              >
                <table class="w-full">
                  <tbody>
                    <tr
                      v-for="(weapon, index) in player.kills_by_weapons"
                      :key="index"
                      :style="{ animationDelay: `${index * 50}ms` }"
                      class="border-b border-border/30 hover:bg-muted/50 hover:scale-[1.02] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 group/row"
                    >
                      <td class="p-3 flex items-center gap-3">
                        <template
                          v-if="weapon.with && weapon.with !== 'unknown'"
                        >
                          <div class="relative">
                            <img
                              :src="`/img/equipment/${getWeaponImageName(weapon.with)}.svg`"
                              :alt="weapon.with"
                              class="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 group-hover/row:scale-110 transition-transform duration-300"
                              @error="handleImageError"
                              :title="weapon.with"
                            />
                          </div>
                        </template>
                        <span v-else class="font-medium">{{
                          weapon.with
                        }}</span>
                      </td>
                      <td class="p-3 text-right">
                        <span
                          class="font-bold text-lg group-hover/row:text-primary transition-colors"
                        >
                          {{ weapon.kill_count }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </Transition>
      </div>
    </div>

    <!-- Matches/Tournaments Section -->
    <Transition
      appear
      enter-active-class="transition-all duration-600 ease-out delay-500"
      enter-from-class="opacity-0 translate-y-5"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-600 ease-out"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-5"
    >
      <Card class="p-4">
        <Tabs default-value="matches">
          <TabsList class="grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger
              value="matches"
              class="transition-all duration-300 data-[state=active]:shadow-lg"
              >{{ $t("pages.players.detail.matches") }}</TabsTrigger
            >
            <TabsTrigger
              value="tournaments"
              class="transition-all duration-300 data-[state=active]:shadow-lg"
              >{{ $t("pages.players.detail.tournaments") }}</TabsTrigger
            >
          </TabsList>

          <TabsContent value="matches">
            <CardHeader>
              <CardTitle class="text-xl font-bold">
                {{ $t("pages.players.detail.matches") }}
              </CardTitle>
            </CardHeader>
            <CardContent class="p-0">
              <MatchesTable
                :player="player"
                :matches="playerWithMatches?.matches"
                v-if="playerWithMatches?.matches"
              ></MatchesTable>
            </CardContent>
            <Pagination
              :page="page"
              :per-page="perPage"
              @page="
                (_page) => {
                  page = _page;
                }
              "
              :total="playerWithMatchesAggregate.total_matches"
              v-if="playerWithMatchesAggregate"
            ></Pagination>
          </TabsContent>

          <TabsContent value="tournaments">
            <CardHeader>
              <CardTitle class="text-xl font-bold">
                {{ $t("pages.players.detail.tournaments") }}
              </CardTitle>
            </CardHeader>
            <CardContent class="p-0">
              <div
                v-if="!playerTournaments || playerTournaments.length === 0"
                class="text-center py-8"
              >
                <p class="text-muted-foreground">
                  {{ $t("pages.players.detail.no_tournaments") }}
                </p>
              </div>
              <div v-else class="space-y-4">
                <TournamentTableRow
                  v-for="tournament in playerTournaments"
                  :key="tournament.id"
                  :tournament="tournament"
                ></TournamentTableRow>
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </Transition>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by, e_match_types_enum } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { playerFields } from "~/graphql/playerFields";
import { eloFields } from "~/graphql/eloFields";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";

export default {
  apollo: {
    $subscribe: {
      players_by_pk: {
        query: typedGql("subscription")({
          players_by_pk: [
            {
              steam_id: $("playerId", "bigint!"),
            },
            {
              ...playerFields,
              role: true,
              profile_url: true,
              teams: [
                {},
                {
                  id: true,
                  name: true,
                  short_name: true,
                },
              ],
              wins: true,
              losses: true,
              stats: {
                kills: true,
                deaths: true,
                assists: true,
                headshot_percentage: true,
              },
              kills_by_weapons: [
                {
                  order_by: [
                    {},
                    {
                      kill_count: order_by.desc,
                    },
                  ],
                  limit: 5,
                },
                {
                  with: true,
                  kill_count: true,
                },
              ],
              elo_history: [
                {
                  limit: 10,
                  where: {
                    type: {
                      _eq: e_match_types_enum.Competitive,
                    },
                    match: {
                      winning_lineup_id: {
                        _is_null: false,
                      },
                    },
                  },
                  order_by: [
                    {},
                    {
                      match_created_at: order_by.desc,
                    },
                  ],
                },
                eloFields,
              ],
            },
          ],
        }),
        variables: function () {
          return {
            playerId: this.playerId,
          };
        },
        result: function ({ data }) {
          this.player = data.players_by_pk;
        },
      },
      playerTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              limit: 10,
              where: {
                rosters: {
                  player_steam_id: {
                    _eq: $("steam_id", "bigint"),
                  },
                },
              },
              order_by: [
                {},
                {
                  start: order_by.desc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            steam_id: this.playerId,
          };
        },
        skip: function () {
          return !this.playerId;
        },
        result: function ({ data }: { data: any }) {
          this.playerTournaments = data.tournaments || [];
        },
      },
    },
    playerWithMatches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          playerWithMatches: {
            players_by_pk: [
              {
                steam_id: $("playerId", "bigint!"),
              },
              {
                matches: [
                  {
                    limit: $("limit", "Int!"),
                    offset: $("offset", "Int!"),
                    order_by: [
                      {},
                      {
                        created_at: order_by.desc,
                      },
                    ],
                  },
                  {
                    ...simpleMatchFields,
                    elo_changes: [
                      {
                        where: {
                          player_steam_id: {
                            _eq: $("playerId", "bigint!"),
                          },
                        },
                      },
                      eloFields,
                    ],
                  },
                ],
              },
            ],
          },
        },
      }),
      variables: function () {
        return {
          playerId: this.playerId,
          limit: this.perPage,
          offset: (this.page - 1) * this.perPage,
        };
      },
    },
    playerWithMatchesAggregate: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          playerWithMatchesAggregate: {
            players_by_pk: [
              {
                steam_id: $("playerId", "bigint!"),
              },
              {
                total_matches: true,
              },
            ],
          },
        },
      }),
      variables: function () {
        return {
          playerId: this.playerId,
        };
      },
    },
  },
  data() {
    return {
      player: undefined,
      page: 1,
      perPage: 10,
      playerTournaments: [],
    };
  },
  computed: {
    winPercentage() {
      const total = (this.player?.wins || 0) + (this.player?.losses || 0);
      if (!this.player) {
        return 0;
      }
      return total > 0 ? ((this.player?.wins || 0) / total) * 100 : 0;
    },

    kdPercentage() {
      if (
        !this.player?.stats ||
        !this.player.stats.kills ||
        !this.player.stats.deaths
      ) {
        return 0;
      }

      const kdRatio = this.player.stats.kills / this.player.stats.deaths;
      return Math.min((kdRatio / 2) * 100, 100);
    },
    playerId() {
      return this.$route.params.id || this.me?.steam_id || null;
    },
    me() {
      return useAuthStore().me;
    },
    canSanction() {
      if (!this.me || !this.player) {
        return false;
      }
      return (
        this.player.steam_id !== this.me.steam_id &&
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    kd() {
      if (!this.player?.stats) {
        return 0;
      }

      if (this.player?.stats?.deaths === 0) {
        return this.player?.stats.kills;
      }
      return formatStatValue(
        this.player?.stats.kills / this.player?.stats.deaths,
      );
    },
    winLossRatio() {
      const wins = this.player?.wins || 0;
      const losses = this.player?.losses || 0;
      if (losses === 0) {
        return wins > 0 ? wins : "0.00";
      }
      return formatStatValue(wins / losses);
    },
    combatStats() {
      return [
        {
          key: "kills",
          value: this.player?.stats?.kills ?? "-",
          label: this.$t("pages.players.detail.kills"),
          colorClass: "text-foreground",
        },
        {
          key: "assists",
          value: this.player?.stats?.assists ?? "-",
          label: "Assists",
          colorClass: "text-foreground",
        },
        {
          key: "hs",
          value: this.player?.stats?.headshot_percentage
            ? (this.player.stats.headshot_percentage * 100).toFixed(1) + "%"
            : "-",
          label: "HeadShot %",
          colorClass: "text-primary",
        },
      ];
    },
  },
  methods: {
    getWeaponImageName(weaponName) {
      if (!weaponName || weaponName === "unknown") return "";

      const overrideMappings = {};

      return overrideMappings[weaponName] || weaponName;
    },
    handleImageError(event) {
      const img = event.target;
      img.style.display = "none";
    },
  },
};
</script>
