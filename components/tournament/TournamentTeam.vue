<script setup lang="ts">
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import TournamentTeamMemberRow from "~/components/tournament/TournamentTeamMemberRow.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlayerDisplay from "../PlayerDisplay.vue";
</script>

<!-- // TODO - tournament max players per lineup -->
<template>
  <div v-if="team && e_team_roles" class="grid gap-4">
    <div
      class="flex flex-col md:flex-row justify-between items-center mb-4 p-4 shadow rounded-lg"
    >
      <div>
        <h2 class="text-2xl font-bold mb-2">
          Manage Team Roster
          <small>
            ({{ team.roster.length }} / {{ tournament.max_players_per_lineup }})
          </small>
        </h2>
        <template v-if="team.eligible_at">
          <Badge> Eligible </Badge>
        </template>
        <template v-else>
          <div class="text-sm text-red-600">
            Not eligible, requires
            {{ tournament.min_players_per_lineup - team.roster.length }} more
            member(s).
          </div>
        </template>
      </div>
      <Button
        @click="leaveTournament"
        variant="destructive"
        class="mt-4 md:mt-0"
      >
        Leave Tournament
      </Button>
    </div>

    <div v-if="team.roster">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TournamentTeamMemberRow
            v-for="member in team.roster"
            :key="member.id"
            :member="member"
            :roles="e_team_roles"
          />
          <TableRow
            v-for="slot of Math.max(
              0,
              tournament.max_players_per_lineup - team.roster.length,
            )"
          >
            <TableCell colspan="100%">
              <div class="flex space-x-3">
                <PlayerDisplay
                  :show-flag="false"
                  :show-steam-id="false"
                  :player="{
                    name: `Slot ${slot + team.roster.length}`,
                  }"
                />
                <template v-if="slot === 1">
                  <player-search
                    label="Add Player to Team..."
                    :exclude="
                      team.roster?.map((member) => member.player.steam_id) || []
                    "
                    :team-id="team.team_id"
                    @selected="addMember"
                  />
                </template>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script lang="ts">
import { e_team_roles_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import Badge from "../ui/badge/Badge.vue";

export default {
  props: {
    team: {
      type: Object,
      required: true,
    },
    tournament: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    e_team_roles: {
      query: typedGql("query")({
        e_team_roles: [
          {
            where: {
              value: {
                _nin: [e_team_roles_enum.Invite, e_team_roles_enum.Pending],
              },
            },
          },
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  methods: {
    async leaveTournament() {
      console.info("leave tournament");
    },
    async addMember(member) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_team_roster_one: [
            {
              object: {
                player_steam_id: member.steam_id,
                tournament_team_id: this.team.id,
                tournament_id:
                  this.$route.params.tournamentId || this.$route.params.id,
              },
            },
            {
              player_steam_id: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
