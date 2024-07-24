<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
</script>

<template>
  <div class="flex flex-auto" v-if="player">
    <Card>
      <CardHeader>
        <CardTitle> Kills </CardTitle>
      </CardHeader>
      <CardContent>
        {{ player.kills_aggregate.aggregate.count }}
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle> Assists </CardTitle>
      </CardHeader>
      <CardContent>
        {{ player.assists_aggregate.aggregate.count }}
      </CardContent>
    </Card>
  </div>

  <h1>Matches</h1>
  <div v-if="playerWithMatches">
    <matches-table :matches="playerWithMatches.matches"></matches-table>
    <Pagination
      :page="page"
      @page="
        (_page) => {
          page = _page;
        }
      "
      :total="
        Math.ceil(
          playerWithMatchesAggregate.player_lineup_aggregate.aggregate.count /
            per_page,
        )
      "
      v-if="playerWithMatchesAggregate"
    ></Pagination>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchFields } from "~/graphql/matchesGraphql";

export default {
  data() {
    return {
      player: undefined,
      page: 1,
      per_page: 10,
    };
  },
  apollo: {
    $subscribe: {
      players_by_pk: {
        query: typedGql("subscription")({
          players_by_pk: [
            {
              steam_id: $("playerId", "bigint!"),
            },
            {
              name: true,
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
                  matchFields,
                ],
              },
            ],
          },
        },
      }),
      variables: function () {
        return {
          playerId: this.$route.params.id,
          limit: this.per_page,
          offset: (this.page - 1) * this.per_page,
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
};
</script>
