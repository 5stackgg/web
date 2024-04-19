<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="hidden sm:table-cell">
          {{ lineup.name }}
        </TableHead>
        <TableHead class="hidden sm:table-cell">
          Kills
        </TableHead>
        <TableHead class="hidden md:table-cell">
          Assists
        </TableHead>
        <TableHead >
          Deaths
        </TableHead>
        <TableHead >
          K/D
        </TableHead>
        <TableHead >
          HS%
        </TableHead>
        <TableHead >
          Total Damage
        </TableHead>
        <TableHead >
          Team Damage
        </TableHead>
        <TableHead >
          2k
        </TableHead>
        <TableHead >
          3k
        </TableHead>
        <TableHead >
          4k
        </TableHead>
        <TableHead >
          5k
        </TableHead>
        <TableHead >
          knifes
        </TableHead>
        <TableHead >
          zeus
        </TableHead>
        <TableHead >

        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <lineup-overview-row
          :match="match"
          :member="member"
          v-for="member of lineup.lineup_players"
          :lineup_id="lineup.id"
      ></lineup-overview-row>
    </TableBody>
  </Table>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import LineupOverviewRow from "~/components/match/LineupOverviewRow.vue";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "~/components/ui/table";
import {Badge} from "~/components/ui/badge";

export default {
  components: {Table, TableBody, TableHead, TableHeader, TableRow, Badge, TableCell, LineupOverviewRow, LineupMember },
  props: {
    match: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
  },
};
</script>
