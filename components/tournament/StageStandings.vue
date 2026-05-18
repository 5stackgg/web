<script lang="ts" setup>
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
</script>

<template>
  <div class="space-y-4">
    <template v-if="groups.length">
      <div v-for="group in groups" :key="group.number">
        <h4
          v-if="showGroupHeading"
          class="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("tournament.stage.group", { group: group.display }) }}
        </h4>

        <div class="overflow-hidden rounded-md border border-border bg-card/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-12 text-center">#</TableHead>
                <TableHead>{{ $t("team.table.team") }}</TableHead>
                <TableHead class="text-center">
                  {{ $t("common.stats.wins") }}
                </TableHead>
                <TableHead class="text-center">
                  {{ $t("common.stats.losses") }}
                </TableHead>
                <TableHead class="text-center">
                  {{ $t("tournament.results_table.matches") }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="entry in group.entries"
                :key="entry.teamId || entry.teamName"
              >
                <TableCell class="text-center">
                  <div class="flex flex-col items-center gap-0.5">
                    <span
                      class="font-mono text-sm font-bold leading-none tabular-nums"
                      :style="rankStyle(entry.rank)"
                    >
                      {{ ordinal(entry.rank) }}
                    </span>
                    <span
                      v-if="entry.tied"
                      class="rounded-sm border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] px-1 py-[1px] font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.18em] text-[hsl(var(--tac-amber))]"
                    >
                      TIED
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="font-medium">{{ entry.teamName }}</div>
                </TableCell>
                <TableCell class="text-center font-mono tabular-nums">
                  {{ entry.wins }}
                </TableCell>
                <TableCell class="text-center font-mono tabular-nums">
                  {{ entry.losses }}
                </TableCell>
                <TableCell class="text-center font-mono tabular-nums">
                  {{ entry.matchesPlayed }}
                </TableCell>
              </TableRow>
              <TableRow v-if="group.entries.length === 0">
                <TableCell
                  colspan="5"
                  class="text-center text-muted-foreground"
                >
                  {{ $t("tournament.stage.no_standings") }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </template>
    <div
      v-else
      class="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
    >
      {{ $t("tournament.stage.no_standings") }}
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    stage: {
      type: Object,
      required: true,
    },
    // When false, group headings are hidden (useful for single-group stages).
    // When true, headings render even for a single group.
    forceGroupHeading: {
      type: Boolean,
      default: false,
    },
    // Optional filter: render only this group number (used by TournamentStage
    // to interleave standings with each group's bracket).
    onlyGroup: {
      type: Number,
      default: null,
    },
  },
  computed: {
    totalGroups() {
      return Number((this.stage as any)?.groups) || 1;
    },
    showGroupHeading() {
      if (this.onlyGroup != null) return false;
      return this.forceGroupHeading || this.totalGroups > 1;
    },
    groups() {
      const results = (((this.stage as any)?.results || []) as any[])
        .slice()
        .sort(
          (a: any, b: any) =>
            (Number(a.group_number) || 1) - (Number(b.group_number) || 1) ||
            (Number(a.rank) || 0) - (Number(b.rank) || 0),
        );

      const grouped = new Map<number, any[]>();
      for (const row of results) {
        const gn = Number(row.group_number) || 1;
        const list = grouped.get(gn) || [];
        list.push(row);
        grouped.set(gn, list);
      }

      const out: Array<{
        number: number;
        display: string;
        entries: any[];
      }> = [];
      const numbers = Array.from(grouped.keys()).sort((a, b) => a - b);
      for (const gn of numbers) {
        if (this.onlyGroup != null && this.onlyGroup !== gn) continue;
        const rows = grouped.get(gn) || [];
        const sorted = rows
          .slice()
          .sort(
            (a: any, b: any) => (Number(a.rank) || 0) - (Number(b.rank) || 0),
          );

        // Tied iff multiple teams share the same `placement` (RANK with ties)
        // from the API. `rank` itself is a deterministic ROW_NUMBER and never
        // ties, so we can't read tied-ness off it. Using `placement` avoids
        // false positives in DE where two teams at different elimination tiers
        // can coincidentally share the same W-L record.
        const placementCounts = new Map<number, number>();
        for (const row of sorted) {
          const p = Number(row.placement) || 0;
          if (!p) continue;
          placementCounts.set(p, (placementCounts.get(p) || 0) + 1);
        }

        const entries = sorted.map((row: any) => ({
          rank: Number(row.rank) || 0,
          teamId: row.tournament_team_id || row.team?.id,
          teamName: this.displayTeamName(
            row.team,
            row.tournament_team_id || row.team?.id,
          ),
          wins: Number(row.wins) || 0,
          losses: Number(row.losses) || 0,
          matchesPlayed: Number(row.matches_played) || 0,
          tied: (placementCounts.get(Number(row.placement) || 0) || 0) > 1,
        }));
        out.push({
          number: gn,
          display: this.groupDisplay(gn),
          entries,
        });
      }
      return out;
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
    groupDisplay(groupNumber: number) {
      if (this.totalGroups <= 26) {
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
  },
};
</script>
