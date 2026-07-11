<script setup lang="ts">
import { computed, watch } from "vue";
import { validate as validateUUID } from "uuid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import MatchesTable from "~/components/MatchesTable.vue";
import EventLeaderboard from "~/components/events/EventLeaderboard.vue";
import EventStandings from "~/components/events/EventStandings.vue";
import EventMembershipPanel from "~/components/events/EventMembershipPanel.vue";
import EventForm from "~/components/events/EventForm.vue";
import EventMediaPanel from "~/components/events/EventMediaPanel.vue";
import EventTeamsPanel from "~/components/events/EventTeamsPanel.vue";
import EventOverview from "~/components/events/EventOverview.vue";
import EventBannerUpload from "~/components/events/EventBannerUpload.vue";
import { useEventMatches } from "~/composables/useEventMatches";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";
import {
  eventPhase,
  formatEventDate,
  phaseBadgeVariant,
  phaseLabelKey,
} from "~/utilities/eventDisplay";

// Mirrors the tournament page hero (corner brackets + gradient card); the
// events hero additionally overlaps the banner media above it.
const heroCardClasses =
  "relative overflow-hidden rounded-lg border border-border px-4 py-4 sm:px-6 sm:py-5 [background:linear-gradient(180deg,hsl(var(--card)/0.82)_0%,hsl(var(--card)/0.6)_100%)] [backdrop-filter:blur(10px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";
const heroTitleClasses =
  "relative m-0 min-w-0 font-sans text-[clamp(1.6rem,4vw,2.8rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] [font-stretch:80%]";

