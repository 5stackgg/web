<script lang="ts" setup>
import { ref } from "vue";
import { ArrowRight } from "lucide-vue-next";
import Pagination from "~/components/Pagination.vue";
import MatchesTable from "~/components/MatchesTable.vue";
import MatchTableRow from "~/components/MatchTableRow.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import HorizontalScrollRow from "~/components/ui/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/ui/ScrollArrows.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const scrollRef = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);

const fadeTransition = {
  enterActiveClass: "transition-opacity duration-200 ease-out",
  leaveActiveClass: "transition-opacity duration-200 ease-out",
  enterFromClass: "opacity-0",
  leaveToClass: "opacity-0",
};

const paginationFadeTransition = {
  enterActiveClass: "transition-opacity duration-300 ease-out delay-1000",
  leaveActiveClass: "transition-opacity duration-200 ease-out",
  enterFromClass: "opacity-0",
  leaveToClass: "opacity-0",
};
</script>
<template>
  <div
    v-show="
      !hideWhenEmpty ||
      (otherMatches && otherMatches.length > 0) ||
      showPagination
    "
  >
    <div
      v-if="sectionLabel"
      :class="[
        tacticalSectionLabelClasses,
        '!flex w-full items-center justify-between',
      ]"
    >
      <div class="inline-flex items-center gap-3">
        <span class="inline-flex items-center gap-2">
          <span :class="tacticalSectionTickClasses"></span>
          {{ sectionLabel }}
        </span>
        <NuxtLink
          v-if="seeAllTo"
          :to="seeAllTo"
          class="inline-flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors normal-case"
        >
          {{ $t("common.see_all") }}
          <ArrowRight class="h-3 w-3" />
        </NuxtLink>
      </div>
      <ScrollArrows
        v-if="compact"
        :can-left="scrollRef?.state?.canScrollLeft"
        :can-right="scrollRef?.state?.canScrollRight || hasMore"
        @scroll="
          (d) => {
            scrollRef?.scrollByDirection(d);
            // A right-arrow click is an explicit intent signal — kick
            // off the next batch immediately rather than waiting for
            // scroll-based approach detection. loadMore() is a no-op
            // if a request is already in flight or there's nothing
            // more, so this is safe to call on every click.
            if (d === 'right') loadMore();
          }
        "
      />
    </div>

    <Transition v-bind="fadeTransition" mode="out-in">
      <div
        v-if="loading && compact"
        key="loading-c"
        class="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <Skeleton
          v-for="i in 4"
          :key="i"
          class="h-28 w-96 shrink-0 rounded-md"
        />
      </div>

      <Empty v-else-if="loading" key="loading" class="min-h-[200px]">
        <div class="space-y-3 w-full max-w-md">
          <Skeleton class="h-4 w-3/4 mx-auto" />
          <Skeleton class="h-3 w-full" />
          <Skeleton class="h-3 w-5/6 mx-auto" />
        </div>
      </Empty>

      <HorizontalScrollRow
        v-else-if="compact && otherMatches && otherMatches.length > 0"
        key="matches-c"
        ref="scrollRef"
        @approaching-end="loadMore"
      >
        <div
          v-for="(match, index) in otherMatches"
          :key="match.id"
          class="w-96 shrink-0 snap-start"
        >
          <MatchTableRow
            :match="match"
            compact
            always-show
            :style="{ animationDelay: `${index * 50}ms` }"
            class="animate-in fade-in slide-in-from-bottom-2 h-full"
          />
        </div>
      </HorizontalScrollRow>

      <MatchesTable
        v-else-if="otherMatches && otherMatches.length > 0"
        key="matches"
        :matches="otherMatches"
      ></MatchesTable>

      <div
        v-else
        key="empty"
        class="relative flex min-h-20 flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border/60 bg-muted/10 px-4 py-2.5 text-center [background-image:repeating-linear-gradient(135deg,transparent_0,transparent_8px,hsl(var(--muted-foreground)/0.04)_8px,hsl(var(--muted-foreground)/0.04)_9px)]"
      >
        <div
          class="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground/80"
        >
          <span
            aria-hidden="true"
            class="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
          ></span>
          {{ emptyLabel || $t("common.standby_no_activity") }}
        </div>
        <p
          v-if="emptyDescription"
          class="mt-1 text-xs text-muted-foreground/70"
        >
          {{ emptyDescription }}
        </p>
      </div>
    </Transition>

    <Teleport v-if="showPagination" defer to="#pagination">
      <Transition v-bind="paginationFadeTransition">
        <Pagination
          v-if="
            !loading &&
            otherMatchesAggregate &&
            otherMatchesAggregate.aggregate.count > 0
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
      </Transition>
    </Teleport>
  </div>
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
    showPagination: {
      type: Boolean,
      default: true,
    },
    limit: {
      type: Number,
      default: 10,
    },
    hideWhenEmpty: {
      type: Boolean,
      default: false,
    },
    sectionLabel: {
      type: String,
      default: "",
    },
    seeAllTo: {
      type: String,
      default: "",
    },
    compact: {
      type: Boolean,
      default: false,
    },
    emptyLabel: {
      type: String,
      default: "",
    },
    emptyDescription: {
      type: String,
      default: "",
    },
    // Real-time channel — only useful for live match states where the
    // server actively pushes score/status changes. Upcoming / finished
    // lists are static enough that a regular query is cheaper.
    useSubscription: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      page: 1,
      otherMatches: [],
      otherMatchesAggregate: undefined,
      loading: true,
      // Load-more counter. Increments by `limit` each time the user
      // approaches the right edge — subscription's variables() reads
      // `perPage` so the query re-runs with the extended limit. We
      // stay one batch ahead so the row feels instant.
      extendedLimit: this.limit as number,
      // In-flight flag — prevents stacking up loadMore() calls while
      // the previous batch is still on the wire.
      loadMoreInFlight: false,
      // Tracks the limit that was requested vs the rows we've received.
      // When the count catches up we clear the in-flight flag.
      pendingLimit: this.limit as number,
    };
  },
  computed: {
    perPage(): number {
      return this.extendedLimit;
    },
    hasMore(): boolean {
      const total = this.otherMatchesAggregate?.aggregate?.count ?? 0;
      return (this.otherMatches?.length ?? 0) < total;
    },
  },
  methods: {
    loadMore() {
      if (!this.hasMore || this.loadMoreInFlight) return;
      this.loadMoreInFlight = true;
      this.extendedLimit += this.limit;
      this.pendingLimit = this.extendedLimit;
    },
    applyMatchesResult(data: any) {
      this.otherMatches = data.matches;
      this.loading = false;
      if ((data.matches?.length ?? 0) >= this.pendingLimit) {
        this.loadMoreInFlight = false;
      } else if (!this.hasMore) {
        this.loadMoreInFlight = false;
      }
    },
    buildMatchesVariables() {
      return {
        limit: this.perPage,
        order_by: order_by.desc,
        offset: (this.page - 1) * this.perPage,
        where: this.buildWhereClause(),
      };
    },
    buildAggregateVariables() {
      return { where: this.buildWhereClause() };
    },
    buildWhereClause() {
      return {
        status: { _in: this.statuses },
        ...(this.isInLineup === false ? { is_in_lineup: { _eq: false } } : {}),
      };
    },
  },
  apollo: {
    // Aggregate is always a regular query — count doesn't need
    // real-time updates.
    otherMatchesAggregate: {
      query: typedGql("query")({
        matches_aggregate: [
          {
            where: $("where", "matches_bool_exp!"),
          },
          {
            aggregate: { count: true },
          },
        ],
      }),
      variables(this: any) {
        return this.buildAggregateVariables();
      },
      fetchPolicy: "network-only",
      update: (data: any) => data.matches_aggregate,
    },
    // Non-live channel — fetched on mount and when variables change
    // (statuses, limit/pagination, etc).
    matchesQuery: {
      query: typedGql("query")({
        matches: [
          {
            limit: $("limit", "Int!"),
            offset: $("offset", "Int!"),
            order_by: [{}, { created_at: $("order_by", "order_by") }],
            where: $("where", "matches_bool_exp!"),
          },
          {
            ...simpleMatchFields,
            streams: [
              { order_by: [{ priority: order_by.asc }] },
              { id: true, link: true, is_game_streamer: true },
            ],
          },
        ],
      }),
      variables(this: any) {
        return this.buildMatchesVariables();
      },
      skip(this: any) {
        return this.useSubscription;
      },
      fetchPolicy: "network-only",
      manual: true,
      result(this: any, { data }: any) {
        this.applyMatchesResult(data);
      },
    },
    $subscribe: {
      // Live channel — same shape, streamed.
      matchesSubscription: {
        query: typedGql("subscription")({
          matches: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: [{}, { created_at: $("order_by", "order_by") }],
              where: $("where", "matches_bool_exp!"),
            },
            {
              ...simpleMatchFields,
              streams: [
                { order_by: [{ priority: order_by.asc }] },
                { id: true, link: true, is_game_streamer: true },
              ],
            },
          ],
        }),
        variables(this: any) {
          return this.buildMatchesVariables();
        },
        skip(this: any) {
          return !this.useSubscription;
        },
        manual: true,
        result(this: any, { data }: any) {
          this.applyMatchesResult(data);
        },
      },
    },
  },
};
</script>
