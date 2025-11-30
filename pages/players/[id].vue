<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import LastTenWinsAndLosses from "~/components/charts/LastTenWinsAndLosses.vue";
import PlayerEloChart from "~/components/charts/PlayerEloChart.vue";
import formatStatValue from "~/utilities/formatStatValue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import PlayerChangeName from "~/components/PlayerChangeName.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import { kdrColor } from "~/utilities/kdrColor";
import { PlayIcon } from "lucide-vue-next";

definePageMeta({
  alias: ["/me"],
});
</script>

<template>
  <PlayerSanctions class="my-4" :playerId="playerId" />

  <div class="flex-grow flex flex-col gap-4" v-if="player">
    <PageHeading>
      <template #title>
        <div class="flex items-center justify-center gap-4">
          <div class="flex flex-col gap-2">
            <PlayerChangeName :player="player" />
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
                class="flex items-center justify-center p-2 rounded-md border border-border bg-background hover:bg-accent/50 transition-colors"
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
                v-for="team in player.teams"
                :key="team.id"
                :to="`/teams/${team.id}`"
                class="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-all duration-200"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-2 h-2 rounded-full bg-primary/60 group-hover:bg-primary transition-colors"
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
        <template v-if="canSanction">
          <SanctionPlayer :player="player" />
          <PlayerRoleForm :player="player" />
        </template>

        <div class="flex items-center gap-2">
          <NuxtLink to="/play" v-if="player.steam_id === me.steam_id">
            <Button
              variant="default"
              size="lg"
              class="shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
            >
              <PlayIcon class="w-5 h-5 mr-2" />
              {{ $t("pages.players.detail.play_a_match") }}
            </Button>
          </NuxtLink>
        </div>
      </template>
    </PageHeading>

    <div class="flex flex-col gap-4" v-if="player">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card class="flex flex-col h-full">
          <CardHeader>
            <CardTitle class="text-sm font-medium text-muted-foreground">{{
              $t("pages.players.detail.player_stats")
            }}</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col flex-grow gap-6">
            <div class="flex flex-col gap-4">
              <div class="flex justify-between items-center">
                <div class="text-center flex-1">
                  <p class="text-sm text-muted-foreground">
                    {{ $t("pages.players.detail.wins") }}
                  </p>
                  <p class="text-2xl font-bold">
                    {{ player.wins || 0 }}
                  </p>
                </div>
                <div class="text-center flex-1">
                  <p class="text-sm text-muted-foreground">
                    {{ $t("pages.players.detail.losses") }}
                  </p>
                  <p class="text-2xl font-bold">
                    {{ player.losses || 0 }}
                  </p>
                </div>
              </div>
              <div class="flex justify-center items-center">
                <Badge class="text-2xl px-4 py-2" :class="kdrColor(kd)">
                  {{ $t("pages.players.detail.wl") }}: {{ winLossRatio }}
                </Badge>
              </div>
            </div>

            <div class="border-t border-border"></div>

            <div class="flex flex-col gap-4">
              <div class="flex justify-between items-center">
                <div class="text-center flex-1">
                  <p class="text-sm text-muted-foreground">
                    {{ $t("pages.players.detail.kills") }}
                  </p>
                  <p class="text-2xl font-bold">
                    {{ player.kills_aggregate.aggregate.count }}
                  </p>
                </div>
                <div class="text-center flex-1">
                  <p class="text-sm text-muted-foreground">
                    {{ $t("pages.players.detail.assists") }}
                  </p>
                  <p class="text-2xl font-bold">
                    {{ player.assists_aggregate.aggregate.count }}
                  </p>
                </div>
                <div class="text-center flex-1">
                  <p class="text-sm text-muted-foreground">
                    {{ $t("pages.players.detail.deaths") }}
                  </p>
                  <p class="text-2xl font-bold">
                    {{ player.deaths_aggregate.aggregate.count }}
                  </p>
                </div>
              </div>
              <div class="flex justify-center items-center">
                <Badge class="text-2xl px-4 py-2" :class="kdrColor(kd)">
                  {{ $t("pages.players.detail.kd") }}: {{ kd }}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="flex flex-col md:col-span-2" v-if="player?.elo_history">
          <CardHeader>
            <CardTitle class="text-xl font-bold text-center">
              {{ $t("pages.players.detail.elo_history") }}
            </CardTitle>
          </CardHeader>
          <CardContent class="flex-1 min-h-[300px]">
            <template v-if="player.elo_history.length > 0">
              <PlayerEloChart :elo-history="player.elo_history" />
            </template>
            <template v-else>
              <div
                class="flex justify-center items-center h-full uppercase text-muted-foreground text-center flex-col"
              >
                {{ $t("pages.players.detail.no_elo_history") }}
                <NuxtLink to="/play" class="mt-2">
                  <Button variant="outline" size="sm">{{
                    $t("pages.players.detail.play_a_match")
                  }}</Button>
                </NuxtLink>
              </div>
            </template>
          </CardContent>
        </Card>
      </div>

      <Card class="flex justify-center items-center">
        <div class="text-center">
          <CardHeader>
            <CardTitle class="text-xl font-bold text-center">
              {{ $t("pages.players.detail.recent_wins_and_losses") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LastTenWinsAndLosses class="max-h-[300px]" :steam_id="playerId" />
          </CardContent>
        </div>
      </Card>
    </div>

    <Card class="p-4">
      <CardHeader>
        <CardTitle class="text-xl font-bold">
          {{ $t("pages.players.detail.matches") }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MatchesTable
          :player="player"
          :matches="playerWithMatches?.matches"
          v-if="playerWithMatches?.matches"
        ></MatchesTable>
      </CardContent>
    </Card>

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
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { playerFields } from "~/graphql/playerFields";
import { eloFields } from "~/graphql/eloFields";

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
              kills_aggregate: [
                {
                  where: {
                    team_kill: {
                      _eq: false,
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
              deaths_aggregate: [
                {},
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
                    is_team_assist: {
                      _eq: false,
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
              elo_history: [
                {
                  limit: 10,
                  where: {
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
    };
  },
  computed: {
    playerId() {
      return this.$route.params.id || this.me?.steam_id;
    },
    me() {
      return useAuthStore().me;
    },
    canSanction() {
      return (
        this.player.steam_id !== this.me.steam_id &&
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    kd() {
      if (this.player?.deaths_aggregate.aggregate.count === 0) {
        return this.player?.kills_aggregate.aggregate.count;
      }
      return formatStatValue(
        this.player?.kills_aggregate.aggregate.count /
          this.player?.deaths_aggregate.aggregate.count
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
  },
};
</script>
