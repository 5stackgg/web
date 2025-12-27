<script lang="ts" setup>
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchTableRow from "~/components/MatchTableRow.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
</script>

<template>
  <div class="space-y-6">
    <!-- Results Table -->
    <Card>
      <CardHeader>
        <CardTitle>
          <template v-if="stage.groups > 1">
            {{ $t("tournament.stage.group", { group: getGroupDisplay }) }}
          </template>
          <template v-else>
            {{ $t("tournament.results.title") }}
          </template>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead class="text-center">Matches Played</TableHead>
              <TableHead class="text-center">Wins</TableHead>
              <TableHead class="text-center">Losses</TableHead>
              <TableHead class="text-center">Maps Won</TableHead>
              <TableHead class="text-center">Maps Lost</TableHead>
              <TableHead class="text-center">Rounds Won</TableHead>
              <TableHead class="text-center">Rounds Lost</TableHead>
              <TableHead class="text-center">KDR</TableHead>
              <TableHead class="text-center">Total Kills</TableHead>
              <TableHead class="text-center">Total Deaths</TableHead>
              <TableHead class="text-center">Matches Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="result in stage?.results || []"
              :key="result.team?.id"
            >
              <TableCell>
                <div class="flex flex-col gap-2">
                  <div class="font-medium">{{ result.team.name }}</div>
                  <div class="flex flex-wrap gap-2">
                    <PlayerDisplay
                      v-for="rosterItem in result.team?.roster || []"
                      :key="rosterItem.player?.steam_id || rosterItem.steam_id"
                      :player="rosterItem.player || rosterItem"
                      :show-flag="true"
                      :show-role="false"
                      :show-elo="false"
                      class="text-xs"
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell class="text-center">
                {{ result.matches_played || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.wins || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.losses || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.maps_won || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.maps_lost || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.rounds_won || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.rounds_lost || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.team_kdr || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.total_kills || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.total_deaths || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ result.matches_remaining || 0 }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- All Matches -->
    <Card>
      <CardHeader>
        <CardTitle>{{ $t("tournament.results.matches") }}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <MatchTableRow
            v-for="match in allMatches"
            :key="match.id"
            :match="match"
          />
          <div
            v-if="allMatches.length === 0"
            class="text-center text-muted-foreground py-8"
          >
            No matches played yet
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    stage: {
      type: Object,
      required: true,
    },
    groupNumber: {
      type: Number,
      default: 1,
    },
    tournament: {
      type: Object,
      required: false,
    },
  },
  computed: {
    allMatches() {
      if (!this.stage?.brackets) {
        return [];
      }

      const matchesMap = new Map();

      // Collect all unique matches from brackets in this group
      for (let i = 0; i < this.stage.brackets.length; i++) {
        const bracket = this.stage.brackets[i];
        // Filter by group if specified
        if (this.groupNumber && bracket.group !== this.groupNumber) {
          continue;
        }

        if (bracket.match && !matchesMap.has(bracket.match.id)) {
          matchesMap.set(bracket.match.id, bracket.match);
        }
      }

      // Convert to array and sort by created_at (most recent first)
      return Array.from(matchesMap.values()).sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
    },
    getGroupDisplay() {
      // If we have 26 or fewer groups, use letters a-z
      if (this.stage.groups <= 26) {
        return String.fromCharCode(96 + this.groupNumber).toUpperCase();
      }
      // Otherwise use the original number
      return this.groupNumber;
    },
  },
};
</script>
