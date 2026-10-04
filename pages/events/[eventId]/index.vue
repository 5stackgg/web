<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { validate as validateUUID } from "uuid";
import { Trash2, Medal, Play, Share2, Trophy } from "lucide-vue-next";
import { NuxtLink } from "#components";
import AwardComposer from "~/components/award/AwardComposer.vue";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import PlayerMatchesTable from "~/components/player/PlayerMatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import EventHeader from "~/components/events/EventHeader.vue";
import MobileTabSelect from "~/components/common/MobileTabSelect.vue";
import EventSection from "~/components/events/EventSection.vue";
import EventLeaderboard from "~/components/events/EventLeaderboard.vue";
import EventStandings from "~/components/events/EventStandings.vue";
import EventMembershipPanel from "~/components/events/EventMembershipPanel.vue";
import EventForm from "~/components/events/EventForm.vue";
import EventMediaPanel from "~/components/events/EventMediaPanel.vue";
import HighlightsBrowser from "~/components/clips/HighlightsBrowser.vue";
import EventTeamsPanel from "~/components/events/EventTeamsPanel.vue";
import EventOverview from "~/components/events/EventOverview.vue";
import EventBannerUpload from "~/components/events/EventBannerUpload.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import TournamentCard from "~/components/tournament/TournamentCard.vue";
import { tournamentStatusVariant } from "~/components/tournament/tournamentCard";
import { TICKER_LIVE_STATUSES } from "~/components/watch/watchTicker";
import { useEventMatches } from "~/composables/useEventMatches";
import { useMatchRowStats } from "~/composables/useMatchRowStats";
import { tacticalSectionLabelClasses } from "~/utilities/tacticalClasses";
import { eventPhase, type EventPhase } from "~/utilities/eventDisplay";
import { useEventContext } from "~/composables/useEventContext";

definePageMeta({
  persistQueryKeys: ["player", "since", "kills", "view", "sort"],
});

// Reflect the event name in the browser tab / in-app title (nuxt.config's
// titleTemplate appends " | 5Stack"). The context is populated by the
// subscription in the Options block below.
const eventContext = useEventContext();
useHead({
  title: () => eventContext.value?.name || undefined,
});

// The tabs before the redesign folded into these; old links still land.
const LEGACY_TABS: Record<string, string> = {
  leaderboard: "players",
  standings: "players",
  teams: "players",
  highlights: "media",
  settings: "manage",
};
const route = useRoute();
const router = useRouter();
const legacyTab = route.query.tab ? LEGACY_TABS[String(route.query.tab)] : null;
const mediaView = ref<"uploads" | "highlights">(
  route.query.tab === "highlights" ? "highlights" : "uploads",
);
if (legacyTab) {
  router.replace({ query: { ...route.query, tab: legacyTab } });
}

