<script setup lang="ts">
import { ArrowRight, CalendarDays } from "lucide-vue-next";
import WatchEventCard from "~/components/watch/WatchEventCard.vue";
import WatchEventCompactCard from "~/components/watch/WatchEventCompactCard.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

defineProps<{
  compact?: boolean;
  ghost?: boolean;
}>();

defineEmits<{
  (e: "tournament-ids", ids: string[]): void;
}>();
</script>

<template>
  <section v-if="ghost || hasEvents">
    <div
      :class="[
        tacticalSectionLabelClasses,
        '!flex w-full items-center justify-between',
      ]"
    >
      <span class="inline-flex items-center gap-3">
        <span class="inline-flex items-center gap-2">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.watch.events.title") }}
        </span>
        <NuxtLink
          v-if="!ghost"
          to="/events"
          class="inline-flex items-center gap-1 text-xs normal-case tracking-normal text-muted-foreground transition-colors hover:text-foreground"
        >
          {{ $t("common.see_all") }}
          <ArrowRight class="h-3 w-3" />
        </NuxtLink>
      </span>
    </div>

    <div
      v-if="ghost"
      class="flex min-h-[13.75rem] flex-col items-start justify-end gap-2.5 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-5"
    >
      <span
        class="grid h-[2.125rem] w-[2.125rem] place-items-center rounded-md bg-muted/55 text-muted-foreground"
      >
        <CalendarDays class="h-4 w-4" />
      </span>
      <span
        class="max-w-[36ch] text-sm leading-snug text-foreground/70 [text-wrap:balance]"
      >
        {{ $t("pages.watch.events.ghost") }}
      </span>
    </div>

    <template v-else>
      <WatchEventCard
        v-if="featured"
        :event="featured"
        :compact="compact"
        :steps="tournamentSteps"
        :leaderboard="leaderboard"
        :media="mediaItems"
        :media-count="mediaCount"
        :plays="plays"
        :plays-count="playsCount"
      />
      <div
        v-if="secondary.length"
        class="grid gap-3 sm:grid-cols-2"
        :class="{ 'mt-3': featured }"
      >
        <WatchEventCompactCard
          v-for="event in secondary"
          :key="event.id"
          :event="event"
        />
      </div>
    </template>
  </section>
</template>

<script lang="ts">
import gql from "graphql-tag";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { eventPhaseWhere } from "~/utilities/eventDisplay";
import {
  tournamentProgressSteps,
  type ProgressStep,
} from "~/utilities/tournamentProgressSteps";
import { tournamentRowState } from "~/utilities/watchEventCard";
import { matchClipFields, topPlayOrderBy } from "~/graphql/matchClip";

const count = [{}, { aggregate: { count: true } }] as const;

const compactEventFields = {
  id: true,
  name: true,
  starts_at: true,
  ends_at: true,
  banner: { id: true, filename: true, mime_type: true },
  tournaments_aggregate: count,
  teams_aggregate: count,
  players_aggregate: count,
  media_aggregate: count,
};

const featuredEventFields = {
  ...compactEventFields,
  banner_media_id: true,
  hide_creator_organizer: true,
  organizer_steam_id: true,
  organizer: { name: true },
  organizers: [{}, { steam_id: true, organizer: { name: true } }],
  tournaments: [
    {},
    {
      tournament_id: true,
      tournament: {
        id: true,
        name: true,
        status: true,
        start: true,
        options: { type: true },
        prizes: [{}, { prize: true }],
        teams_aggregate: count,
        stages: [
          { order_by: [{ order: order_by.asc }] },
          {
            type: true,
            order: true,
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
            tournament_team: {
              name: true,
              team: { name: true, short_name: true },
            },
          },
        ],
      },
    },
  ],
};

