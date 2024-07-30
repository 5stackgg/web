<script setup lang="ts">
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TournamentTeamOrganizerRow from "~/components/tournament/TournamentOrganizerRow.vue";
</script>

<template>
  <div v-if="tournament">
    <player-search
      label="Add Player as Organizer ..."
      :exclude="
        tournament.organizers?.map((organizer) => organizer.steam_id) || []
      "
      @selected="addOrganizer"
    ></player-search>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Roster</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TournamentTeamOrganizerRow
          :organizer="organizer"
          v-for="{ organizer } of tournament.organizers"
          :key="organizer.steam_id"
        ></TournamentTeamOrganizerRow>
      </TableBody>
    </Table>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async addOrganizer(member) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_organizers_one: [
            {
              object: {
                steam_id: member.steam_id,
                tournament_id: this.$route.params.tournamentId,
              },
            },
            {
              steam_id: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
