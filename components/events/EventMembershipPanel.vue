<script setup lang="ts">
import { X, Download, Trophy, Users, Eye, EyeOff } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import TournamentSearch from "~/components/events/TournamentSearch.vue";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

// `event` is a prop on the Options-API default export below; the tab state
// (section / filters) and all mutations live there too, so everything shares
// one reactive context. Only helpers with no `this` dependency stay here.

function formatEventDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
</script>

<template>
  <div class="rounded-md border border-border/70 bg-card/30 p-4 sm:p-5">
    <div :class="[tacticalSectionLabelClasses, 'mb-4']">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("event.membership.title") }}
    </div>

    <!-- sub-tabs: one category at a time keeps hundreds of rows out of the DOM -->
    <Tabs v-model="section">
      <TabsList
        variant="underline"
        :class="[tacticalTabsListClasses, 'mb-4 flex h-auto w-fit flex-wrap']"
      >
        <TabsTrigger
          v-for="t in [
            {
              key: 'players',
              label: $t('event.membership.players.title'),
              count: event?.players?.length ?? 0,
            },
            {
              key: 'teams',
              label: $t('event.membership.teams.title'),
              count: event?.teams?.length ?? 0,
            },
            {
              key: 'organizers',
              label: $t('event.membership.organizers.title'),
              count: (event?.organizers?.length ?? 0) + 1,
            },
            {
              key: 'tournaments',
              label: $t('event.membership.tournaments.title'),
              count: event?.tournaments?.length ?? 0,
            },
          ]"
          :key="t.key"
          :value="t.key"
          :class="tacticalTabsTriggerClasses"
        >
          {{ t.label }}
          <span class="ml-1.5 font-mono tabular-nums opacity-70">{{
            t.count
          }}</span>
        </TabsTrigger>
      </TabsList>

      <!-- PLAYERS -->
      <TabsContent value="players" class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="min-w-[220px] flex-1">
            <PlayerSearch
              :label="$t('event.membership.players.search_placeholder')"
              :exclude="attachedPlayerSteamIds"
              @selected="attachPlayer"
            />
          </div>
          <Input
            v-if="(event?.players?.length ?? 0) > 8"
            v-model="playerFilter"
            class="h-9 w-full sm:w-56"
            :placeholder="$t('event.membership.filter_players')"
          />
        </div>

        <p v-if="!event?.players?.length" class="text-xs text-muted-foreground">
          {{ $t("event.membership.players.none") }}
        </p>
        <div
          v-else
          class="grid max-h-[440px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="entry in (event.players || []).filter((e) =>
              includesQuery(e.player?.name, playerFilter),
            )"
            :key="entry.steam_id"
            class="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <PlayerDisplay
                :player="entry.player"
                size="xs"
                compact
                :show-flag="true"
                :show-role="false"
                :show-elo="false"
                :show-online="false"
                :tooltip="false"
                linkable
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 shrink-0"
              :disabled="detachingSteamId === entry.steam_id"
              :title="$t('event.membership.detach')"
              @click="detachPlayer(entry.steam_id)"
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </TabsContent>

      <!-- TEAMS -->
      <TabsContent value="teams" class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="min-w-[220px] flex-1">
            <TeamSearch
              :label="$t('event.membership.teams.search_placeholder')"
              :exclude="attachedTeamIds"
              @selected="attachTeam"
            />
          </div>
          <Input
            v-if="(event?.teams?.length ?? 0) > 8"
            v-model="teamFilter"
            class="h-9 w-full sm:w-56"
            :placeholder="$t('event.membership.filter_teams')"
          />
        </div>

        <p v-if="!event?.teams?.length" class="text-xs text-muted-foreground">
          {{ $t("event.membership.teams.none") }}
        </p>
        <div
          v-else
          class="grid max-h-[440px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="entry in (event.teams || []).filter((e) =>
              includesQuery(e.team?.name, teamFilter),
            )"
            :key="entry.team_id"
            class="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-sm"
          >
            <Users class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate">{{ entry.team?.name }}</span>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 shrink-0"
              :disabled="detachingTeamId === entry.team_id"
              :title="$t('event.membership.detach')"
              @click="detachTeam(entry.team_id)"
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </TabsContent>

      <!-- ORGANIZERS -->
      <TabsContent value="organizers" class="space-y-3">
        <div class="max-w-md">
          <PlayerSearch
            :label="$t('event.membership.organizers.search_placeholder')"
            :exclude="attachedOrganizerSteamIds"
            @selected="attachOrganizer"
          />
        </div>

        <div class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          <div
            class="flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.05)] px-2.5 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <PlayerDisplay
                v-if="event?.organizer"
                :player="event.organizer"
                size="xs"
                compact
                :show-flag="false"
                :show-role="false"
                :show-elo="false"
                :show-online="false"
                :tooltip="false"
                linkable
              />
            </div>
            <span
              class="shrink-0 font-mono text-[0.54rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
            >
              {{ $t("event.membership.organizers.creator") }}
            </span>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 shrink-0"
              :disabled="togglingCreator"
              :title="
                event?.hide_creator_organizer
                  ? $t('event.membership.organizers.show_on_event')
                  : $t('event.membership.organizers.hide_on_event')
              "
              @click="toggleCreatorVisible"
            >
              <EyeOff
                v-if="event?.hide_creator_organizer"
                class="h-3.5 w-3.5 text-muted-foreground"
              />
              <Eye v-else class="h-3.5 w-3.5" />
            </Button>
          </div>
          <div
            v-for="entry in event?.organizers || []"
            :key="entry.steam_id"
            class="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <PlayerDisplay
                :player="{ steam_id: entry.steam_id, ...entry.organizer }"
                size="xs"
                compact
                :show-flag="false"
                :show-role="false"
                :show-elo="false"
                :show-online="false"
                :tooltip="false"
                linkable
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 shrink-0"
              :disabled="detachingOrganizerSteamId === entry.steam_id"
              :title="$t('event.membership.detach')"
              @click="detachOrganizer(entry.steam_id)"
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </TabsContent>

      <!-- TOURNAMENTS -->
      <TabsContent value="tournaments" class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="min-w-[220px] flex-1">
            <TournamentSearch
              :label="$t('event.membership.tournaments.search_placeholder')"
              :exclude="attachedTournamentIds"
              @selected="attachTournament"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            class="h-9 gap-1.5 text-xs"
            :disabled="importingPlayers || !event?.tournaments?.length"
            :title="$t('event.membership.players.import_hint')"
            @click="importPlayersFromTournaments"
          >
            <Download class="h-3.5 w-3.5" />
            {{ $t("event.membership.players.import") }}
          </Button>
        </div>

        <p
          v-if="!event?.tournaments?.length"
          class="text-xs text-muted-foreground"
        >
          {{ $t("event.membership.tournaments.none") }}
        </p>
        <div v-else class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="entry in event.tournaments"
            :key="entry.tournament_id"
            class="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-sm"
          >
            <Trophy class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate">{{
              entry.tournament?.name
            }}</span>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 shrink-0"
              :disabled="detachingTournamentId === entry.tournament_id"
              :title="$t('event.membership.detach')"
              @click="detachTournament(entry.tournament_id)"
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

