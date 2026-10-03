<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import WatchTournamentCard from "~/components/watch/WatchTournamentCard.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

defineProps<{
  excludeIds: string[];
}>();
</script>

<template>
  <section v-if="cards.length">
    <div
      :class="[
        tacticalSectionLabelClasses,
        '!flex w-full items-center justify-between',
      ]"
    >
      <span class="inline-flex items-center gap-3">
        <span class="inline-flex items-center gap-2">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.watch.tournaments.title") }}
        </span>
        <NuxtLink
          to="/tournaments"
          class="inline-flex items-center gap-1 text-xs normal-case tracking-normal text-muted-foreground transition-colors hover:text-foreground"
        >
          {{ $t("common.see_all") }}
          <ArrowRight class="h-3 w-3" />
        </NuxtLink>
      </span>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <WatchTournamentCard
        v-for="tournament in cards"
        :key="tournament.id"
        :tournament="tournament"
      />
    </div>
  </section>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { excludeLeagueTournaments } from "~/graphql/tournamentFilters";

const MAX_CARDS = 4;
const MAX_FINISHED = 2;

const UPCOMING_STATUSES = [
  e_tournament_status_enum.RegistrationOpen,
  e_tournament_status_enum.RegistrationClosed,
  e_tournament_status_enum.Setup,
  e_tournament_status_enum.CheckInReview,
];

const count = [{}, { aggregate: { count: true } }] as const;

const cardFields = {
  id: true,
  name: true,
  status: true,
  start: true,
  location: true,
  banner: true,
  e_tournament_status: { description: true },
  categories: [
    {},
    { category: true, e_tournament_category: { description: true } },
  ],
  options: {
    type: true,
    best_of: true,
    map_pool: { maps: [{}, { poster: true }] },
  },
  organizer_teams: [{}, { team: { name: true } }],
  admin: { name: true },
  prizes: [{}, { prize: true }],
  teams_aggregate: count,
  stages: [
    { order_by: [{ order: order_by.asc }] },
    {
      order: true,
      max_teams: true,
      results: [
        {},
        {
          rank: true,
          team: { name: true, team: { name: true, short_name: true } },
        },
      ],
    },
  ],
  awards: [
    { where: { placement: { _eq: 1 } } },
    {
      placement: true,
      tournament_team: { name: true, team: { name: true, short_name: true } },
    },
  ],
};

function tournamentsDocument(
  operation: "query" | "subscription",
  direction: order_by,
) {
  return typedGql(operation)({
    tournaments: [
      {
        where: $("where", "tournaments_bool_exp!"),
        order_by: [{ start: direction }],
        limit: $("limit", "Int!"),
      },
      cardFields,
    ],
  } as any);
}

const liveSubscription = tournamentsDocument("subscription", order_by.asc);
const upcomingQuery = tournamentsDocument("query", order_by.asc);
const finishedQuery = tournamentsDocument("query", order_by.desc);

function where(this: any, statuses: string[]) {
  return excludeLeagueTournaments({
    status: { _in: statuses },
    ...(this.excludeIds.length ? { id: { _nin: this.excludeIds } } : {}),
  });
}

export default {
  data() {
    return {
      live: [] as any[],
      upcoming: [] as any[],
      finished: [] as any[],
    };
  },
  apollo: {
    upcoming: {
      query: upcomingQuery,
      fetchPolicy: "network-only",
      variables(this: any) {
        return {
          where: where.call(this, UPCOMING_STATUSES),
          limit: MAX_CARDS,
        };
      },
      update(data: any) {
        return data?.tournaments ?? [];
      },
    },
    finished: {
      query: finishedQuery,
      fetchPolicy: "network-only",
      variables(this: any) {
        return {
          where: where.call(this, [e_tournament_status_enum.Finished]),
          limit: MAX_FINISHED,
        };
      },
      update(data: any) {
        return data?.tournaments ?? [];
      },
    },
    $subscribe: {
      live: {
        query: () => liveSubscription,
        variables(this: any) {
          return {
            where: where.call(this, [
              e_tournament_status_enum.Live,
              e_tournament_status_enum.Paused,
            ]),
            limit: MAX_CARDS,
          };
        },
        result(this: any, { data }: any) {
          this.live = data?.tournaments ?? [];
        },
        error(error: any) {
          console.error("[watch] live tournaments subscription error:", error);
        },
      },
    },
  },
  computed: {
    cards(): any[] {
      return [...this.live, ...this.upcoming, ...this.finished].slice(
        0,
        MAX_CARDS,
      );
    },
  },
};
</script>
