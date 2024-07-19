<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Tournament</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow
        @click="viewTournament(tournament.id)"
        v-for="tournament of tournaments"
        :key="tournament.id"
      >
        <TableCell class="font-medium">
          {{ tournament.id }}
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
