<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
</script>

<template>
  <Card v-if="meWithMatches?.player?.matches" class="p-4">
    <matches-table :matches="meWithMatches.player.matches"></matches-table>
  </Card>

  <pagination
    :page="page"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="myTotalMatches.player.player_lineup_aggregate.aggregate.count"
    :per-page="per_page"
    v-if="myTotalMatches"
  ></pagination>
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
                    limit: $("limit", "Int!"),
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
          limit: this.per_page,
          offset: (this.page - 1) * this.per_page,
          statuses: this.upcoming
            ? [
                e_match_status_enum.Canceled,
                e_match_status_enum.Forfeit,
                e_match_status_enum.Tie,
                e_match_status_enum.Finished,
              ]
            : [],
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
                  {},
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
          statuses: this.upcoming
            ? [e_match_status_enum.Canceled, e_match_status_enum.Finished]
            : [],
        };
      },
    },
  },
  data() {
    return {
      page: 1,
      per_page: 10,
    };
  },
};
</script>
