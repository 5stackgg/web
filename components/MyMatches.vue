<template>
  <div v-if="meWithMatches?.player?.matches">
    <matches-table :matches="meWithMatches.player.matches"></matches-table>
    <pagination
      :per-page="10"
      :offset="myMatchesSearchOffset"
      @offset="
        (offset) => {
          myMatchesSearchOffset = offset;
        }
      "
      :total="myTotalMatches.player.player_lineup_aggregate.aggregate.count"
      v-if="myTotalMatches"
    ></pagination>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { matchFields } from "~/graphql/matchesGraphql";
import { $, e_match_status_enum, order_by } from "~/generated/zeus";

export default {
  props: {
    upcoming: {
      type: Boolean,
      default: false,
    },
  },
  apollo: {
    meWithMatches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          meWithMatches: {
            me: {
              player: {
                matches: [
                  {
                    limit: 10,
                    offset: $("offset", "Int!"),
                    where: {
                      status: {
                        _nin: $("statuses", "[e_match_status_enum]"),
                      },
                    },
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
            },
          },
        },
      }),
      variables: function () {
        return {
          offset: this.myMatchesSearchOffset,
          statuses: this.upcoming ? [e_match_status_enum.Canceled, e_match_status_enum.Finished] : [],
        };
      },
    },
    myTotalMatches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          myTotalMatches: {
            me: {
              player: {
                name: true,
                player_lineup_aggregate: [
                  {
                    where: {
                      lineup: {
                        matches: {
                          status: {
                            _nin: $("statuses", "[e_match_status_enum]"),
                          },
                        },
                      },
                    },
                  },
                  {
                    aggregate: {
                      count: true,
                    },
                  },
                ],
              },
            },
          },
        },
      }),
      variables: function () {
        return {
          statuses: this.upcoming ? [e_match_status_enum.Canceled, e_match_status_enum.Finished] : [],
        };
      },
    },
  },
  data() {
    return {
      myMatchesSearchOffset: 0,
    };
  },
};
</script>
