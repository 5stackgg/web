<script setup lang="ts">
import { ref, watch } from "vue";
import { PlusCircle } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import EventHero from "~/components/events/EventHero.vue";
import EventSquare from "~/components/events/EventSquare.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
} from "~/utilities/tacticalClasses";

// Events are feature-gated (public.events_enabled, default off). Wait for
// settings to load before deciding, so a direct link is not falsely bounced.
const applicationSettingsStore = useApplicationSettingsStore();
watch(
  () => applicationSettingsStore.settings.length,
  () => {
    if (
      applicationSettingsStore.settings.length > 0 &&
      !applicationSettingsStore.eventsEnabled
    ) {
      navigateTo("/");
    }
  },
  { immediate: true },
);

const finishedRow = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);
</script>

<template>
  <PageTransition>
    <TacticalPageHeader inline-actions>
      <template #title>{{ $t("pages.events.title") }}</template>
      <template #subtitle>{{ $t("pages.events.description") }}</template>
      <template #actions>
        <NuxtLink
          v-if="canCreateEvent"
          :to="{ name: 'events-create' }"
          :class="[
            tacticalCtaButtonClasses,
            tacticalHeaderActionClasses,
            'max-lg:aspect-square max-lg:!px-0',
          ]"
          :title="$t('pages.events.create')"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden lg:inline">{{ $t("pages.events.create") }}</span>
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <div v-if="loading" class="space-y-4">
      <Skeleton v-for="i in 3" :key="i" class="h-28 w-full rounded-md" />
    </div>

    <Empty v-else-if="!hasEvents" class="min-h-[200px]">
      <EmptyTitle>{{ $t("pages.events.no_events_title") }}</EmptyTitle>
      <EmptyDescription>{{
        $t("pages.events.no_events_description")
      }}</EmptyDescription>
    </Empty>

    <div v-else class="space-y-10">
      <!-- LIVE (heroes, on top) -->
      <section v-if="liveEvents.length">
        <div :class="[tacticalSectionLabelClasses]">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.events.live_now") }}
        </div>
        <div class="grid gap-4">
          <EventHero
            v-for="event in visibleLiveEvents"
            :key="event.id"
            :event="event"
          />
        </div>
        <div
          v-if="liveEvents.length > liveLimit"
          class="mt-4 flex justify-center"
        >
          <Button variant="outline" size="sm" @click="showMoreLive">
            {{ $t("pages.events.show_more") }}
          </Button>
        </div>
      </section>

      <section v-if="upcomingEvents.length">
        <div :class="[tacticalSectionLabelClasses]">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.events.upcoming") }}
        </div>
        <div class="grid gap-4">
          <EventHero
            v-for="event in visibleUpcomingEvents"
            :key="event.id"
            :event="event"
          />
        </div>
        <div
          v-if="upcomingEvents.length > upcomingLimit"
          class="mt-4 flex justify-center"
        >
          <Button variant="outline" size="sm" @click="showMoreUpcoming">
            {{ $t("pages.events.show_more") }}
          </Button>
        </div>
      </section>

      <section v-if="finishedEvents.length">
        <div
          :class="[
            tacticalSectionLabelClasses,
            '!flex w-full items-center justify-between',
          ]"
        >
          <span class="inline-flex items-center gap-2">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.events.past_events") }}
          </span>
          <ScrollArrows
            :can-left="finishedRow?.state?.canScrollLeft"
            :can-right="
              finishedRow?.state?.canScrollRight || !finishedReachedEnd
            "
            @scroll="
              (d) => {
                finishedRow?.scrollByDirection(d);
                if (d === 'right') {
                  loadMoreFinished();
                }
              }
            "
          />
        </div>
        <HorizontalScrollRow
          ref="finishedRow"
          @approaching-end="loadMoreFinished"
        >
          <EventSquare
            v-for="event in finishedEvents"
            :key="event.id"
            :event="event"
          />
        </HorizontalScrollRow>
      </section>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { simpleEventFields } from "~/graphql/simpleEventFields";
import { eventPhaseWhere } from "~/utilities/eventDisplay";

const HERO_PAGE_SIZE = 4;
const FINISHED_PAGE_SIZE = 12;

