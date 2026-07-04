<script setup lang="ts">
import { Users } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import EventLeaderboard from "~/components/events/EventLeaderboard.vue";
import EventStandings from "~/components/events/EventStandings.vue";
import EventMembershipPanel from "~/components/events/EventMembershipPanel.vue";
import EventForm from "~/components/events/EventForm.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  formatEventDate,
  statusBadgeVariant,
  statusLabelKey,
} from "~/utilities/eventDisplay";

const activeTab = useRouteTab({
  defaultTab: "leaderboard",
  tabs: ["leaderboard", "standings", "tournaments", "teams", "settings"],
});

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
        <TacticalPageHeader stack-actions>
          <template #description>
            <div class="flex flex-wrap items-center gap-2 normal-case">
              <Badge :variant="statusBadgeVariant(event.status)">
                {{ $t(statusLabelKey(event.status)) }}
              </Badge>
              <span
                v-if="formatEventDate(event.starts_at) || formatEventDate(event.ends_at)"
                class="text-xs text-muted-foreground"
              >
                {{ formatEventDate(event.starts_at) || $t("pages.events.date_tbd") }}
                <template v-if="formatEventDate(event.ends_at)">
                  &nbsp;-&nbsp;{{ formatEventDate(event.ends_at) }}
                </template>
              </span>
              <div
                v-if="event.organizer"
                class="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span>{{ $t("event.card.organized_by") }}</span>
                <PlayerDisplay
                  :player="event.organizer"
                  size="xs"
                  compact
                  :show-flag="false"
                  :show-role="false"
                  :show-elo="false"
                  :tooltip="false"
                  linkable
                />
              </div>
            </div>
          </template>
          <template #title>{{ event.name }}</template>
          <template v-if="event.description" #subtitle>{{ event.description }}</template>
          <template #actions="{ tabs }">
            <TabsList variant="underline" :class="[tabs.listClass, 'h-auto flex-wrap']">
              <TabsTrigger value="leaderboard" :class="tabs.triggerClass">
                {{ $t("event.tabs.leaderboard") }}
              </TabsTrigger>
              <TabsTrigger value="standings" :class="tabs.triggerClass">
                {{ $t("event.tabs.standings") }}
              </TabsTrigger>
              <TabsTrigger value="tournaments" :class="tabs.triggerClass">
                {{ $t("event.tabs.tournaments") }}
                ({{ eventTournamentEntries.length }})
              </TabsTrigger>
              <TabsTrigger value="teams" :class="tabs.triggerClass">
                {{ $t("event.tabs.teams") }}
                ({{ eventTeams.length }})
              </TabsTrigger>
              <TabsTrigger
                v-if="event?.is_organizer"
                value="settings"
                :class="tabs.triggerClass"
              >
                {{ $t("event.tabs.settings") }}
              </TabsTrigger>
            </TabsList>
          </template>
        </TacticalPageHeader>
      </PageTransition>

      <div class="mt-6">
        <TabsContent value="leaderboard">
          <PageTransition>
            <EventLeaderboard :event-id="event.id" />
          </PageTransition>
        </TabsContent>

        <TabsContent value="standings">
          <PageTransition>
            <EventStandings :event-id="event.id" />
          </PageTransition>
        </TabsContent>

        <TabsContent value="tournaments">
          <PageTransition>
            <div :class="[tacticalSectionLabelClasses]">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("event.tabs.tournaments") }}
            </div>

            <Empty v-if="eventTournamentEntries.length === 0" class="min-h-[160px]">
              <p class="text-muted-foreground">
                {{ $t("event.tournaments.none") }}
              </p>
            </Empty>

            <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NuxtLink
                v-for="entry in eventTournamentEntries"
                :key="entry.tournament_id"
                :to="{ name: 'tournaments-tournamentId', params: { tournamentId: entry.tournament.id } }"
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
                <h3 class="mt-2 truncate font-sans text-base font-bold text-foreground">
                  {{ entry.tournament.name }}
                </h3>
              </NuxtLink>
            </div>
          </PageTransition>
        </TabsContent>

        <TabsContent value="teams">
          <PageTransition>
            <div class="grid gap-6 lg:grid-cols-2">
              <div class="min-w-0">
                <div :class="[tacticalSectionLabelClasses]">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("event.teams.title") }}
                </div>

                <Empty v-if="eventTeams.length === 0" class="min-h-[120px]">
                  <p class="text-muted-foreground">{{ $t("event.teams.none") }}</p>
                </Empty>

                <div v-else class="space-y-2">
                  <component
                    :is="team.id ? 'NuxtLink' : 'div'"
                    v-for="team in eventTeams"
                    :key="team.id || team.name"
                    :to="team.id ? { name: 'teams-id', params: { id: team.id } } : undefined"
                    class="flex items-center gap-2 rounded-md border border-border/70 bg-card/40 px-3 py-2 text-sm transition-colors duration-150"
                    :class="{ 'hover:border-[hsl(var(--tac-amber)/0.4)] hover:bg-card/60': team.id }"
                  >
                    <Users class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span class="truncate">{{ team.name }}</span>
                  </component>
                </div>
              </div>

              <div class="min-w-0">
                <div :class="[tacticalSectionLabelClasses]">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("event.players.title") }}
                </div>

                <Empty v-if="eventPlayers.length === 0" class="min-h-[120px]">
                  <p class="text-muted-foreground">{{ $t("event.players.none") }}</p>
                </Empty>

                <div v-else class="space-y-2">
                  <div
                    v-for="player in eventPlayers"
                    :key="player.steam_id"
                    class="rounded-md border border-border/70 bg-card/40 px-3 py-2"
                  >
                    <PlayerDisplay
                      :player="player"
                      size="xs"
                      compact
                      :show-flag="false"
                      :show-role="false"
                      :show-elo="false"
                      :tooltip="false"
                      linkable
                    />
                  </div>
                </div>
              </div>
            </div>
          </PageTransition>
        </TabsContent>

        <TabsContent v-if="event?.is_organizer" value="settings">
          <PageTransition>
            <EventForm :event="event" />
          </PageTransition>
        </TabsContent>
      </div>
    </Tabs>

    <PageTransition v-if="event?.is_organizer" :delay="150" class="mt-8">
      <EventMembershipPanel :event="event" />
    </PageTransition>
  </div>
