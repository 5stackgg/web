<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="hidden sm:table-cell">
          <div class="flex">
            {{ lineup.name }}
            <span
              v-if="match.status === e_match_status_enum.WaitingForCheckIn"
              class="flex h-2 w-2 rounded-full"
              :class="{
                ['bg-red-600']: !lineup.is_ready,
                ['bg-green-600']: lineup.is_ready,
              }"
            ></span>
          </div>
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
      <TableRow v-if="lineup.can_update_lineup">
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
      <LineupOverviewRow
        :match="match"
        :member="member"
        :lineup="lineup"
        v-for="member of lineup.lineup_players"
      ></LineupOverviewRow>
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
import { e_match_status_enum, e_match_types_enum } from "~/generated/zeus";
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
    e_match_status_enum() {
      return e_match_status_enum;
    },
    me() {
      return useAuthStore().me;
    },
    canAddToLineup() {
      return (
        this.lineup.can_update_lineup &&
        this.lineup.lineup_players.length < this.match.max_players_per_lineup
      );
    },
    canUpdateCoach() {
      return this.match.options.coaches;
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
