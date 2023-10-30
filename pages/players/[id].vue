<template>
  <div class="flex flex-auto" v-if="player">
    <simple-card title="Kills">
      {{ player.kills_aggregate.aggregate.count }}
    </simple-card>
    <simple-card title="Assists">
      {{ player.assists_aggregate.aggregate.count }}
    </simple-card>
    <simple-card title="K/D"> TODO </simple-card>
  </div>

  <h1>Matches</h1>
  <div v-if="playerWithMatches">
    <matches-table :matches="playerWithMatches.matches"></matches-table>
    <pagination
      :per-page="10"
      :offset="playerMatchesOffset"
      @offset="
        (offset) => {
          playerMatchesOffset = offset;
        }
      "
      :total="
        playerWithMatchesAggregate.player_lineup_aggregate.aggregate.count
      "
      v-if="playerWithMatchesAggregate"
    ></pagination>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_match_status_enum, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchFields } from "~/graphql/matchesGraphql";

export default {
  data() {
    return {
      player: undefined,
      playerMatchesOffset: 0,
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
                    limit: 10,
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
          offset: this.playerMatchesOffset,
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
