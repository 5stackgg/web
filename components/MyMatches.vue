<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "./Pagination.vue";
</script>

<template>
  <template v-if="!paginationTeleport">
    <Card v-if="matches" class="p-4">
      <matches-table :matches="matches">
        <template #none-found> No Upcoming Matches </template>
      </matches-table>
    </Card>

    <Pagination
      :page="page"
      @page="
        (_page) => {
          page = _page;
        }
      "
      :total="myTotalMatches.aggregate.count"
      :per-page="per_page"
      v-if="myTotalMatches"
    ></Pagination>
  </template>
  <template v-else>
    <matches-table v-if="matches" :matches="matches">
      <template #none-found> No Upcoming Matches </template>
    </matches-table>

    <Teleport defer :to="paginationTeleport">
      <Pagination
        :page="page"
        @page="
          (_page) => {
            page = _page;
          }
        "
        :total="myTotalMatches.aggregate.count"
        :per-page="per_page"
        v-if="myTotalMatches"
      ></Pagination>
    </Teleport>
  </template>
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
    paginationTeleport: {
      type: String,
      required: false,
    },
  },
  apollo: {
    matches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        matches: [
          {
            limit: $("limit", "Int!"),
            offset: $("offset", "Int!"),
            where: {
              is_in_lineup: {
                _eq: true,
              },
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
            matches_aggregate: [
              {
                where: {
                  is_in_lineup: {
                    _eq: true,
                  },
                  status: {
                    _nin: $("statuses", "[e_match_status_enum]"),
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
      }),
      variables: function () {
        return {
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
  },
  data() {
    return {
      page: 1,
      per_page: 10,
    };
  },
};
</script>
