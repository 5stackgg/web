<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Tournament</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Teams</TableHead>
        <TableHead>Starts</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow
        @click="viewTournament(tournament.id)"
        v-for="tournament of tournaments"
        :key="tournament.id"
      >
        <TableCell class="font-medium">
          {{ tournament.name }}
        </TableCell>
        <TableCell>
          <Badge>{{ tournament.status }}</Badge>
        </TableCell>
        <TableCell>
          {{ tournament.type }}
        </TableCell>
        <TableCell>
          {{ tournament.teams_aggregate.aggregate.count }}
        </TableCell>
        <TableCell>
          <TimeAgo :date="tournament.start"></TimeAgo>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
export default {
  props: {
    tournaments: {
      required: true,
      type: Object,
    },
  },
  methods: {
    viewTournament(tournamentId: string) {
      this.$router.push(`/tournaments/${tournamentId}`);
    },
  },
};
</script>
