<script lang="ts" setup>
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
    <template v-if="multiGroupStages.length">
      <section
        v-for="stage in multiGroupStages"
        :key="stage.id"
        class="space-y-4"
      >
        <header
          v-if="multiGroupStages.length > 1"
          class="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]"></span>
          {{ stage.e_tournament_stage_type?.description || "" }}
        </header>

        <div class="grid gap-4 md:grid-cols-2">
          <Card v-for="group in groupsForStage(stage)" :key="group.key">
            <CardHeader>
              <CardTitle>
                {{
                  $t("tournament.stage.group", { group: group.display })
                }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-16 text-center">#</TableHead>
                    <TableHead>{{ $t("team.table.team") }}</TableHead>
                    <TableHead class="text-center">{{
                      $t("common.stats.wins")
                    }}</TableHead>
                    <TableHead class="text-center">{{
                      $t("common.stats.losses")
                    }}</TableHead>
                    <TableHead class="text-center">{{
                      $t("tournament.results_table.matches")
                    }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="entry in group.entries"
                    :key="entry.teamId || entry.teamName"
                  >
                    <TableCell class="text-center">
                      <span
                        class="font-mono text-sm font-bold leading-none tabular-nums"
                        :style="rankStyle(entry.rank)"
                      >
                        {{ ordinal(entry.rank) }}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div class="font-medium">{{ entry.teamName }}</div>
                    </TableCell>
                    <TableCell class="text-center font-mono tabular-nums">{{
                      entry.wins
                    }}</TableCell>
                    <TableCell class="text-center font-mono tabular-nums">{{
                      entry.losses
                    }}</TableCell>
                    <TableCell class="text-center font-mono tabular-nums">{{
                      entry.matchesPlayed
                    }}</TableCell>
                  </TableRow>
                  <TableRow v-if="group.entries.length === 0">
                    <TableCell
                      colspan="5"
                      class="text-center text-muted-foreground"
                    >
                      No standings yet
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>
    </template>
    <div
      v-else
      class="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground"
    >
      No grouped stages.
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  methods: {
    ordinal(n: number) {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },
    rankStyle(rank: number) {
      if (rank === 1) return { color: "hsl(45 95% 60%)" };
      if (rank === 2) return { color: "hsl(0 0% 78%)" };
      if (rank === 3) return { color: "hsl(28 70% 52%)" };
      return {};
    },
    groupDisplay(stage: any, groupNumber: number) {
      const groups = stage?.groups || 1;
      if (groups <= 26) {
        return String.fromCharCode(96 + groupNumber).toUpperCase();
      }
      return String(groupNumber);
    },
    displayTeamName(tournamentTeam: any, fallbackId?: string) {
      const underlying = tournamentTeam?.team?.name;
      if (underlying) return underlying;
      const ownName = tournamentTeam?.name;
      if (ownName) return ownName;
      return fallbackId ? `Team ${fallbackId}` : "";
    },
    groupsForStage(stage: any) {
      const groupByTeamId = new Map<string, number>();
      for (const bracket of stage?.brackets || []) {
        const groupNumber = bracket.group;
        if (!groupNumber) continue;
        const team1Id = bracket.team_1?.id;
        const team2Id = bracket.team_2?.id;
        if (team1Id && !groupByTeamId.has(team1Id)) {
          groupByTeamId.set(team1Id, groupNumber);
        }
        if (team2Id && !groupByTeamId.has(team2Id)) {
          groupByTeamId.set(team2Id, groupNumber);
        }
      }

      const ratio = (a: number, b: number) =>
        b > 0 ? Number(a) / Number(b) : Number(a);

      const sortResults = (rows: any[]) =>
        [...rows].sort((a, b) => {
          const aw = Number(a.wins) || 0;
          const bw = Number(b.wins) || 0;
          if (aw !== bw) return bw - aw;
          const ah = Number(a.head_to_head_match_wins) || 0;
          const bh = Number(b.head_to_head_match_wins) || 0;
          if (ah !== bh) return bh - ah;
          const ahr = Number(a.head_to_head_rounds_won) || 0;
          const bhr = Number(b.head_to_head_rounds_won) || 0;
          if (ahr !== bhr) return bhr - ahr;
          const amr = ratio(a.maps_won, a.maps_lost);
          const bmr = ratio(b.maps_won, b.maps_lost);
          if (amr !== bmr) return bmr - amr;
          const arr = ratio(a.rounds_won, a.rounds_lost);
          const brr = ratio(b.rounds_won, b.rounds_lost);
          if (arr !== brr) return brr - arr;
          const ak = Number(a.team_kdr) || 0;
          const bk = Number(b.team_kdr) || 0;
          return bk - ak;
        });

      const results = (stage?.results || []) as any[];
      const grouped = new Map<number, any[]>();
      for (const result of results) {
        const teamId = result.tournament_team_id || result.team?.id;
        const groupNumber = teamId ? groupByTeamId.get(teamId) : undefined;
        if (!groupNumber) continue;
        const list = grouped.get(groupNumber) || [];
        list.push(result);
        grouped.set(groupNumber, list);
      }

      const groupNumbers: number[] = [];
      const seen = new Set<number>();
      for (const bracket of stage?.brackets || []) {
        const groupNumber = bracket.group;
        if (groupNumber && !seen.has(groupNumber)) {
          seen.add(groupNumber);
          groupNumbers.push(groupNumber);
        }
      }
      groupNumbers.sort((a, b) => a - b);

      return groupNumbers.map((groupNumber) => {
        const sorted = sortResults(grouped.get(groupNumber) || []);
        const entries = sorted.map((row: any, index: number) => ({
          rank: index + 1,
          teamId: row.tournament_team_id || row.team?.id,
          teamName: this.displayTeamName(
            row.team,
            row.tournament_team_id || row.team?.id,
          ),
          wins: Number(row.wins) || 0,
          losses: Number(row.losses) || 0,
          matchesPlayed: Number(row.matches_played) || 0,
        }));
        return {
          key: `${stage.id}-${groupNumber}`,
          number: groupNumber,
          display: this.groupDisplay(stage, groupNumber),
          entries,
        };
      });
    },
  },
  computed: {
    multiGroupStages() {
      const stages = (this.tournament as any)?.stages || [];
      return stages.filter((stage: any) => (stage?.groups || 0) > 1);
    },
  },
};
</script>
