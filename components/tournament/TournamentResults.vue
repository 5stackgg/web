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
        <CardTitle>{{ $t("tournament.results.title") }}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead class="text-center">Wins</TableHead>
              <TableHead class="text-center">Losses</TableHead>
              <TableHead class="text-center">KDR</TableHead>
              <TableHead class="text-center">Total Kills</TableHead>
              <TableHead class="text-center">Total Deaths</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="teamResult in teamResults"
              :key="teamResult.teamId"
            >
              <TableCell>
                <div class="flex flex-col gap-2">
                  <div class="font-medium">{{ teamResult.teamName }}</div>
                  <div class="flex flex-wrap gap-2">
                    <PlayerDisplay
                      v-for="rosterItem in teamResult.team?.roster || []"
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
                {{ teamResult.wins }}
              </TableCell>
              <TableCell class="text-center">
                {{ teamResult.losses }}
              </TableCell>
              <TableCell class="text-center">
                {{ teamResult.team_kdr || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ teamResult.total_kills || 0 }}
              </TableCell>
              <TableCell class="text-center">
                {{ teamResult.total_deaths || 0 }}
              </TableCell>
            </TableRow>
            <TableRow v-if="teamResults.length === 0">
              <TableCell colspan="6" class="text-center text-muted-foreground">
                No results yet
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- All Matches -->
    <Card v-if="showMatches">
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
    tournament: {
      type: Object,
      required: true,
    },
    showMatches: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    teamResults() {
      if (!this.tournament?.stages || !this.tournament?.teams) {
        return [];
      }

      // Map to track team stats
      const teamStatsMap = new Map();

      // Initialize all teams with 0 wins/losses
      this.tournament.teams.forEach((team: any) => {
        teamStatsMap.set(team.id, {
          teamId: team.id,
          teamName: team.name || team.team?.name || `Team ${team.id}`,
          team: team,
          wins: 0,
          losses: 0,
          matches: [],
        });
      });

      // Process all brackets to calculate wins/losses and collect matches
      this.tournament.stages.forEach((stage: any) => {
        if (stage.brackets) {
          stage.brackets.forEach((bracket: any) => {
            if (bracket.match && bracket.match.status === "Finished") {
              const match = bracket.match;
              const winningLineupId = match.winning_lineup_id;

              // Determine which team won/lost
              let team1Id = null;
              let team2Id = null;

              // Find team IDs from bracket or match lineups
              if (bracket.team_1?.id) {
                team1Id = bracket.team_1.id;
              } else if (match.lineup_1?.team_id) {
                team1Id = match.lineup_1.team_id;
              }

              if (bracket.team_2?.id) {
                team2Id = bracket.team_2.id;
              } else if (match.lineup_2?.team_id) {
                team2Id = match.lineup_2.team_id;
              }

              // Update wins/losses and add match
              if (team1Id && teamStatsMap.has(team1Id)) {
                const stats = teamStatsMap.get(team1Id);
                if (winningLineupId === match.lineup_1_id) {
                  stats.wins++;
                } else if (winningLineupId === match.lineup_2_id) {
                  stats.losses++;
                }
                stats.matches.push(match);
              }

              if (team2Id && teamStatsMap.has(team2Id)) {
                const stats = teamStatsMap.get(team2Id);
                if (winningLineupId === match.lineup_2_id) {
                  stats.wins++;
                } else if (winningLineupId === match.lineup_1_id) {
                  stats.losses++;
                }
                stats.matches.push(match);
              }
            } else if (bracket.match) {
              // Add unfinished matches too
              const match = bracket.match;
              let team1Id = null;
              let team2Id = null;

              if (bracket.team_1?.id) {
                team1Id = bracket.team_1.id;
              } else if (match.lineup_1?.team_id) {
                team1Id = match.lineup_1.team_id;
              }

              if (bracket.team_2?.id) {
                team2Id = bracket.team_2.id;
              } else if (match.lineup_2?.team_id) {
                team2Id = match.lineup_2.team_id;
              }

              if (team1Id && teamStatsMap.has(team1Id)) {
                teamStatsMap.get(team1Id).matches.push(match);
              }
              if (team2Id && teamStatsMap.has(team2Id)) {
                teamStatsMap.get(team2Id).matches.push(match);
              }
            }
          });
        }
      });

      // Convert to array and sort by wins (descending)
      return Array.from(teamStatsMap.values())
        .filter(
          (stats) =>
            stats.matches.length > 0 || stats.wins > 0 || stats.losses > 0,
        )
        .sort((a, b) => b.wins - a.wins);
    },
    allMatches() {
      if (!this.tournament?.stages) {
        return [];
      }

      const matchesMap = new Map();

      // Collect all unique matches from all brackets
      this.tournament.stages.forEach((stage: any) => {
        if (stage.brackets) {
          stage.brackets.forEach((bracket: any) => {
            if (bracket.match && !matchesMap.has(bracket.match.id)) {
              matchesMap.set(bracket.match.id, bracket.match);
            }
          });
        }
      });

      // Convert to array and sort by created_at (most recent first)
      return Array.from(matchesMap.values()).sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
    },
  },
};
</script>
