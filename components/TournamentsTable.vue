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
        <TableHead>{{ $t("tournament.table.tournament") }}</TableHead>
        <TableHead>{{ $t("common.status") }}</TableHead>
        <TableHead>{{ $t("tournament.table.type") }}</TableHead>
        <TableHead>{{ $t("tournament.table.teams_joined") }}</TableHead>
        <TableHead>{{ $t("tournament.table.starts") }}</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <template v-if="tournaments.length === 0">
        <TableRow>
          <TableCell colspan="4" class="text-center py-8">
            <div class="text-gray-500 dark:text-gray-400">
              <p>
                <slot name="none-found">{{
                  $t("tournament.table.no_tournaments_found")
                }}</slot>
              </p>
            </div>
          </TableCell>
        </TableRow>
      </template>
      <template v-else>
        <TableRow
          v-for="tournament of tournaments"
          :key="tournament.id"
          class="cursor-pointer"
        >
          <NuxtLink
            :to="{
              name: 'tournaments-tournamentId',
              params: { tournamentId: tournament.id },
            }"
            class="contents"
          >
            <TableCell class="font-medium">
              {{ tournament.name }}
            </TableCell>
            <TableCell>
              <Badge>{{ tournament.e_tournament_status.description }}</Badge>
            </TableCell>
            <TableCell>
              {{ tournament.options.type }}
            </TableCell>
            <TableCell>
              {{ tournament.teams_aggregate.aggregate.count }}
            </TableCell>
            <TableCell>
              <TimeAgo :date="tournament.start"></TimeAgo>
            </TableCell>
          </NuxtLink>
        </TableRow>
      </template>
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
};
</script>
