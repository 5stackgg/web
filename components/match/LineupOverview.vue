<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="hidden sm:table-cell">
          {{ lineup.name }}
        </TableHead>
        <TableHead class="hidden sm:table-cell"> Kills </TableHead>
        <TableHead class="hidden md:table-cell"> Assists </TableHead>
        <TableHead> Deaths </TableHead>
        <TableHead> K/D </TableHead>
        <TableHead> HS% </TableHead>
        <TableHead> Total Damage </TableHead>
        <TableHead> Team Damage </TableHead>
        <TableHead> 2k </TableHead>
        <TableHead> 3k </TableHead>
        <TableHead> 4k </TableHead>
        <TableHead> 5k </TableHead>
        <TableHead> knifes </TableHead>
        <TableHead> zeus </TableHead>
        <TableHead> </TableHead>
      </TableRow>
      <TableRow v-if="assigningLineups || canUpdateCoach">
        <div>
          <AssignPlayerToLineup
            :lineup="lineup"
            :exclude="players"
            v-if="canAddToLineup"
          ></AssignPlayerToLineup>

          <AssignCoachToLineup
            :lineup="lineup"
            :exclude="players.concat(coaches)"
            v-if="canUpdateCoach"
          ></AssignCoachToLineup>
        </div>
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import AssignPlayerToLineup from "~/components/match/AssignPlayerToLineup.vue";
import { e_match_types_enum } from "~/generated/zeus";
import AssignCoachToLineup from "~/components/match/AssignCoachToLineup.vue";

export default {
  components: {
    AssignCoachToLineup,
    AssignPlayerToLineup,
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    Badge,
    TableCell,
    LineupOverviewRow,
    LineupMember,
  },
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
  computed: {
    me() {
      return useAuthStore().me;
    },
    assigningLineups() {
      const currentStatus = this.match.status;
      return (
        this.match.is_organizer &&
        (currentStatus == "Warmup" ||
          currentStatus == "PickingPlayers" ||
          currentStatus == "Scheduled") &&
        this.canAddToLineup
      );
    },
    canAddToLineup() {
      return (
        this.canUpdateLineup &&
        this.lineup.lineup_players.length < this.match.max_players_per_lineup
      );
    },
    canUpdateLineup() {
      return (
        this.match.is_captain ||
        this.match.is_organizer
      );
    },
    canUpdateCoach() {
      return this.canUpdateLineup && this.match.options.coaches;
    },
    coaches() {
      const coaches = [];

      if (this.match.lineup_1.coach) {
        coaches.push(this.match.lineup_1.coach);
      }

      if (this.match.lineup_2.coach) {
        coaches.push(this.match.lineup_2.coach);
      }

      return coaches;
    },
    players() {
      if (!this.match) {
        return [];
      }

      const players = [];

      players.push(...this.match.lineup_1.lineup_players);
      players.push(...this.match.lineup_2.lineup_players);

      return players;
    },
  },
};
</script>
