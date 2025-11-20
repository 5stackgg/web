<script lang="ts" setup>
import Pagination from "~/components/Pagination.vue";
import MatchesTable from "~/components/MatchesTable.vue";
</script>
<template>
  <MatchesTable
    class="p-3"
    :matches="otherMatches"
    v-if="otherMatches"
  ></MatchesTable>

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
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { $, order_by, e_match_status_enum } from "~/generated/zeus";

export default {
  props: {
    statuses: {
      type: Array as PropType<e_match_status_enum[]>,
      default: () => Object.values(e_match_status_enum),
    },
    isInLineup: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      page: 1,
      perPage: 10,
      otherMatches: [],
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
              where: $("where", "matches_bool_exp!"),
            },
            {
              ...simpleMatchFields,
              streams: [
                {
                  order_by: [
                    {
                      priority: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  link: true,
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            limit: this.perPage,
            order_by: order_by.desc,
            offset: (this.page - 1) * this.perPage,
            where: {
              status: {
                _in: this.statuses,
              },
              ...(this.isInLineup === false
                ? {
                    is_in_lineup: {
                      _eq: false,
                    },
                  }
                : {}),
            },
          };
        },
        result: function ({ data }) {
          this.otherMatches = data.matches;
        },
      },
      otherMatchesAggregate: {
        query: typedGql("subscription")({
          matches_aggregate: [
            {
              where: $("where", "matches_bool_exp!"),
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
            where: {
              status: {
                _in: this.statuses,
              },
              ...(this.isInLineup === false
                ? {
                    is_in_lineup: {
                      _eq: false,
                    },
                  }
                : {}),
            },
          };
        },
        result: function ({ data }) {
          this.otherMatchesAggregate = data.matches_aggregate;
        },
      },
    },
  },
};
</script>
