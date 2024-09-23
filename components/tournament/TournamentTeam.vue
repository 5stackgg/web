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
</script>

<!-- // TODO - tournament max players per lineup -->
<template>
  <div v-if="team && e_team_roles">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold">Manage Team Roster</h2>
      <Button @click="leaveTournament" variant="destructive"
        >Leave Tournament</Button
      >
    </div>
    <div v-if="team.roster && team.roster.length > 0">
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
            @remove="removeMember"
          />
          <!-- loop through till enoughs users  -->
        </TableBody>
      </Table>
    </div>

    <player-search
      label="Search for a player..."
      :exclude="team.roster?.map((member) => member.player.steam_id) || []"
      :team-id="team.team_id"
      @selected="addMember"
    />
  </div>
</template>

<script lang="ts">
import { e_team_roles_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";

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
                tournament_team_id: this.$route.params.teamId,
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
