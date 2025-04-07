<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { ChevronDownIcon } from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";
import LastTenWins from "~/components/charts/LastTenWins.vue";
import LastTenLosses from "~/components/charts/LastTenLosses.vue";
import formatStatValue from "~/utilities/formatStatValue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import PlayerChangeName from "~/components/PlayerChangeName.vue";
</script>

<template>
  <PlayerSanctions class="my-4" :playerId="$route.params.id" />

  <div class="flex-grow flex flex-col gap-4" v-if="player">
    <PageHeading>
      <template #title>
        <PlayerChangeName :player="player" />
        <PlayerDisplay :player="player" size="xl" v-if="player"></PlayerDisplay>
        <a
          :href="player.profile_url"
          target="_blank"
          rel="noopener noreferrer"
          class="ml-2 text-md"
          >{{ player.profile_url }}</a
        >
      </template>

      <template #actions>
        <div class="flex gap-2">
          <template v-if="player.steam_id !== me.steam_id && !isUser">
            <SanctionPlayer :player="player" />
          </template>

          <template v-if="isAdmin && player.steam_id !== me.steam_id">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" class="ml-auto">
                  <span class="capitalize">{{
                    player.role.replace("_", " ")
                  }}</span>
                  <ChevronDownIcon class="ml-2 h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="p-0" align="end">
                <Command v-model="memberRole">
                  <CommandList>
                    <CommandGroup>
                      <CommandItem
                        :value="role"
                        class="flex flex-col items-start px-4 py-2 cursor-pointer"
                        v-for="role of e_player_roles_enum"
                      >
                        <span class="capitalize">{{
                          role.replace("_", " ")
                        }}</span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </template>
          <template v-else-if="player.role !== e_player_roles_enum.user">
            <Badge class="capitalize">{{
              player.role.replace("_", " ")
            }}</Badge>
          </template>
        </div>
      </template>
    </PageHeading>

    <div
      class="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-4"
      v-if="player"
    >
      <Card class="flex flex-col h-full">
        <CardHeader>
          <CardTitle class="text-sm font-medium text-muted-foreground">{{
            $t("pages.players.detail.player_stats")
          }}</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col flex-grow">
          <div class="flex justify-between items-center">
            <div class="text-center">
              <p class="text-sm text-muted-foreground">
                {{ $t("pages.players.detail.kills") }}
              </p>
              <p class="text-2xl font-bold">
                {{ player.kills_aggregate.aggregate.count }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-muted-foreground">
                {{ $t("pages.players.detail.assists") }}
              </p>
              <p class="text-2xl font-bold">
                {{ player.assists_aggregate.aggregate.count }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-muted-foreground">
                {{ $t("pages.players.detail.deaths") }}
              </p>
              <p class="text-2xl font-bold">
                {{ player.deaths_aggregate.aggregate.count }}
              </p>
            </div>
          </div>

          <div class="flex justify-center items-center mt-4 h-full">
            <Badge class="text-3xl p-2">
              {{ $t("pages.players.detail.kd") }}: {{ kd }}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card class="flex justify-center items-center">
        <div class="text-center">
          <CardHeader>
            <CardTitle class="text-xl font-bold text-center">
              {{ $t("pages.players.detail.last_ten_wins") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LastTenWins :steam_id="$route.params.id" />
          </CardContent>
        </div>
      </Card>

      <Card class="flex justify-center items-center">
        <div class="text-center">
          <CardHeader>
            <CardTitle class="text-xl font-bold text-center">
              {{ $t("pages.players.detail.last_ten_losses") }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LastTenLosses :steam_id="$route.params.id" />
          </CardContent>
        </div>
      </Card>
    </div>

    <Separator />

    <Card class="p-4">
      <CardHeader>
        <CardTitle class="text-xl font-bold">
          {{ $t("pages.players.detail.matches") }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <matches-table
          :matches="playerWithMatches?.matches"
          v-if="playerWithMatches?.matches"
        ></matches-table>
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
import { generateMutation } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";

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
            },
          ],
        }),
        variables: function () {
          return {
            playerId: this.$route.params.id,
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
                  simpleMatchFields,
                ],
              },
            ],
          },
        },
      }),
      variables: function () {
        return {
          playerId: this.$route.params.id,
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
          playerId: this.$route.params.id,
        };
      },
    },
  },
  data() {
    return {
      player: undefined,
      page: 1,
      perPage: 10,
      memberRole: undefined,
    };
  },
  watch: {
    memberRole: {
      handler(role) {
        if (role) {
          this.updateRole();
          return;
        }
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    isUser() {
      return useAuthStore().isUser;
    },
    kd() {
      if (this.player?.deaths_aggregate.aggregate.count === 0) {
        return this.player?.kills_aggregate.aggregate.count;
      }
      return formatStatValue(
        this.player?.kills_aggregate.aggregate.count /
          this.player?.deaths_aggregate.aggregate.count,
      );
    },
  },
  methods: {
    async updateRole() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_players_by_pk: [
            {
              _set: {
                role: this.memberRole,
              },
              pk_columns: {
                steam_id: this.player.steam_id,
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
};
</script>