const activeTab = useRouteTab({
  defaultTab: "overview",
  tabs: [
    "overview",
    "media",
    "leaderboard",
    "teams",
    "tournaments",
    "standings",
    "matches",
    "settings",
  ],
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
const eventIdRef = computed<string | null>(() => {
  const id = route.params.eventId;
  return typeof id === "string" && validateUUID(id) ? id : null;
});

const {
  matches: eventMatches,
  myMatches,
  total: matchesTotal,
  hasMore: matchesHasMore,
  loading: matchesLoading,
  loadingMore: matchesLoadingMore,
  loadMore: loadMoreMatches,
  refetch: refetchEventMatches,
} = useEventMatches(eventIdRef);

// Tournament status enum values are readable identifiers (e.g. "Live",
// "RegistrationOpen") without a dedicated i18n table for this trimmed card
// list, so just space out the PascalCase for display.
function formatTournamentStatus(status?: string | null): string {
  if (!status) return "";
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}
</script>

<template>
  <div v-if="loading" class="space-y-6">
    <Skeleton class="h-40 w-full rounded-lg" />
    <Skeleton class="h-72 w-full rounded-md" />
  </div>

  <Empty v-else-if="!event" class="min-h-[200px]">
    <EmptyTitle>{{ $t("event.not_found.title") }}</EmptyTitle>
    <EmptyDescription>{{ $t("event.not_found.description") }}</EmptyDescription>
  </Empty>

  <div v-else>
    <Tabs v-model="activeTab">
      <PageTransition>
        <div>
          <!-- Banner: never cropped. The sharp copy is object-contain at full
               height; the same media blurred fills the letterbox space. -->
          <!-- Width-first: the sharp copy always spans the full container
               width at its natural aspect (capped), so wide banner art is
               never boxed into the middle; the blurred copy only shows when
               the height cap letterboxes a tall image. -->
          <div
            v-if="event.banner"
            class="relative flex items-center justify-center overflow-hidden rounded-lg border border-border bg-black/60"
          >
            <img
              v-if="event.banner.mime_type.startsWith('image/')"
              :src="bannerSrc"
              aria-hidden="true"
              class="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl brightness-[0.45] saturate-125"
            />
            <video
              v-else
              :src="bannerSrc"
              aria-hidden="true"
              class="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl brightness-[0.45] saturate-125"
              muted
              playsinline
            />
            <img
              v-if="event.banner.mime_type.startsWith('image/')"
              :src="bannerSrc"
              class="relative z-[1] max-h-[min(48vh,440px)] min-h-[140px] w-full object-contain"
            />
            <video
              v-else
              :src="bannerSrc"
              class="relative z-[1] max-h-[min(48vh,440px)] min-h-[140px] w-full object-contain"
              autoplay
              muted
              loop
              playsinline
            />
            <div
              aria-hidden="true"
              class="tac-scanlines pointer-events-none absolute inset-0 z-[2]"
            ></div>
          </div>

          <div
            class="relative z-10"
            :class="event.banner ? '-mt-12 mx-3 sm:mx-6' : ''"
          >
            <header :class="heroCardClasses">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <Badge :variant="phaseBadgeVariant(eventPhase(event))">
                  {{ $t(phaseLabelKey(eventPhase(event))) }}
                </Badge>
                <span
                  v-if="event.visibility && event.visibility !== 'Public'"
                  class="inline-flex items-center rounded border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
                >
                  {{ $t(`event.visibility.${event.visibility.toLowerCase()}`) }}
                </span>
                <span
                  v-if="
                    formatEventDate(event.starts_at) ||
                    formatEventDate(event.ends_at)
                  "
                  class="text-xs text-muted-foreground"
                >
                  {{
                    formatEventDate(event.starts_at) ||
                    $t("pages.events.date_tbd")
                  }}
                  <template v-if="formatEventDate(event.ends_at)">
                    &nbsp;-&nbsp;{{ formatEventDate(event.ends_at) }}
                  </template>
                </span>
                <div
                  v-if="organizedByPlayers.length"
                  class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground"
                >
                  <span>{{ $t("event.card.organized_by") }}</span>
                  <template
                    v-for="(organizer, index) in organizedByPlayers"
                    :key="organizer.steam_id"
                  >
                    <span v-if="index > 0" class="text-muted-foreground/50"
                      >·</span
                    >
                    <PlayerDisplay
                      :player="organizer"
                      size="xs"
                      compact
                      :show-flag="false"
                      :show-role="false"
                      :show-elo="false"
                      :tooltip="false"
                      linkable
                    />
                  </template>
                </div>
              </div>

              <h1 :class="heroTitleClasses">{{ event.name }}</h1>
              <p
                v-if="event.description"
                class="mt-1.5 max-w-[70ch] text-sm text-muted-foreground"
              >
                {{ event.description }}
              </p>

              <div class="mt-4">
                <TabsList
                  variant="underline"
                  :class="[tacticalTabsListClasses, 'h-auto flex-wrap']"
                >
                  <TabsTrigger
                    value="overview"
                    :class="tacticalTabsTriggerClasses"
                  >
                    {{ $t("event.tabs.overview") }}
                  </TabsTrigger>
                  <TabsTrigger
                    value="media"
                    :class="tacticalTabsTriggerClasses"
                  >
                    {{ $t("event.tabs.media") }}
                    ({{ galleryCount }})
                  </TabsTrigger>
                  <TabsTrigger
                    value="leaderboard"
                    :class="tacticalTabsTriggerClasses"
                  >
                    {{ $t("event.tabs.leaderboard") }}
                  </TabsTrigger>
                  <TabsTrigger
                    value="teams"
                    :class="tacticalTabsTriggerClasses"
                  >
                    {{ $t("event.tabs.teams") }}
                    ({{ eventTeams.length }})
                  </TabsTrigger>
                  <TabsTrigger
                    v-if="hasTournaments"
                    value="tournaments"
                    :class="tacticalTabsTriggerClasses"
                  >
                    {{ $t("event.tabs.tournaments") }}
                    ({{ eventTournamentEntries.length }})
                  </TabsTrigger>
                  <TabsTrigger
                    v-if="hasTournaments"
                    value="standings"
                    :class="tacticalTabsTriggerClasses"
                  >
                    {{ $t("event.tabs.standings") }}
                  </TabsTrigger>
                  <TabsTrigger
                    value="matches"
                    :class="tacticalTabsTriggerClasses"
                  >
                    {{ $t("event.tabs.matches") }}
                    ({{ matchesTotal }})
                  </TabsTrigger>
                  <TabsTrigger
                    v-if="event?.is_organizer"
                    value="settings"
                    :class="tacticalTabsTriggerClasses"
                  >
                    {{ $t("event.tabs.settings") }}
                  </TabsTrigger>
                </TabsList>
              </div>
            </header>
          </div>
        </div>
      </PageTransition>

      <div class="mt-6">
        <TabsContent value="overview">
          <PageTransition>
            <EventOverview
              :event="event"
              :matches="eventMatches"
              :my-matches="myMatches"
              :matches-loading="matchesLoading"
              :leaderboard-rows="leaderboardRows"
              :leaderboard-loading="
                $apollo?.queries?.leaderboardRows?.loading ?? false
              "
              @go="(tab) => (activeTab = tab)"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="matches">
          <PageTransition>
            <div v-if="matchesLoading" class="space-y-3">
              <Skeleton
                v-for="i in 4"
                :key="i"
                class="h-16 w-full rounded-md"
              />
            </div>
            <Empty v-else-if="eventMatches.length === 0" class="min-h-[160px]">
              <p class="text-muted-foreground">
                {{ $t("event.matches.none") }}
              </p>
            </Empty>
            <div v-else>
              <MatchesTable :matches="eventMatches" />
              <div v-if="matchesHasMore" class="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  :loading="matchesLoadingMore"
                  @click="loadMoreMatches"
                >
                  {{ $t("event.matches.load_more") }}
                  ({{ eventMatches.length }}/{{ matchesTotal }})
                </Button>
              </div>
            </div>
          </PageTransition>
        </TabsContent>

        <TabsContent value="leaderboard">
          <PageTransition>
            <EventLeaderboard
              :event-id="event.id"
              :refresh-key="membershipKey"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent v-if="hasTournaments" value="standings">
          <PageTransition>
            <EventStandings :event-id="event.id" :refresh-key="membershipKey" />
          </PageTransition>
        </TabsContent>

        <TabsContent v-if="hasTournaments" value="tournaments">
          <PageTransition>
            <div :class="[tacticalSectionLabelClasses]">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("event.tabs.tournaments") }}
            </div>

            <Empty
              v-if="eventTournamentEntries.length === 0"
              class="min-h-[160px]"
            >
              <p class="text-muted-foreground">
                {{ $t("event.tournaments.none") }}
              </p>
            </Empty>

            <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NuxtLink
                v-for="entry in eventTournamentEntries"
                :key="entry.tournament_id"
                :to="{
                  name: 'tournaments-tournamentId',
                  params: { tournamentId: entry.tournament.id },
                }"
                class="block rounded-md border border-border/70 bg-card/40 p-4 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.4)] hover:bg-card/60"
              >
                <div class="flex items-center justify-between gap-2">
                  <Badge variant="outline">
                    {{ formatTournamentStatus(entry.tournament.status) }}
                  </Badge>
                  <span
                    v-if="formatEventDate(entry.tournament.start)"
                    class="text-xs text-muted-foreground"
                  >
                    {{ formatEventDate(entry.tournament.start) }}
                  </span>
                </div>
                <h3
                  class="mt-2 truncate font-sans text-base font-bold text-foreground"
                >
                  {{ entry.tournament.name }}
                </h3>
              </NuxtLink>
            </div>
          </PageTransition>
        </TabsContent>

        <TabsContent value="teams">
          <PageTransition>
            <EventTeamsPanel :teams="eventTeams" :players="eventPlayers" />
          </PageTransition>
        </TabsContent>

        <TabsContent value="media">
          <PageTransition>
            <EventMediaPanel :event="event" />
          </PageTransition>
        </TabsContent>

        <TabsContent v-if="event?.is_organizer" value="settings">
          <PageTransition>
            <div class="space-y-6 pb-24">
              <section
                class="rounded-lg border border-border bg-card/40 p-5 [backdrop-filter:blur(6px)]"
              >
                <div :class="[tacticalSectionLabelClasses]">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("event.banner.section") }}
                </div>
                <EventBannerUpload :event="event" />
              </section>

              <EventForm :event="event" />

              <EventMembershipPanel :event="event" />
            </div>
          </PageTransition>
        </TabsContent>
      </div>
    </Tabs>
  </div>
</template>

<script lang="ts">
import gql from "graphql-tag";
import { validate as validateUUIDOptions } from "uuid";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { simpleEventFields } from "~/graphql/simpleEventFields";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";

const eventSubscription = typedGql("subscription")({
  events_by_pk: [
    { id: $("eventId", "uuid!") },
    {
      ...simpleEventFields,
      tournaments: [
        {},
        {
          tournament_id: true,
          tournament: {
            id: true,
            name: true,
            status: true,
            start: true,
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

export default {
  data() {
    return {
      event: undefined as any,
      loading: true,
      leaderboardRows: [] as any[],
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
    // Attaching/detaching tournaments, teams or players must recompute the
    // derived surfaces retroactively: matches, leaderboard rows, and (via the
    // refresh-key props) the leaderboard/standings tabs.
    membershipKey(this: any, _newKey: string, oldKey: string | undefined) {
      if (oldKey === undefined) {
        return;
      }
      this.$apollo?.queries?.leaderboardRows?.refetch();
      this.refetchEventMatches?.();
    },
  },
  computed: {
    bannerSrc(): string {
      return this.event?.banner
        ? eventMediaUrl(this.event.id, this.event.banner.filename)
        : "";
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
};
</script>
