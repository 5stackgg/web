<script lang="ts" setup>
import Pagination from "~/components/Pagination.vue";
import MatchesTable from "~/components/MatchesTable.vue";
</script>
<template>
  <matches-table
    class="p-3"
    :matches="openMatches"
    v-if="openMatches"
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
      :total="otherMatchesAggregate?.aggregate?.count"
      v-if="otherMatchesAggregate"
    ></Pagination>
  </Teleport>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { $, e_match_status_enum, order_by } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      openMatches: [],
      otherMatchesAggregate: undefined,
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
            order_by: order_by.desc,
            offset: (this.page - 1) * this.perPage,
          };
        },
        result: function ({ data }) {
          this.openMatches = data.matches;
        },
      },
      otherMatchesAggregate: {
        query: typedGql("subscription")({
          matches_aggregate: [
            {},
            {
              aggregate: {
                count: true,
              },
            },
          ],
        }),
        result: function ({ data }) {
          this.otherMatchesAggregate = data.matches_aggregate;
        },
      },
    },
  },
};
</script>
