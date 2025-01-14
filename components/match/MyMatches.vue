<script lang="ts" setup>
import Pagination from "~/components/Pagination.vue";
import MatchesTable from "~/components/MatchesTable.vue";
</script>
<template>
  <matches-table
    class="p-3"
    :matches="myMatches"
    v-if="myMatches"
  ></matches-table>

  <Teleport defer to="#pagination">
    <Pagination
      :page="page"
      :per-page="perPage"
      @page="
        (_page) => {
          page = _page;
        }
      "
      :total="myMatchesAggregate?.aggregate?.count"
      v-if="myMatchesAggregate"
    ></Pagination>
  </Teleport>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { $, e_match_status_enum } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      myMatches: [],
      myMatchesAggregate: undefined,
      statuses: [
        e_match_status_enum.Forfeit,
        e_match_status_enum.Canceled,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
        e_match_status_enum.Finished,
      ],
    };
  },
  apollo: {
    $subscribe: {
      matches: {
        query: typedGql("subscription")({
          matches: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              where: {
                status: {
                  _in: $("statuses", "[e_match_status_enum]"),
                },
              },
              order_by: [
                {},
                {
                  created_at: $("order_by", "order_by"),
                },
              ],
            },
            simpleMatchFields,
          ],
        }),
        variables: function () {
          return {
            limit: this.perPage,
            offset: (this.page - 1) * this.perPage,
            statuses: this.statuses,
          };
        },
        result: function ({ data }) {
          this.myMatches = data.matches;
        },
      },
      myMatchesAggregate: {
        query: typedGql("subscription")({
          matches_aggregate: [
            {
              where: {
                status: {
                  _in: $("statuses", "[e_match_status_enum]"),
                },
              },
            },
            {
              aggregate: {
                count: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            statuses: this.statuses,
          };
        },
        result: function ({ data }) {
          this.myMatchesAggregate = data.matches_aggregate;
        },
      },
    },
  },
};
</script>
