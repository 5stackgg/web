<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { ChevronDownIcon } from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4" v-if="player">
    <PageHeading>
      <template #title>
        <PlayerDisplay :player="player" size="xl" v-if="player"></PlayerDisplay>
        <a :href="player.profile_url" target="_blank" rel="noopener noreferrer" class="ml-2 text-md">{{ player.profile_url }}</a>
      </template>

      <template #actions v-if="isAdmin">
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
                    <span class="capitalize">{{ role.replace("_", " ") }}</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </template>
    </PageHeading>

    <div
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
      v-if="player"
    >
      <Card>
        <CardHeader>
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Kills</CardTitle
          >
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-bold">
            {{ player.kills_aggregate.aggregate.count }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle class="text-sm font-medium text-muted-foreground"
            >Assists</CardTitle
          >
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-bold">
            {{ player.assists_aggregate.aggregate.count }}
          </p>
        </CardContent>
      </Card>
      <!-- Additional stat cards can be added here in the future -->
    </div>

    <Separator />

    <Card class="p-4">
      <CardHeader>
        <CardTitle class="text-xl font-bold"> Matches </CardTitle>
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
      :total="
        playerWithMatchesAggregate.player_lineup_aggregate.aggregate.count
      "
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
              role: true,
              name: true,
              steam_id: true,
              country: true,
              avatar_url: true,
              profile_url: true,
              kills_aggregate: [
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
                player_lineup_aggregate: [
                  {},
                  {
                    aggregate: {
                      count: true,
                    },
                  },
                ],
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
    isAdmin() {
      return useAuthStore().isAdmin;
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
