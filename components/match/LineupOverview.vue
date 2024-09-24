<script setup lang="ts">
import LineupOverviewRow from "~/components/match/LineupOverviewRow.vue";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "~/components/ui/table";
import AssignPlayerToLineup from "~/components/match/AssignPlayerToLineup.vue";
import { e_match_status_enum } from "~/generated/zeus";
import PlayerDisplay from "../PlayerDisplay.vue";
PlayerDisplay;
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
        <TableHead class="w-[4ch] text-center">
          K<span class="hidden xl:inline">ills</span>
        </TableHead>
        <TableHead class="hidden md:table-cell w-[4ch] text-center">
          A<span class="hidden xl:inline">ssists</span>
        </TableHead>
        <TableHead class="w-[4ch] text-center">
          D<span class="hidden xl:inline">eaths</span>
        </TableHead>
        <TableHead class="hidden md:table-cell w-[16ch] text-center"
          >K/D</TableHead
        >
        <TableHead class="hidden lg:table-cell w-[4ch] text-center"
          >HS%</TableHead
        >
        <TableHead class="hidden 2xl:table-cell w-[16ch] text-center"
          >Team Damage</TableHead
        >
        <TableHead class="hidden xl:table-cell w-[30ch] text-center">
          <span class="hidden 2xl:inline"> Multi Kill Rounds </span>
          <span class="2xl:hidden"> MKR </span>
        </TableHead>
        <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
          >2K</TableHead
        >
        <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
          >3K</TableHead
        >
        <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
          >4K</TableHead
        >
        <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
          >5K</TableHead
        >
        <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
          >Knifes</TableHead
        >
        <TableHead class="hidden 2xl:table-cell w-[4ch] text-center"
          >Zeus</TableHead
        >
        <TableHead class="text-center w-[24ch] text-center"
          >Total Damage</TableHead
        >
        <TableHead v-if="lineup.can_update_lineup"> </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <LineupOverviewRow
        :match="match"
        :member="member"
        :lineup="lineup"
        v-for="member of lineup.lineup_players"
      ></LineupOverviewRow>
      <TableRow
        v-for="slot of Math.max(0, minPlayers - lineup.lineup_players.length)"
      >
        <TableCell colspan="100%">
          <div class="flex">
            <PlayerDisplay
              :show-flag="false"
              :show-steam-id="false"
              :player="{
                name: `Slot ${slot + lineup.lineup_players.length}`,
              }"
            />
            <template
              v-if="lineup.can_update_lineup && canAddToLineup && slot === 1"
            >
              <AssignPlayerToLineup
                :lineup="lineup"
                :exclude="excludePlayers"
              ></AssignPlayerToLineup>
            </template>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
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
        this.lineup.lineup_players.length < this.maxPlayers
      );
    },
    minPlayers() {
      return this.match.min_players_per_lineup;
    },
    maxPlayers() {
      return this.match.max_players_per_lineup;
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
