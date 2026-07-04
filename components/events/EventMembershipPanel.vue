<script setup lang="ts">
import { X, Download, Trophy, Users } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// `event` is declared as a prop on the Options-API default export below
// (needed for the $apollo mutate/query calls in `methods`); Vue merges that
// export's options with this script-setup block automatically, so it does
// not need to be redeclared here via `defineProps`.

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

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Tournaments -->
      <div class="min-w-0 space-y-3">
        <h4 class="text-sm font-semibold text-foreground">
          {{ $t("event.membership.tournaments.title") }}
        </h4>

        <ul v-if="event?.tournaments?.length" class="space-y-1.5">
          <li
            v-for="entry in event.tournaments"
            :key="entry.tournament_id"
            class="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-sm"
          >
            <span class="min-w-0 flex-1 truncate">{{ entry.tournament?.name }}</span>
            <span
              v-if="formatEventDate(entry.tournament?.start)"
              class="shrink-0 text-xs text-muted-foreground"
            >
              {{ formatEventDate(entry.tournament?.start) }}
            </span>
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
          </li>
        </ul>
        <p v-else class="text-xs text-muted-foreground">
          {{ $t("event.membership.tournaments.none") }}
        </p>

        <div class="space-y-2">
          <Input
            v-model="tournamentQuery"
            :placeholder="$t('event.membership.tournaments.search_placeholder')"
            @input="debouncedSearchTournaments(tournamentQuery)"
          />
          <ul
            v-if="tournamentResults.length"
            class="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/60"
          >
            <li
              v-for="tournament in tournamentResults"
              :key="tournament.id"
              class="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-accent"
              @click="attachTournament(tournament)"
            >
              <Trophy class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1 truncate">{{ tournament.name }}</span>
              <Badge variant="outline" class="shrink-0">{{ tournament.status }}</Badge>
            </li>
          </ul>
        </div>
      </div>

      <!-- Teams -->
      <div class="min-w-0 space-y-3">
        <h4 class="text-sm font-semibold text-foreground">
          {{ $t("event.membership.teams.title") }}
        </h4>

        <ul v-if="event?.teams?.length" class="space-y-1.5">
          <li
            v-for="entry in event.teams"
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
          </li>
        </ul>
        <p v-else class="text-xs text-muted-foreground">
          {{ $t("event.membership.teams.none") }}
        </p>

        <TeamSearch
          :label="$t('event.membership.teams.search_placeholder')"
          :exclude="attachedTeamIds"
          @selected="attachTeam"
        />
      </div>

      <!-- Players -->
      <div class="min-w-0 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-sm font-semibold text-foreground">
            {{ $t("event.membership.players.title") }}
          </h4>
          <Button
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 text-xs"
            :disabled="importingPlayers"
            @click="importPlayersFromTournaments"
          >
            <Download class="h-3.5 w-3.5" />
            {{ $t("event.membership.players.import") }}
          </Button>
        </div>

        <ul v-if="event?.players?.length" class="space-y-1.5">
          <li
            v-for="entry in event.players"
            :key="entry.steam_id"
            class="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <PlayerDisplay
                :player="entry.player"
                size="xs"
                compact
                :show-flag="false"
                :show-role="false"
                :show-elo="false"
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
          </li>
        </ul>
        <p v-else class="text-xs text-muted-foreground">
          {{ $t("event.membership.players.none") }}
        </p>

        <PlayerSearch
          :label="$t('event.membership.players.search_placeholder')"
          :exclude="attachedPlayerSteamIds"
          @selected="attachPlayer"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import debounce from "~/utilities/debounce";
import { toast } from "@/components/ui/toast";

const searchTournamentsQuery = typedGql("query")({
  tournaments: [
    {
      limit: 20,
      order_by: [{ start: order_by.desc_nulls_last }],
      where: $("where", "tournaments_bool_exp!"),
    },
    { id: true, name: true, status: true, start: true },
  ],
});

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
    { event_id: $("eventId", "uuid!"), tournament_id: $("tournamentId", "uuid!") },
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
      tournamentQuery: "",
      tournamentResults: [] as any[],
      detachingTournamentId: null as string | null,
      detachingTeamId: null as string | null,
      detachingSteamId: null as string | null,
      importingPlayers: false,
      debouncedSearchTournaments: debounce((query: string) => {
        this.searchTournaments(query);
      }, 300),
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
  },
  methods: {
    async searchTournaments(query: string) {
      const me = useAuthStore().me;
      if (!me) {
        this.tournamentResults = [];
        return;
      }

      // No ownership filter: the event_tournaments insert permission allows
      // an event organizer to attach any tournament, and scoping the search
      // to tournaments the viewer personally organizes locked out
      // co-organizers and privileged roles managing someone else's event.
      const filters: any[] = [];
      if (this.attachedTournamentIds.length > 0) {
        filters.push({ id: { _nin: this.attachedTournamentIds } });
      }
      if (query) {
        filters.push({ name: { _ilike: `%${query}%` } });
      }

      const { data } = await (this as any).$apollo.query({
        query: searchTournamentsQuery,
        fetchPolicy: "network-only",
        variables: { where: { _and: filters } },
      });

      this.tournamentResults = data?.tournaments || [];
    },
    async attachTournament(tournament: any) {
      try {
        await (this as any).$apollo.mutate({
          mutation: attachTournamentMutation,
          variables: { eventId: this.event.id, tournamentId: tournament.id },
        });
        this.tournamentQuery = "";
        this.tournamentResults = [];
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
          toast({ title: this.$t("event.membership.players.import_none") as string });
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