const importRosterQuery = typedGql("query")({
  events_by_pk: [
    { id: $("eventId", "uuid!") },
    {
      tournaments: [
        {},
        {
          tournament: {
            teams: [{}, { roster: [{}, { player_steam_id: true }] }],
          },
        },
      ],
    },
  ],
});

const setHideCreatorMutation = generateMutation({
  update_events_by_pk: [
    {
      pk_columns: { id: $("eventId", "uuid!") },
      _set: { hide_creator_organizer: $("hide", "Boolean!") },
    },
    { id: true },
  ],
});

const attachOrganizerMutation = generateMutation({
  insert_event_organizers_one: [
    {
      object: {
        event_id: $("eventId", "uuid!"),
        steam_id: $("steamId", "bigint!"),
      },
    },
    { event_id: true, steam_id: true },
  ],
});

const detachOrganizerMutation = generateMutation({
  delete_event_organizers_by_pk: [
    { event_id: $("eventId", "uuid!"), steam_id: $("steamId", "bigint!") },
    { event_id: true },
  ],
});

const attachTournamentMutation = generateMutation({
  insert_event_tournaments_one: [
    {
      object: {
        event_id: $("eventId", "uuid!"),
        tournament_id: $("tournamentId", "uuid!"),
      },
    },
    { event_id: true, tournament_id: true },
  ],
});

const detachTournamentMutation = generateMutation({
  delete_event_tournaments_by_pk: [
    {
      event_id: $("eventId", "uuid!"),
      tournament_id: $("tournamentId", "uuid!"),
    },
    { event_id: true },
  ],
});

const attachTeamMutation = generateMutation({
  insert_event_teams_one: [
    {
      object: {
        event_id: $("eventId", "uuid!"),
        team_id: $("teamId", "uuid!"),
      },
    },
    { event_id: true, team_id: true },
  ],
});

const detachTeamMutation = generateMutation({
  delete_event_teams_by_pk: [
    { event_id: $("eventId", "uuid!"), team_id: $("teamId", "uuid!") },
    { event_id: true },
  ],
});

const attachPlayerMutation = generateMutation({
  insert_event_players_one: [
    {
      object: {
        event_id: $("eventId", "uuid!"),
        steam_id: $("steamId", "bigint!"),
      },
    },
    { event_id: true, steam_id: true },
  ],
});

const detachPlayerMutation = generateMutation({
  delete_event_players_by_pk: [
    { event_id: $("eventId", "uuid!"), steam_id: $("steamId", "bigint!") },
    { event_id: true },
  ],
});

// No on_conflict here: Hasura only exposes that argument to roles with an
// update permission on the table, and event_players has none, so including it
// fails GraphQL validation for every non-admin caller. Duplicates are
// pre-filtered against the already-attached players before the insert.
const importPlayersMutation = generateMutation({
  insert_event_players: [
    {
      objects: $("objects", "[event_players_insert_input!]!"),
    },
    { affected_rows: true },
  ],
});

