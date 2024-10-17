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
      :total="openMatchesAggregate?.aggregate?.count"
      v-if="openMatchesAggregate"
    ></Pagination>
  </Teleport>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import {
  $,
  e_lobby_access_enum,
  e_match_status_enum,
  order_by,
} from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      openMatches: [],
      openMatchesAggregate: undefined,
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
      openMatchesAggregate: {
        variables: function () {
          return {
            order_by: order_by.asc,
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
          matches_aggregate: [
            {
              where: {
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
        }),
        variables: function () {
          return {
            statuses: [e_match_status_enum.PickingPlayers],
          };
        },
        result: function ({ data }) {
          this.openMatchesAggregate = data.matches_aggregate;
        },
      },
    },
  },
};
</script>
