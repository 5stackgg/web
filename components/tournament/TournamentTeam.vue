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

<template>
  <div v-if="team && e_team_roles">
    <player-search
      label="Add Player to Roster ..."
      :exclude="team.roster?.map((member) => member.player.steam_id) || []"
      :team-id="team.team_id"
      @selected="addMember"
    ></player-search>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Roster</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TournamentTeamMemberRow
          :member="member"
          :roles="e_team_roles"
          v-for="member of team.roster"
          :key="member.id"
        ></TournamentTeamMemberRow>
      </TableBody>
    </Table>
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
    async addMember(member) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_team_roster_one: [
            {
              object: {
                player_steam_id: member.steam_id,
                tournament_team_id: this.$route.params.teamId,
                tournament_id: this.$route.params.tournamentId || this.$route.params.id,
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