</template>

<script lang="ts">
import gql from "graphql-tag";
import { validate as validateUUID } from "uuid";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleEventFields } from "~/graphql/simpleEventFields";

const eventSubscription = typedGql("subscription")({
  events_by_pk: [
    { id: $("eventId", "uuid!") },
    {
      ...simpleEventFields,
      organizers: [
        {},
        { steam_id: true, organizer: { name: true, avatar_url: true } },
      ],
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
                team: { id: true, name: true },
              },
            ],
          },
        },
      ],
      teams: [{}, { team_id: true, team: { id: true, name: true } }],
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

// Players-tab fallback when the event has no directly-attached players:
// reuse the same leaderboard function the Leaderboard tab calls, with
// `_min_rounds: 0` so every participant of the member tournaments shows up
// regardless of how many rounds they've played.
const EVENT_LEADERBOARD_PARTICIPANTS = gql`
  query EventLeaderboardParticipants($eventId: uuid!) {
    get_event_leaderboard(
      args: {
        _event_id: $eventId
        _category: "rating"
        _match_type: null
        _min_rounds: 0
      }
    ) {
      player_steam_id
      player_name
      player_avatar_url
      player_country
    }
  }
`;

export default {
  data() {
    return {
      event: undefined as any,
      loading: true,
      leaderboardParticipants: [] as any[],
    };
  },
  unmounted() {
    useEventContext().value = null;
  },
  apollo: {
    leaderboardParticipants: {
      query: EVENT_LEADERBOARD_PARTICIPANTS,
      variables(this: any) {
        return { eventId: this.$route.params.eventId };
      },
      skip(this: any) {
        // Wait for the event to load, then only fetch the leaderboard
        // fallback when there are no directly-attached players. At mount
        // this.event is undefined, so the old check ran the query even for
        // events with attached players and then discarded the result.
        return !this.event || (this.event.players?.length ?? 0) > 0;
      },
      update(data: any) {
        return (data?.get_event_leaderboard || []).map((row: any) => ({
          steam_id: row.player_steam_id,
          name: row.player_name,
          avatar_url: row.player_avatar_url,
          country: row.player_country,
        }));
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
          if (typeof eventId !== "string" || !validateUUID(eventId)) {
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
  computed: {
    eventTournamentEntries(): any[] {
      // A member tournament the viewer cannot read resolves its nested
      // `tournament` to null; drop those so the template can dereference
      // entry.tournament safely and the tab count stays accurate.
      return (this.event?.tournaments || []).filter(
        (entry: any) => !!entry.tournament,
      );
    },
    eventTeams(): Array<{ id: string | null; name: string }> {
      if (!this.event) return [];

      const direct = (this.event.teams || [])
        .filter((et: any) => et.team)
        .map((et: any) => ({ id: et.team.id, name: et.team.name }));
      if (direct.length > 0) {
        return direct;
      }

      // Fallback: union of teams rostered in the event's member tournaments.
      const seen = new Set<string>();
      const fallback: Array<{ id: string | null; name: string }> = [];
      for (const entry of this.event.tournaments || []) {
        for (const tt of entry.tournament?.teams || []) {
          const key = tt.team?.id || tt.id;
          if (seen.has(key)) continue;
          seen.add(key);
          fallback.push({
            id: tt.team?.id ?? null,
            name: tt.team?.name ?? tt.name,
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

      return this.leaderboardParticipants;
    },
  },
};
</script>
