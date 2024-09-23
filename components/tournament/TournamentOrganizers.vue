<script setup lang="ts">
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TournamentOrganizerRow from "~/components/tournament/TournamentOrganizerRow.vue";
</script>

<template>
  <div v-if="tournament" class="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Tournament Organizers</CardTitle>
        <CardDescription
          >Manage the organizers for this tournament</CardDescription
        >
      </CardHeader>
      <CardContent class="grid gap-4">
        <PlayerSearch
          label="Add Player as Organizer..."
          :exclude="excludeOrganizers"
          @selected="addOrganizer"
        ></PlayerSearch>

        <Table v-if="tournament.organizers && tournament.organizers.length > 0">
          <TableHeader>
            <TableRow>
              <TableHead>Organizer</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TournamentOrganizerRow
              :organizer="organizer"
              v-for="{ organizer } of tournament.organizers"
              :key="organizer.steam_id"
            ></TournamentOrganizerRow>
          </TableBody>
        </Table>

        <Alert v-else>
          <AlertTitle>No Organizers</AlertTitle>
          <AlertDescription>
            There are currently no organizers for this tournament. Use the
            search above to add organizers.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
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
  computed: {
    excludeOrganizers() {
      const organizers = this.tournament.organizers?.map(
        ({ organizer }) => organizer.steam_id,
      );

      organizers.push(this.tournament.admin.steam_id);

      return organizers;
    },
  },
};
</script>
