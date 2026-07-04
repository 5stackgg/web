<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PlusCircle } from "lucide-vue-next";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Pagination from "~/components/Pagination.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import EventCard from "~/components/events/EventCard.vue";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
} from "~/utilities/tacticalClasses";

// Keep the page query param out of the NuxtPage page-key (app.vue) so paging
// updates the URL without remounting/refetching the whole list.
definePageMeta({
  persistQueryKeys: ["page"],
});

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
  <PageTransition :delay="0">
    <TacticalPageHeader inline-actions>
      <template #title>{{ $t("pages.manage_events.title") }}</template>
      <template #subtitle>{{
        $t("pages.manage_events.description")
      }}</template>
      <template v-if="canManageEvents" #actions>
        <NuxtLink
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
      <EmptyTitle>{{ $t("pages.manage_events.no_events_title") }}</EmptyTitle>
      <EmptyDescription>{{
        $t("pages.manage_events.no_events_description")
      }}</EmptyDescription>
    </Empty>

    <div v-else class="space-y-4">
      <EventCard v-for="event in events" :key="event.id" :event="event" />
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
import { $, order_by, e_player_roles_enum } from "~/generated/zeus";
import { simpleEventFields } from "~/graphql/simpleEventFields";

const myEventsSubscription = typedGql("subscription")({
  events: [
    {
      order_by: [{ starts_at: order_by.desc_nulls_last }],
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
      where: $("where", "events_bool_exp!"),
    },
    simpleEventFields,
  ],
  events_aggregate: [
    {
      where: $("where", "events_bool_exp!"),
    },
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
      perPage: usePerPage("events-manage"),
      loading: true,
    };
  },
  apollo: {
    $subscribe: {
      events: {
        query: () => myEventsSubscription,
        variables(this: any) {
          const me = useAuthStore().me;

          if (!me) {
            this.loading = false;
            this.events = [];
            this.eventsTotal = 0;
            return undefined;
          }

          const q = this.$route?.query || {};
          const rawPage = typeof q.page === "string" ? parseInt(q.page, 10) : 1;
          const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

          // is_event_organizer treats admin/administrator/tournament_organizer
          // as an organizer of every event, so those roles can manage them all;
          // scope the list to match. `is_organizer` is a computed column and
          // cannot appear in a where-filter, so a regular organizer is scoped
          // by the concrete columns instead: directly organizing, or listed in
          // the event_organizers relationship.
          const managesAllEvents = useAuthStore().isRoleAbove(
            e_player_roles_enum.tournament_organizer,
          );

          return {
            limit: this.perPage,
            offset: (page - 1) * this.perPage,
            where: managesAllEvents
              ? {}
              : {
                  _or: [
                    { organizer_steam_id: { _eq: me.steam_id } },
                    { organizers: { steam_id: { _eq: me.steam_id } } },
                  ],
                },
          };
        },
        result(this: any, { data }: { data: any }) {
          this.events = data?.events ?? [];
          this.eventsTotal = data?.events_aggregate?.aggregate?.count ?? 0;
          this.loading = false;
        },
        error(this: any) {
          // Without this, a subscription error never clears loading and the
          // skeleton shows forever.
          this.loading = false;
        },
      },
    },
  },
  computed: {
    canManageEvents() {
      const me = useAuthStore().me;
      if (!me) {
        return false;
      }

      // Gate on the same setting the backend authorizes event inserts with
      // (public.create_events_role), matching pages/events/index.vue.
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