function eventsSubscription(
  phase: "live" | "upcoming" | "finished",
  direction: order_by,
  fields: Record<string, unknown>,
) {
  return typedGql("subscription")({
    events: [
      {
        where: eventPhaseWhere(phase, $("now", "timestamptz!")),
        order_by: [{ starts_at: direction }],
        limit: $("limit", "Int!"),
      },
      fields,
    ],
  } as any);
}

const liveEventsSubscription = eventsSubscription(
  "live",
  order_by.desc,
  featuredEventFields,
);
const upcomingEventsSubscription = eventsSubscription(
  "upcoming",
  order_by.asc,
  compactEventFields,
);
const finishedEventsSubscription = eventsSubscription(
  "finished",
  order_by.desc,
  compactEventFields,
);

// Only the live tournaments of the featured event need their bracket: the
// stepper and the "N live" on each live row.
const liveBracketsSubscription = typedGql("subscription")({
  tournaments: [
    { where: { id: { _in: $("ids", "[uuid!]!") } } },
    {
      id: true,
      stages: [
        { order_by: [{ order: order_by.asc }] },
        {
          type: true,
          order: true,
          groups: true,
          brackets: [
            {},
            {
              round: true,
              group: true,
              path: true,
              bye: true,
              finished: true,
              scheduled_at: true,
              match: { status: true, winning_lineup_id: true },
            },
          ],
        },
      ],
    },
  ],
} as any);

const LEADERBOARD_QUERY = gql`
  query WatchEventLeaderboard($eventId: uuid!) {
    get_event_leaderboard(
      args: {
        _event_id: $eventId
        _category: "rating"
        _match_type: null
        _min_rounds: 0
      }
      order_by: [{ value: desc }]
      limit: 3
    ) {
      player_steam_id
      player_name
      player_avatar_url
      value
      matches_played
    }
  }
`;

const MEDIA_QUERY = typedGql("query")({
  event_media: [
    {
      where: $("where", "event_media_bool_exp!"),
      order_by: [{ created_at: order_by.desc }],
      limit: 4,
    },
    {
      id: true,
      filename: true,
      mime_type: true,
      title: true,
      thumbnail_filename: true,
      external_url: true,
    },
  ],
  event_media_aggregate: [
    { where: $("where", "event_media_bool_exp!") },
    { aggregate: { count: true } },
  ],
} as any);

const eventPlaysWhere = {
  visibility: { _eq: "public" },
  match_map: {
    match: {
      event_links: { event_id: { _eq: $("eventId", "uuid!") } },
    },
  },
};

const PLAYS_QUERY = typedGql("query")({
  match_clips: [
    { where: eventPlaysWhere, order_by: topPlayOrderBy, limit: 3 },
    matchClipFields,
  ],
  match_clips_aggregate: [
    { where: eventPlaysWhere },
    { aggregate: { count: true } },
  ],
} as any);