export default {
  props: {
    event: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      section: "players" as "players" | "teams" | "organizers" | "tournaments",
      teamFilter: "",
      playerFilter: "",
      detachingTournamentId: null as string | null,
      detachingOrganizerSteamId: null as string | null,
      togglingCreator: false,
      detachingTeamId: null as string | null,
      detachingSteamId: null as string | null,
      importingPlayers: false,
    };
  },
  computed: {
    attachedTournamentIds(): string[] {
      return (this.event?.tournaments || []).map(
        (entry: any) => entry.tournament_id,
      );
    },
    attachedTeamIds(): string[] {
      return (this.event?.teams || []).map((entry: any) => entry.team_id);
    },
    attachedPlayerSteamIds(): string[] {
      return (this.event?.players || []).map((entry: any) => entry.steam_id);
    },
    attachedOrganizerSteamIds(): string[] {
      return [
        this.event?.organizer_steam_id,
        ...(this.event?.organizers || []).map((entry: any) => entry.steam_id),
      ].filter(Boolean);
    },
  },
  methods: {
    includesQuery(name: string | null | undefined, q: string): boolean {
      return !q || (name || "").toLowerCase().includes(q.toLowerCase());
    },
    async toggleCreatorVisible() {
      this.togglingCreator = true;
      try {
        await (this as any).$apollo.mutate({
          mutation: setHideCreatorMutation,
          variables: {
            eventId: this.event.id,
            hide: !this.event.hide_creator_organizer,
          },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.togglingCreator = false;
      }
    },
    async attachOrganizer(player: any) {
      try {
        await (this as any).$apollo.mutate({
          mutation: attachOrganizerMutation,
          variables: { eventId: this.event.id, steamId: player.steam_id },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    async detachOrganizer(steamId: string) {
      this.detachingOrganizerSteamId = steamId;
      try {
        await (this as any).$apollo.mutate({
          mutation: detachOrganizerMutation,
          variables: { eventId: this.event.id, steamId },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.detachingOrganizerSteamId = null;
      }
    },
    async attachTournament(tournament: any) {
      try {
        await (this as any).$apollo.mutate({
          mutation: attachTournamentMutation,
          variables: { eventId: this.event.id, tournamentId: tournament.id },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    async detachTournament(tournamentId: string) {
      this.detachingTournamentId = tournamentId;
      try {
        await (this as any).$apollo.mutate({
          mutation: detachTournamentMutation,
          variables: { eventId: this.event.id, tournamentId },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.detachingTournamentId = null;
      }
    },
    async attachTeam(team: any) {
      try {
        await (this as any).$apollo.mutate({
          mutation: attachTeamMutation,
          variables: { eventId: this.event.id, teamId: team.id },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    async detachTeam(teamId: string) {
      this.detachingTeamId = teamId;
      try {
        await (this as any).$apollo.mutate({
          mutation: detachTeamMutation,
          variables: { eventId: this.event.id, teamId },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.detachingTeamId = null;
      }
    },
    async attachPlayer(player: any) {
      try {
        await (this as any).$apollo.mutate({
          mutation: attachPlayerMutation,
          variables: { eventId: this.event.id, steamId: player.steam_id },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    async detachPlayer(steamId: string) {
      this.detachingSteamId = steamId;
      try {
        await (this as any).$apollo.mutate({
          mutation: detachPlayerMutation,
          variables: { eventId: this.event.id, steamId },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.detachingSteamId = null;
      }
    },
    async importPlayersFromTournaments() {
      if (this.importingPlayers) {
        return;
      }
      this.importingPlayers = true;

      try {
        const { data } = await (this as any).$apollo.query({
          query: importRosterQuery,
          fetchPolicy: "network-only",
          variables: { eventId: this.event.id },
        });

        const tournamentEntries = data?.events_by_pk?.tournaments || [];
        const attached = new Set(
          this.attachedPlayerSteamIds.map((id: string) => String(id)),
        );
        const seen = new Set<string>();
        const objects: Array<{ event_id: string; steam_id: string }> = [];

        for (const entry of tournamentEntries) {
          for (const team of entry.tournament?.teams || []) {
            for (const rosterEntry of team.roster || []) {
              const steamId = String(rosterEntry.player_steam_id);
              if (attached.has(steamId) || seen.has(steamId)) {
                continue;
              }
              seen.add(steamId);
              objects.push({ event_id: this.event.id, steam_id: steamId });
            }
          }
        }

        if (objects.length === 0) {
          toast({
            title: this.$t("event.membership.players.import_none") as string,
          });
          return;
        }

        await (this as any).$apollo.mutate({
          mutation: importPlayersMutation,
          variables: { objects },
        });

        toast({
          title: this.$t("event.membership.players.import_success", {
            count: objects.length,
          }) as string,
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.importingPlayers = false;
      }
    },
  },
};
</script>
