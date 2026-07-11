<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PlusCircle } from "lucide-vue-next";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Pagination from "~/components/Pagination.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import EventHero from "~/components/events/EventHero.vue";
import EventSquare from "~/components/events/EventSquare.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
} from "~/utilities/tacticalClasses";

// Keep the page query param out of the NuxtPage page-key (app.vue) so
// paging updates the URL without remounting/refetching the whole list.
// Events have no other filters yet, so this is the only persisted key.
definePageMeta({
  persistQueryKeys: ["page"],
});

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

const route = useRoute();
const router = useRouter();

const page = computed<number>(() => {
  const v = route.query.page;
  const n = typeof v === "string" ? parseInt(v, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
});

function setPage(p: number) {
  const next = { ...route.query } as Record<string, any>;
  if (p <= 1) delete next.page;
  else next.page = String(p);
  router.replace({ path: route.path, query: next, hash: route.hash });
}
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
      <Skeleton v-for="i in perPage" :key="i" class="h-28 w-full rounded-md" />
    </div>

    <Empty v-else-if="events.length === 0" class="min-h-[200px]">
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
            v-for="event in liveEvents"
            :key="event.id"
            :event="event"
          />
        </div>
      </section>

      <!-- UPCOMING (small banner squares) -->
      <section v-if="upcomingEvents.length">
        <div :class="[tacticalSectionLabelClasses]">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.events.upcoming") }}
        </div>
        <div
          class="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]"
        >
          <EventSquare
            v-for="event in upcomingEvents"
            :key="event.id"
            :event="event"
          />
        </div>
      </section>

      <!-- FINISHED (heroes) -->
      <section v-if="finishedEvents.length">
        <div :class="[tacticalSectionLabelClasses]">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.events.past_events") }}
        </div>
        <div class="grid gap-4 lg:grid-cols-2">
          <EventHero
            v-for="event in finishedEvents"
            :key="event.id"
            :event="event"
          />
        </div>
      </section>
    </div>

    <Pagination
      v-if="!loading && eventsTotal > perPage"
      class="mt-6"
      :page="page"
      :per-page="perPage"
      :total="eventsTotal"
      :show-per-page-selector="true"
      @page="setPage"
      @update:per-page="
        (value: number) => {
          onPerPageChange(value);
          setPage(1);
        }
      "
    />
  </PageTransition>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { simpleEventFields } from "~/graphql/simpleEventFields";
import { eventPhase } from "~/utilities/eventDisplay";

// A GraphQL subscription may only select a single top-level field, so the
// list and its total count are two separate subscriptions.
const eventsSubscription = typedGql("subscription")({
  events: [
    {
      order_by: [{ starts_at: order_by.desc_nulls_last }],
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
    },
    simpleEventFields,
  ],
});

const eventsAggregateSubscription = typedGql("subscription")({
  events_aggregate: [
    {},
    {
      aggregate: {
        count: true,
      },
    },
  ],
});

export default {
  data() {
    return {
      events: [] as any[],
      eventsTotal: 0,
      perPage: usePerPage("events"),
      loading: true,
    };
  },
  apollo: {
    $subscribe: {
      events: {
        query: () => eventsSubscription,
        variables(this: any) {
          const q = this.$route?.query || {};
          const rawPage = typeof q.page === "string" ? parseInt(q.page, 10) : 1;
          const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
          return {
            limit: this.perPage,
            offset: (page - 1) * this.perPage,
          };
        },
        result(this: any, { data }: { data: any }) {
          this.events = data?.events ?? [];
          this.loading = false;
        },
        error(this: any) {
          // Without this, a subscription error never clears loading and the
          // skeleton shows forever.
          this.loading = false;
        },
      },
      eventsTotal: {
        query: () => eventsAggregateSubscription,
        result(this: any, { data }: { data: any }) {
          this.eventsTotal = data?.events_aggregate?.aggregate?.count ?? 0;
        },
      },
    },
  },
  computed: {
    liveEvents(): any[] {
      return (this.events || []).filter((e: any) => eventPhase(e) === "live");
    },
    upcomingEvents(): any[] {
      return (this.events || [])
        .filter((e: any) => eventPhase(e) === "upcoming")
        .sort(
          (a: any, b: any) =>
            new Date(a.starts_at || 0).getTime() -
            new Date(b.starts_at || 0).getTime(),
        );
    },
    finishedEvents(): any[] {
      return (this.events || []).filter(
        (e: any) => eventPhase(e) === "finished",
      );
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
    onPerPageChange(value: number) {
      this.perPage = value;
    },
  },
};
</script>