export default {
  data() {
    return {
      // Captured once so every event lands in exactly one phase.
      now: new Date().toISOString(),
      liveEvents: [] as any[],
      upcomingEvents: [] as any[],
      finishedEvents: [] as any[],
      liveTournaments: [] as any[],
      leaderboard: [] as any[],
      mediaItems: [] as any[],
      mediaCount: 0,
      plays: [] as any[],
      playsCount: 0,
      loaded: { live: false, upcoming: false, finished: false },
    };
  },
  apollo: {
    leaderboard: {
      query: LEADERBOARD_QUERY,
      fetchPolicy: "network-only",
      variables(this: any) {
        return { eventId: this.featured?.id };
      },
      skip(this: any) {
        return !this.featured;
      },
      update(data: any) {
        return data?.get_event_leaderboard ?? [];
      },
    },
    mediaItems: {
      query: MEDIA_QUERY,
      fetchPolicy: "network-only",
      variables(this: any) {
        const where: Record<string, unknown> = {
          event_id: { _eq: this.featured?.id },
        };
        if (this.featured?.banner_media_id) {
          where.id = { _neq: this.featured.banner_media_id };
        }
        return { where };
      },
      skip(this: any) {
        return !this.featured;
      },
      update(data: any) {
        return data?.event_media ?? [];
      },
      result(this: any, { data }: any) {
        this.mediaCount = data?.event_media_aggregate?.aggregate?.count ?? 0;
      },
    },
    plays: {
      query: PLAYS_QUERY,
      fetchPolicy: "network-only",
      variables(this: any) {
        return { eventId: this.featured?.id };
      },
      skip(this: any) {
        return !this.featured;
      },
      update(data: any) {
        return data?.match_clips ?? [];
      },
      result(this: any, { data }: any) {
        this.playsCount =
          Number(data?.match_clips_aggregate?.aggregate?.count) || 0;
      },
    },
    $subscribe: {
      liveEvents: {
        query: () => liveEventsSubscription,
        variables(this: any) {
          return { now: this.now, limit: 2 };
        },
        result(this: any, { data }: any) {
          this.liveEvents = data?.events ?? [];
          this.loaded.live = true;
        },
        error(this: any, error: any) {
          this.loaded.live = true;
          console.error("[watch] live events subscription error:", error);
        },
      },
      upcomingEvents: {
        query: () => upcomingEventsSubscription,
        variables(this: any) {
          return { now: this.now, limit: 2 };
        },
        result(this: any, { data }: any) {
          this.upcomingEvents = data?.events ?? [];
          this.loaded.upcoming = true;
        },
        error(this: any, error: any) {
          this.loaded.upcoming = true;
          console.error("[watch] upcoming events subscription error:", error);
        },
      },
      finishedEvents: {
        query: () => finishedEventsSubscription,
        variables(this: any) {
          return { now: this.now, limit: 1 };
        },
        result(this: any, { data }: any) {
          this.finishedEvents = data?.events ?? [];
          this.loaded.finished = true;
        },
        error(this: any, error: any) {
          this.loaded.finished = true;
          console.error("[watch] finished events subscription error:", error);
        },
      },
      liveTournaments: {
        query: () => liveBracketsSubscription,
        variables(this: any) {
          return { ids: this.liveTournamentIds };
        },
        skip(this: any) {
          return this.liveTournamentIds.length === 0;
        },
        result(this: any, { data }: any) {
          this.liveTournaments = data?.tournaments ?? [];
        },
        error(error: any) {
          console.error("[watch] live brackets subscription error:", error);
        },
      },
    },
  },
  computed: {
    hasEvents(): boolean {
      return (
        this.loaded.live &&
        this.loaded.upcoming &&
        this.loaded.finished &&
        (!!this.featured || this.secondary.length > 0)
      );
    },
    featured(): any | null {
      return this.liveEvents[0] ?? null;
    },
    // A second live event, then what's next, then the last one that ran.
    secondary(): any[] {
      return [
        ...this.liveEvents.slice(1),
        ...this.upcomingEvents,
        ...this.finishedEvents,
      ].slice(0, 2);
    },
    eventTournaments(): any[] {
      return (this.featured?.tournaments ?? [])
        .map((entry: any) => entry.tournament)
        .filter(Boolean);
    },
    liveTournamentIds(): string[] {
      return this.eventTournaments
        .filter(
          (tournament: any) => tournamentRowState(tournament.status) === "live",
        )
        .map((tournament: any) => tournament.id);
    },
    tournamentSteps(): Record<string, ProgressStep[]> {
      const steps: Record<string, ProgressStep[]> = {};
      for (const tournament of this.liveTournaments) {
        steps[tournament.id] = tournamentProgressSteps(tournament.stages);
      }
      return steps;
    },
    shownTournamentIds(): string[] {
      return this.eventTournaments.map((tournament: any) => tournament.id);
    },
  },
  watch: {
    shownTournamentIds: {
      immediate: true,
      handler(this: any, ids: string[], previous?: string[]) {
        if (previous && ids.join() === previous.join()) return;
        this.$emit("tournament-ids", ids);
      },
    },
  },
};
</script>