const liveEventsSubscription = typedGql("subscription")({
  events: [
    {
      where: eventPhaseWhere("live", $("now", "timestamptz!")),
      order_by: [{ starts_at: order_by.desc }],
      limit: $("limit", "Int!"),
    },
    simpleEventFields,
  ],
});

const upcomingEventsSubscription = typedGql("subscription")({
  events: [
    {
      where: eventPhaseWhere("upcoming", $("now", "timestamptz!")),
      order_by: [{ starts_at: order_by.asc }],
      limit: $("limit", "Int!"),
    },
    simpleEventFields,
  ],
});

const finishedEventsSubscription = typedGql("subscription")({
  events: [
    {
      where: eventPhaseWhere("finished", $("now", "timestamptz!")),
      order_by: [{ starts_at: order_by.desc }],
      limit: $("limit", "Int!"),
    },
    simpleEventFields,
  ],
});

export default {
  data() {
    return {
      // Captured once so every event lands in exactly one section.
      now: new Date().toISOString(),
      liveEvents: [] as any[],
      upcomingEvents: [] as any[],
      finishedEvents: [] as any[],
      liveLimit: HERO_PAGE_SIZE,
      upcomingLimit: HERO_PAGE_SIZE,
      finishedLimit: FINISHED_PAGE_SIZE,
      loadingLive: true,
      loadingUpcoming: true,
      loadingFinished: true,
    };
  },
  apollo: {
    $subscribe: {
      liveEvents: {
        query: () => liveEventsSubscription,
        // The extra row only tells "Show more" whether there is anything left.
        variables(this: any) {
          return { now: this.now, limit: this.liveLimit + 1 };
        },
        result(this: any, { data }: { data: any }) {
          this.liveEvents = data?.events ?? [];
          this.loadingLive = false;
        },
        error(this: any) {
          this.loadingLive = false;
        },
      },
      upcomingEvents: {
        query: () => upcomingEventsSubscription,
        variables(this: any) {
          return { now: this.now, limit: this.upcomingLimit + 1 };
        },
        result(this: any, { data }: { data: any }) {
          this.upcomingEvents = data?.events ?? [];
          this.loadingUpcoming = false;
        },
        error(this: any) {
          this.loadingUpcoming = false;
        },
      },
      finishedEvents: {
        query: () => finishedEventsSubscription,
        variables(this: any) {
          return { now: this.now, limit: this.finishedLimit };
        },
        result(this: any, { data }: { data: any }) {
          this.finishedEvents = data?.events ?? [];
          this.loadingFinished = false;
        },
        error(this: any) {
          this.loadingFinished = false;
        },
      },
    },
  },
  computed: {
    loading(): boolean {
      return this.loadingLive || this.loadingUpcoming || this.loadingFinished;
    },
    visibleLiveEvents(): any[] {
      return this.liveEvents.slice(0, this.liveLimit);
    },
    visibleUpcomingEvents(): any[] {
      return this.upcomingEvents.slice(0, this.upcomingLimit);
    },
    hasEvents(): boolean {
      return (
        this.liveEvents.length > 0 ||
        this.upcomingEvents.length > 0 ||
        this.finishedEvents.length > 0
      );
    },
    // Also true while a bigger page loads, so loadMoreFinished can't stack.
    finishedReachedEnd(): boolean {
      return this.finishedEvents.length < this.finishedLimit;
    },
    canCreateEvent() {
      const me = useAuthStore().me;
      if (!me) {
        return false;
      }

      // Gate on the same setting the backend authorizes event inserts with
      // (public.create_events_role), so the button's visibility matches the
      // server's actual permission.
      return useAuthStore().isRoleAbove(
        useApplicationSettingsStore().eventCreateRole,
      );
    },
  },
  methods: {
    showMoreLive() {
      this.liveLimit += HERO_PAGE_SIZE;
    },
    showMoreUpcoming() {
      this.upcomingLimit += HERO_PAGE_SIZE;
    },
    loadMoreFinished() {
      if (this.finishedReachedEnd) {
        return;
      }
      this.finishedLimit += FINISHED_PAGE_SIZE;
    },
  },
};
</script>
