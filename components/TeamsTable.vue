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
        <TableHead>Team</TableHead>
        <TableHead>Wins</TableHead>
        <TableHead>Losses</TableHead>
        <TableHead>Overtime Losses</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow @click="viewTeam(team.id)" v-for="team of teams" :key="team.id">
        <TableCell class="font-medium">
          {{ team.name }}
        </TableCell>
        <TableCell>TODO</TableCell>
        <TableCell>TODO</TableCell>
        <TableCell>TODO</TableCell>
        <TableCell>TODO</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
export default {
  props: {
    teams: {
      required: true,
      type: Object,
    },
  },
  methods: {
    viewTeam(teamId) {
      this.$router.push(`/teams/${teamId}`);
    },
  },
};
</script>
