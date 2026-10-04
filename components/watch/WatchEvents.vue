<script setup lang="ts">
import { ArrowRight, CalendarDays } from "lucide-vue-next";
import EventFeature from "~/components/events/EventFeature.vue";
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
      <EventFeature v-if="featured" :event="featured" :compact="compact" />
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
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { eventPhaseWhere } from "~/utilities/eventDisplay";
import {
  compactEventFields,
  featuredEventFields,
} from "~/graphql/eventCardFields";

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

export default {
  data() {
    return {
      // Captured once so every event lands in exactly one phase.
      now: new Date().toISOString(),
      liveEvents: [] as any[],
      upcomingEvents: [] as any[],
      finishedEvents: [] as any[],
      loaded: { live: false, upcoming: false, finished: false },
    };
  },
  apollo: {
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
