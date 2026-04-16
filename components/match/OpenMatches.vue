<script lang="ts" setup>
import Pagination from "~/components/Pagination.vue";
import MatchesTable from "~/components/MatchesTable.vue";
</script>
<template>
  <MatchesTable
    class="p-3"
    :matches="openMatches"
    v-if="openMatches"
  ></MatchesTable>

  <Pagination
    v-if="
      !loading && openMatchesAggregate && openMatchesAggregate.aggregate.count > 0
    "
    :page="page"
    :per-page="perPage"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="openMatchesAggregate?.aggregate?.count"
  ></Pagination>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { $, e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      openMatches: [],
      openMatchesAggregate: undefined,
      loading: true,
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
                options: {
                  lobby_access: {
                    _eq: e_lobby_access_enum.Open,
                  },
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
            statuses: [e_match_status_enum.PickingPlayers],
          };
        },
        result: function ({ data }) {
          this.openMatches = data.matches;
          this.loading = false;
        },
      },
      openMatchesAggregate: {
        query: typedGql("subscription")({
          matches_aggregate: [
            {
              where: {
                status: {
                  _in: $("statuses", "[e_match_status_enum]"),
                },
                options: {
                  lobby_access: {
                    _eq: e_lobby_access_enum.Open,
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
