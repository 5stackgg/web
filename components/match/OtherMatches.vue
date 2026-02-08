<script lang="ts" setup>
import Pagination from "~/components/Pagination.vue";
import MatchesTable from "~/components/MatchesTable.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
</script>
<template>
  <Transition name="fade" mode="out-in">
    <Empty v-if="loading" key="loading" class="p-3 min-h-[200px]">
      <div class="space-y-3 w-full max-w-md">
        <Skeleton class="h-4 w-3/4 mx-auto" />
        <Skeleton class="h-3 w-full" />
        <Skeleton class="h-3 w-5/6 mx-auto" />
      </div>
    </Empty>

    <MatchesTable
      v-else-if="otherMatches && otherMatches.length > 0"
      key="matches"
      class="p-3"
      :matches="otherMatches"
    ></MatchesTable>

    <Empty v-else key="empty" class="p-3 min-h-[200px]">
      <EmptyTitle>{{ $t("match.no_matches") }}</EmptyTitle>
      <EmptyDescription>{{ $t("match.no_matches_description") }}</EmptyDescription>
    </Empty>
  </Transition>

  <Teleport defer to="#pagination">
    <Pagination
      v-if="
        otherMatchesAggregate && otherMatchesAggregate.aggregate.count > 0
      "
      :page="page"
      :per-page="perPage"
      @page="
        (_page) => {
          page = _page;
        }
      "
      :total="otherMatchesAggregate?.aggregate?.count"
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
          this.loading = false;
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

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
