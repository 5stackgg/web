<script setup lang="ts">
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import TournamentTeamMemberRow from "~/components/tournament/TournamentTeamMemberRow.vue";
</script>

<template>
  <Table v-if="team">
    <TableHeader>
      <TableRow>
        <TableHead>Roster</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TournamentTeamMemberRow :member="member" v-for="member of team.roster" :key="member.id"></TournamentTeamMemberRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
export default {
  props: {
    team: {
      type: Object,
      required: true,
    },
  },
};
</script>
