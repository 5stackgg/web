<script setup lang="ts">
import LineupOverviewRow from "~/components/match/LineupOverviewRow.vue";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import AssignPlayerToLineup from "~/components/match/AssignPlayerToLineup.vue";
import { e_match_status_enum } from "~/generated/zeus";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[200px] text-left">
          <div class="flex items-center justify-between">
            <span>{{ lineup.name }}</span>
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
        <TableHead>Kills</TableHead>
        <TableHead class="hidden md:table-cell">Assists</TableHead>
        <TableHead>Deaths</TableHead>
        <TableHead class="hidden md:table-cell">K/D</TableHead>
        <TableHead class="hidden lg:table-cell">HS%</TableHead>
        <TableHead>Total Damage</TableHead>
        <TableHead class="hidden lg:table-cell">Team Damage</TableHead>
        <TableHead class="hidden md:table-cell">Multi Kill Rounds</TableHead>
        <TableHead class="hidden lg:table-cell">2K</TableHead>
        <TableHead class="hidden lg:table-cell">3K</TableHead>
        <TableHead class="hidden lg:table-cell">4K</TableHead>
        <TableHead class="hidden lg:table-cell">5K</TableHead>
        <TableHead class="hidden lg:table-cell">Knifes</TableHead>
        <TableHead class="hidden lg:table-cell">Zeus</TableHead>
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

  <div v-if="lineup.can_update_lineup && canAddToLineup" class="mt-4">
    <AssignPlayerToLineup
      :lineup="lineup"
      :exclude="excludePlayers"
    ></AssignPlayerToLineup>
  </div>
</template>

<script lang="ts">
export default {
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
    canAddToLineup() {
      return (
        this.lineup.can_update_lineup &&
        this.lineup.lineup_players.length < this.match.max_players_per_lineup
      );
    },
    excludePlayers() {
      if (!this.match) {
        return [];
      }

      const players = [];

      players.push(...this.match.lineup_1.lineup_players);
      players.push(...this.match.lineup_2.lineup_players);

      if (this.match.lineup_1.coach) {
        players.push(this.match.lineup_1.coach);
      }

      if (this.match.lineup_2.coach) {
        players.push(this.match.lineup_2.coach);
      }

      return players;
    },
  },
};
</script>
