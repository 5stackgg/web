<script setup lang="ts">
import WatchEventCard from "~/components/watch/WatchEventCard.vue";

defineProps<{
  event: any;
  compact?: boolean;
}>();
</script>

<template>
  <WatchEventCard
    :event="event"
    :compact="compact"
    :steps="tournamentSteps"
    :leaderboard="leaderboard"
    :media="mediaItems"
    :media-count="mediaCount"
    :plays="plays"
    :plays-count="playsCount"
  />
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import {
  tournamentProgressSteps,
  type ProgressStep,
} from "~/utilities/tournamentProgressSteps";
import { tournamentRowState } from "~/utilities/watchEventCard";
import { matchClipFields, topPlayOrderBy } from "~/graphql/matchClip";
import { eventLeaderboardQuery } from "~/graphql/eventCardFields";

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
      liveTournaments: [] as any[],
      leaderboard: [] as any[],
      mediaItems: [] as any[],
      mediaCount: 0,
      plays: [] as any[],
      playsCount: 0,
    };
  },
  apollo: {
    leaderboard: {
      query: eventLeaderboardQuery,
      fetchPolicy: "network-only",
      variables(this: any) {
        return { eventId: this.event.id };
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
          event_id: { _eq: this.event.id },
        };
        if (this.event.banner_media_id) {
          where.id = { _neq: this.event.banner_media_id };
        }
        return { where };
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
        return { eventId: this.event.id };
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
    eventTournaments(): any[] {
      return (this.event?.tournaments ?? [])
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
  },
};
</script>
