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
      <template v-if="teams.length === 0">
        <TableRow>
          <TableCell colspan="4" class="text-center py-8">
            <div class="text-gray-500 dark:text-gray-400">
              <p>
                <slot name="none-found">No Teams Found</slot>
              </p>
            </div>
          </TableCell>
        </TableRow>
      </template>
      <template v-else>
        <TableRow
          @click="viewTeam(team.id)"
          v-for="team in teams"
          :key="team.id"
          class="cursor-pointer"
        >
          <TableCell class="font-medium">
            {{ team.name }}
          </TableCell>
          <TableCell>{{ team.wins }}</TableCell>
          <TableCell>{{ team.losses }}</TableCell>
          <TableCell>{{ team.overtimeLosses }}</TableCell>
        </TableRow>
      </template>
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