const activeTab = useRouteTab({
  defaultTab: "overview",
  tabs: ["overview", "matches", "players", "media", "tournaments", "manage"],
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

const eventIdRef = computed<string | null>(() => {
  const id = route.params.eventId;
  return typeof id === "string" && validateUUID(id) ? id : null;
});

const {
  matches: eventMatches,
  total: matchesTotal,
  page: matchesPage,
  perPage: matchesPerPage,
  loading: matchesLoading,
  paging: matchesPaging,
  mine: matchesMine,
  setMine: setMatchesMine,
  setPage: setMatchesPage,
  setPerPage: setMatchesPerPage,
  refetch: refetchEventMatches,
} = useEventMatches(eventIdRef);

const me = computed(() => useAuthStore().me);
const signedIn = computed(() => !!me.value);
const matchesView = computed({
  get: () => (matchesMine.value ? "mine" : "all"),
  set: (value: "all" | "mine") => setMatchesMine(value === "mine"),
});

// "Mine" reads each row from the viewer, like their profile; "All" shows
// both sides with the match's top player.
const {
  statsByMatch: matchStats,
  ratingByMatch: matchRatings,
  topPlayerByMatch: matchTopPlayers,
} = useMatchRowStats(
  eventMatches,
  computed(() =>
    matchesMine.value && me.value ? String(me.value.steam_id) : null,
  ),
);

// The newest live match, for the header's Watch live.
const liveMatch = computed(() =>
  eventMatches.value.find((match) =>
    (TICKER_LIVE_STATUSES as readonly string[]).includes(match.status),
  ),
);

const tabTriggerClasses =
  "h-11 rounded-none px-3 text-[0.8125rem] font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-offset-0 [@media(pointer:coarse)]:h-12";
</script>

<template>
  <div v-if="loading" class="space-y-6">
    <Skeleton class="aspect-[3/1] max-h-[440px] w-full rounded-2xl" />
    <Skeleton class="h-72 w-full rounded-lg" />
  </div>

  <Empty v-else-if="!event" class="min-h-[200px]">
    <EmptyTitle>{{ $t("event.not_found.title") }}</EmptyTitle>
    <EmptyDescription>{{ $t("event.not_found.description") }}</EmptyDescription>
  </Empty>

  <div v-else>
    <Tabs v-model="activeTab">
      <PageTransition>
        <EventHeader
          :event="event"
          :phase="phase"
          :organizers="organizedByPlayers"
          :counts="{
            players: eventPlayers.length,
            teams: eventTeams.length,
            matches: matchesTotal,
          }"
          :can-manage="event.is_organizer"
          @add-banner="activeTab = 'manage'"
        >
          <template #actions>
            <Button
              v-if="canGrantAwards"
              variant="outline"
              size="sm"
              class="h-8 gap-1.5"
              @click="awardComposerOpen = true"
            >
              <Medal class="h-3.5 w-3.5" />
              {{ $t("awards.composer.grant_here") }}
            </Button>
            <Button
              v-if="phase === 'live' && liveMatch"
              as-child
              size="sm"
              class="h-8 gap-1.5 border border-destructive/55 bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              <NuxtLink :to="`/matches/${liveMatch.id}`">
                <Play class="h-3.5 w-3.5 fill-current" />
                {{ $t("event.header.watch_live") }}
              </NuxtLink>
            </Button>
            <Button
              v-else-if="phase === 'upcoming' && openTournaments.length"
              :as="registerLink ? NuxtLink : 'button'"
              :to="registerLink ?? undefined"
              size="sm"
              class="tac-amber-cta h-8 gap-1.5 border font-semibold"
              @click="!registerLink && (activeTab = 'tournaments')"
            >
              <Trophy class="h-3.5 w-3.5" />
              {{ $t("event.header.register") }}
            </Button>
            <Button
              v-else-if="phase === 'finished'"
              variant="outline"
              size="sm"
              class="h-8 gap-1.5"
              @click="shareEvent"
            >
              <Share2 class="h-3.5 w-3.5" />
              {{ $t("event.header.share") }}
            </Button>
          </template>
          <template #tabs>
            <MobileTabSelect
              v-model="activeTab"
              :items="tabItems"
              class="px-2 pb-4"
            />
            <TabsList
              variant="underline"
              class="h-auto w-full justify-start overflow-x-auto overscroll-x-contain [scrollbar-width:none] max-md:hidden [&::-webkit-scrollbar]:hidden"
            >
              <TabsTrigger value="overview" :class="tabTriggerClasses">
                {{ $t("event.tabs.overview") }}
              </TabsTrigger>
              <TabsTrigger value="matches" :class="tabTriggerClasses">
                {{ $t("event.tabs.matches") }}
              </TabsTrigger>
              <TabsTrigger value="players" :class="tabTriggerClasses">
                {{ $t("event.tabs.players") }}
              </TabsTrigger>
              <TabsTrigger value="media" :class="tabTriggerClasses">
                {{ $t("event.tabs.media") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="hasTournaments"
                value="tournaments"
                :class="tabTriggerClasses"
              >
                {{ $t("event.tabs.tournaments") }}
              </TabsTrigger>
              <TabsTrigger
                v-if="event.is_organizer"
                value="manage"
                :class="tabTriggerClasses"
              >
                {{ $t("event.tabs.manage") }}
              </TabsTrigger>
            </TabsList>
          </template>
        </EventHeader>
      </PageTransition>

      <div class="mt-7">
        <TabsContent value="overview" class="tab-panel-in mt-0">
          <EventOverview
            :event="event"
            :phase="phase"
            :refresh-key="membershipKey"
            :matches="eventMatches"
            :matches-total="matchesTotal"
            :matches-loading="matchesLoading"
            :leaderboard-rows="leaderboardRows"
            :leaderboard-loading="
              $apollo?.queries?.leaderboardRows?.loading ?? false
            "
            :players="eventPlayers"
            :teams="eventTeams"
            @go="(tab) => (activeTab = tab)"
          />
        </TabsContent>

        <TabsContent value="matches" class="tab-panel-in mt-0">
          <div v-if="signedIn" class="mb-4">
            <WatchSegmented
              v-model="matchesView"
              :options="[
                { key: 'all', label: $t('event.matches.all') },
                { key: 'mine', label: $t('event.matches.mine') },
              ]"
              :label="$t('event.tabs.matches')"
            />
          </div>
          <div v-if="matchesLoading" class="space-y-3">
            <Skeleton v-for="i in 4" :key="i" class="h-16 w-full rounded-md" />
          </div>
          <Empty v-else-if="eventMatches.length === 0" class="min-h-[160px]">
            <p class="text-muted-foreground">
              {{
                matchesMine
                  ? $t("event.matches.none_mine")
                  : $t("event.matches.none")
              }}
            </p>
          </Empty>
          <div v-else>
            <div :class="{ 'opacity-60': matchesPaging }">
              <PlayerMatchesTable
                :matches="eventMatches"
                :player="matchesMine ? me : null"
                :neutral="!matchesMine"
                :stats-by-match="matchStats"
                :rating-by-match="matchRatings"
                :top-player-by-match="matchTopPlayers"
              />
            </div>
            <Pagination
              v-if="matchesTotal > 0"
              :total="matchesTotal"
              :page="matchesPage"
              :per-page="matchesPerPage"
              show-per-page-selector
              @page="setMatchesPage"
              @update:per-page="setMatchesPerPage"
            />
          </div>
        </TabsContent>

        <TabsContent value="players" class="tab-panel-in mt-0">
          <div class="grid gap-10">
            <EventTeamsPanel
              v-if="leaderboardRows.length && eventTeams.length"
              :teams="eventTeams"
            />
            <EventTeamsPanel
              v-else-if="!leaderboardRows.length"
              :teams="eventTeams"
              :players="eventPlayers"
            />
            <EventSection
              v-if="hasTournaments"
              :label="$t('event.tabs.standings')"
            >
              <EventStandings
                :event-id="event.id"
                :refresh-key="membershipKey"
              />
            </EventSection>
            <EventSection
              v-if="leaderboardRows.length"
              :label="$t('event.tabs.leaderboard')"
            >
              <EventLeaderboard
                :event-id="event.id"
                :refresh-key="membershipKey"
              />
            </EventSection>
          </div>
        </TabsContent>

        <TabsContent value="media" class="tab-panel-in mt-0">
          <div v-if="highlightsCount > 0" class="mb-5">
            <WatchSegmented
              v-model="mediaView"
              :options="[
                {
                  key: 'uploads',
                  label: $t('event.media.uploads'),
                  count: galleryCount,
                },
                {
                  key: 'highlights',
                  label: $t('event.tabs.highlights'),
                  count: highlightsCount,
                },
              ]"
              :label="$t('event.tabs.media')"
            />
          </div>
          <HighlightsBrowser
            v-if="highlightsCount > 0 && mediaView === 'highlights'"
            :event-id="event.id"
          />
          <EventMediaPanel v-else :event="event" />
        </TabsContent>

        <TabsContent
          v-if="hasTournaments"
          value="tournaments"
          class="tab-panel-in mt-0"
        >
          <div class="space-y-4">
            <TournamentCard
              v-for="(entry, index) in eventTournamentEntries"
              :key="entry.tournament_id"
              :tournament="entry.tournament"
              :status-variant="tournamentStatusVariant(entry.tournament.status)"
              :priority="index === 0"
            />
          </div>
        </TabsContent>

        <TabsContent
          v-if="event.is_organizer"
          value="manage"
          class="tab-panel-in mt-0"
        >
          <div class="space-y-6 pb-24">
            <ManageSection :label="$t('event.banner.section')">
              <EventBannerUpload :event="event" />
            </ManageSection>

            <EventForm :event="event" />

            <EventMembershipPanel :event="event" />

            <!-- Delete is narrower than is_organizer: Hasura only allows
                 the creator or tournament_organizer+ to delete, never
                 co-organizers. -->
            <!-- Danger zone keeps its tinted frame: the destructive action
                 needs to stay visually fenced off from the settings above. -->
            <section
              v-if="canDeleteEvent"
              class="rounded-lg border border-destructive/40 bg-destructive/5 p-5"
            >
              <span
                :class="[tacticalSectionLabelClasses, 'mb-1']"
                class="!text-destructive"
              >
                <span
                  class="inline-block h-[2px] w-[10px] bg-destructive"
                ></span>
                {{ $t("event.danger_zone.title") }}
              </span>
              <p class="mb-3 text-sm text-muted-foreground">
                {{ $t("event.danger_zone.description") }}
              </p>
              <Button
                variant="destructive"
                size="sm"
                class="gap-1.5"
                @click="deleteEventDialog = true"
              >
                <Trash2 class="h-3.5 w-3.5" />
                {{ $t("common.delete") }}
              </Button>
            </section>
          </div>
        </TabsContent>
      </div>
    </Tabs>

    <AlertDialog
      :open="deleteEventDialog"
      @update:open="(open: boolean) => (deleteEventDialog = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("event.confirm.delete.title")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("event.confirm.delete.description", { name: event.name }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <!-- Plain Button, not AlertDialogAction: the action auto-closes the
               dialog before an async handler runs. -->
          <Button
            variant="destructive"
            :loading="deletingEvent"
            @click="deleteEvent"
          >
            {{ $t("common.delete") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>

  <AwardComposer
    v-if="event && awardComposerOpen"
    v-model:open="awardComposerOpen"
    :event-id="event.id"
  />
</template>

<script lang="ts">
import gql from "graphql-tag";
import { validate as validateUUIDOptions } from "uuid";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by, e_player_roles_enum } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { simpleEventFields } from "~/graphql/simpleEventFields";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
import { toast } from "@/components/ui/toast";

const deleteEventMutation = generateMutation({
  delete_events_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    {
      __typename: true,
    },
  ],
});

const eventSubscription = typedGql("subscription")({
  events_by_pk: [
    { id: $("eventId", "uuid!") },
    {
      ...simpleEventFields,
      tournaments: [
        {},
        {
          tournament_id: true,
          // The full card field set: the event's tournaments render with the
          // same TournamentCard the /tournaments and /watch lists use.
          tournament: {
            ...simpleTournamentFields,
            status: true,
            teams: [
              {},
              {
                id: true,
                name: true,
                team_id: true,
                team: {
                  id: true,
                  name: true,
                  short_name: true,
                  avatar_url: true,
                },
              },
            ],
          },
        },
      ],
      teams: [
        {},
        {
          team_id: true,
          team: {
            id: true,
            name: true,
            short_name: true,
            avatar_url: true,
          },
        },
      ],
      media: [
        { order_by: [{ created_at: order_by.desc }] },
        {
          id: true,
          filename: true,
          mime_type: true,
          title: true,
          thumbnail_filename: true,
          external_url: true,
          size: true,
          created_at: true,
          uploader_steam_id: true,
          uploader: { name: true },
          players: [
            {},
            {
              steam_id: true,
              player: { steam_id: true, name: true, avatar_url: true },
            },
          ],
        },
      ],
      players: [
        {},
        {
          steam_id: true,
          player: { steam_id: true, name: true, avatar_url: true },
        },
      ],
    },
  ],
});

// One rating pass over every participant (no round minimum), ordered by
// value: feeds the overview's "For you" stats, the top-5 preview, and the
// players-tab fallback when the event has no directly-attached players.
const EVENT_LEADERBOARD_ROWS = gql`
  query EventLeaderboardRows($eventId: uuid!) {
    get_event_leaderboard(
      args: {
        _event_id: $eventId
        _category: "rating"
        _match_type: null
        _min_rounds: 0
      }
      order_by: [{ value: desc }]
    ) {
      player_steam_id
      player_name
      player_avatar_url
      player_country
      value
      secondary_value
      tertiary_value
      matches_played
    }
  }
`;

const EVENT_HIGHLIGHTS_COUNT = typedGql("query")({
  match_clips_aggregate: [
    {
      where: {
        visibility: { _eq: "public" },
        match_map: {
          match: {
            event_links: { event_id: { _eq: $("eventId", "uuid!") } },
          },
        },
      },
    },
    { aggregate: { count: true } },
  ],
});

export default {
  data() {
    return {
      awardComposerOpen: false,
      event: undefined as any,
      loading: true,
      leaderboardRows: [] as any[],
      highlightsCount: 0,
      deleteEventDialog: false,
      deletingEvent: false,
    };
  },
  unmounted() {
    useEventContext().value = null;
  },
  apollo: {
    leaderboardRows: {
      query: EVENT_LEADERBOARD_ROWS,
      fetchPolicy: "network-only",
      variables(this: any) {
        return { eventId: this.$route.params.eventId };
      },
      skip(this: any) {
        return !this.event;
      },
      update(data: any) {
        return data?.get_event_leaderboard || [];
      },
    },
    highlightsCount: {
      query: EVENT_HIGHLIGHTS_COUNT,
      fetchPolicy: "network-only",
      variables(this: any) {
        return { eventId: this.$route.params.eventId };
      },
      skip(this: any) {
        return !this.event;
      },
      update(data: any) {
        return Number(data?.match_clips_aggregate?.aggregate?.count) || 0;
      },
    },
    $subscribe: {
      events_by_pk: {
        query: () => eventSubscription,
        variables(this: any) {
          const eventId = this.$route.params.eventId;
          // A malformed id errors the subscription, which (without the error
          // handler below) would leave the skeleton up forever; show the
          // not-found state instead of subscribing with a non-uuid.
          if (typeof eventId !== "string" || !validateUUIDOptions(eventId)) {
            this.event = null;
            this.loading = false;
            return undefined;
          }
          return { eventId };
        },
        result(this: any, { data }: { data: any }) {
          this.event = data?.events_by_pk ?? null;
          this.loading = false;

          const ctx = useEventContext();
          ctx.value = this.event
            ? {
                id: this.event.id,
                name: this.event.name,
              }
            : null;
        },
        error(this: any) {
          this.loading = false;
        },
      },
    },
  },
  watch: {
    // A shared link to a tab this viewer or event doesn't have lands on the
    // overview instead of an empty panel.
    tabUnavailable: {
      handler(this: any, unavailable: boolean) {
        if (unavailable) this.activeTab = "overview";
      },
      immediate: true,
    },
    // Attaching/detaching tournaments, teams or players must recompute the
    // derived surfaces retroactively: matches, leaderboard rows, and (via the
    // refresh-key props) the leaderboard/standings tabs.
    membershipKey(this: any, _newKey: string, oldKey: string | undefined) {
      if (oldKey === undefined) {
        return;
      }
      this.$apollo?.queries?.leaderboardRows?.refetch();
      this.$apollo?.queries?.highlightsCount?.refetch();
      this.refetchEventMatches?.();
    },
  },
  computed: {
    canGrantAwards() {
      return useApplicationSettingsStore().canGrantAwards;
    },
    // Mirrors the Hasura delete permission on events: the creating organizer,
    // or tournament_organizer and above. Co-organizers can manage the event
    // (is_organizer) but cannot delete it.
    canDeleteEvent(): boolean {
      const me = useAuthStore().me;
      if (!me || !this.event) {
        return false;
      }
      return (
        String(this.event.organizer_steam_id) === String(me.steam_id) ||
        useAuthStore().isRoleAbove(e_player_roles_enum.tournament_organizer)
      );
    },
    tabUnavailable(): boolean {
      if (!this.event) return false;
      return (
        (this.activeTab === "manage" && !this.event.is_organizer) ||
        (this.activeTab === "tournaments" && !this.hasTournaments)
      );
    },
    phase(): EventPhase {
      return this.event ? eventPhase(this.event) : "upcoming";
    },
    openTournaments(): any[] {
      return this.eventTournamentEntries.filter(
        (entry: any) => entry.tournament.status === "RegistrationOpen",
      );
    },
    // One open tournament: Register opens its join sheet (sign in first when
    // signed out). Several: it switches to the Tournaments tab to pick one.
    registerLink(): string | null {
      if (this.openTournaments.length !== 1) return null;
      const path = `/tournaments/${this.openTournaments[0].tournament.id}?join=1`;
      return useAuthStore().me
        ? path
        : `/login?redirect=${encodeURIComponent(path)}`;
    },
    // "Organized by" = the co-organizers plus the creator, unless the creator
    // has been hidden from the display (they remain the owner regardless).
    organizedByPlayers(): any[] {
      if (!this.event) return [];
      const list: any[] = [];
      if (!this.event.hide_creator_organizer && this.event.organizer) {
        list.push({
          steam_id: this.event.organizer_steam_id,
          ...this.event.organizer,
        });
      }
      for (const entry of this.event.organizers || []) {
        if (String(entry.steam_id) === String(this.event.organizer_steam_id)) {
          continue;
        }
        list.push({ steam_id: entry.steam_id, ...entry.organizer });
      }
      return list;
    },
    galleryCount(): number {
      return (this.event?.media || []).filter(
        (item: any) => item.id !== this.event?.banner_media_id,
      ).length;
    },
    hasTournaments(): boolean {
      return this.eventTournamentEntries.length > 0;
    },
    tabItems(): Array<{ value: string; label: string }> {
      return [
        "overview",
        "matches",
        "players",
        "media",
        ...(this.hasTournaments ? ["tournaments"] : []),
        ...(this.event?.is_organizer ? ["manage"] : []),
      ].map((value) => ({ value, label: this.$t(`event.tabs.${value}`) }));
    },
    membershipKey(): string {
      return [
        this.event?.tournaments?.length ?? 0,
        this.event?.teams?.length ?? 0,
        this.event?.players?.length ?? 0,
      ].join(":");
    },
    eventTournamentEntries(): any[] {
      // A member tournament the viewer cannot read resolves its nested
      // `tournament` to null; drop those so the template can dereference
      // entry.tournament safely and the tab count stays accurate.
      return (this.event?.tournaments || []).filter(
        (entry: any) => !!entry.tournament,
      );
    },
    eventTeams(): Array<any> {
      if (!this.event) return [];

      const direct = (this.event.teams || [])
        .filter((et: any) => et.team)
        .map((et: any) => ({
          id: et.team.id,
          name: et.team.name,
          short_name: et.team.short_name,
          avatar_url: et.team.avatar_url,
        }));
      if (direct.length > 0) {
        return direct;
      }

      // Fallback: union of teams rostered in the event's member tournaments.
      const seen = new Set<string>();
      const fallback: any[] = [];
      for (const entry of this.event.tournaments || []) {
        for (const tt of entry.tournament?.teams || []) {
          const key = tt.team?.id || tt.id;
          if (seen.has(key)) continue;
          seen.add(key);
          fallback.push({
            id: tt.team?.id ?? null,
            name: tt.team?.name ?? tt.name,
            short_name: tt.team?.short_name ?? null,
            avatar_url: tt.team?.avatar_url ?? null,
          });
        }
      }
      return fallback;
    },
    eventPlayers(): any[] {
      if (!this.event) return [];

      const direct = (this.event.players || [])
        .filter((ep: any) => ep.player)
        .map((ep: any) => ep.player);
      if (direct.length > 0) {
        return direct;
      }

      return this.leaderboardRows.map((row: any) => ({
        steam_id: row.player_steam_id,
        name: row.player_name,
        avatar_url: row.player_avatar_url,
        country: row.player_country,
      }));
    },
  },
  methods: {
    async shareEvent(this: any) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({ title: this.$t("event.header.link_copied") as string });
      } catch {
        toast({
          variant: "destructive",
          title: this.$t("common.error") as string,
        });
      }
    },
    async deleteEvent(this: any) {
      if (this.deletingEvent) {
        return;
      }
      this.deletingEvent = true;
      try {
        await this.$apollo.mutate({
          mutation: deleteEventMutation,
          variables: {
            id: this.$route.params.eventId,
          },
        });
        this.deleteEventDialog = false;
        toast({
          title: this.$t("event.deleted") as string,
        });
        await navigateTo("/events");
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error") as string,
          description: error?.message,
        });
      } finally {
        this.deletingEvent = false;
      }
    },
  },
};
</script>
