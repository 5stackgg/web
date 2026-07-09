<script setup lang="ts">
import { computed } from "vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export interface LeagueStandingRow {
  league_team_season_id: string;
  league_team_id: string;
  matches_played: number;
  matches_remaining: number;
  wins: number;
  losses: number;
  rounds_won: number;
  rounds_lost: number;
  round_diff: number;
  rank: number;
}

const props = defineProps<{
  standings: LeagueStandingRow[];
  teamNames: Record<string, string>;
  playoffSeats?: number;
  // Total teams in the division (may exceed the paged `standings` slice) so we
  // know whether the cutoff is even meaningful.
  totalTeams?: number;
  withdrawnTeamSeasonIds?: string[];
  highlightTeamSeasonIds?: string[];
}>();

const teamCount = computed(() => props.totalTeams ?? props.standings.length);

// The cutoff only means something when some — but not all — teams advance.
const cutoffActive = computed(
  () =>
    props.playoffSeats != null &&
    props.playoffSeats > 0 &&
    props.playoffSeats < teamCount.value,
);

const everyoneAdvances = computed(
  () =>
    props.playoffSeats != null &&
    props.playoffSeats > 0 &&
    teamCount.value > 0 &&
    props.playoffSeats >= teamCount.value,
);

const hasMine = computed(() => props.standings.some((r) => isMine(r)));

function isPlayoffSeat(row: LeagueStandingRow) {
  return (
    cutoffActive.value && row.rank <= props.playoffSeats! && !isWithdrawn(row)
  );
}

// Last team above the cutoff — the dotted line is drawn under it.
function isCutoffRow(row: LeagueStandingRow) {
  return cutoffActive.value && row.rank === props.playoffSeats;
}

function isWithdrawn(row: LeagueStandingRow) {
  return props.withdrawnTeamSeasonIds?.includes(row.league_team_season_id);
}

function isMine(row: LeagueStandingRow) {
  return props.highlightTeamSeasonIds?.includes(row.league_team_season_id);
}
</script>

<template>
  <div>
    <div class="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-10 text-center">#</TableHead>
            <TableHead>{{ $t("league.standings.team") }}</TableHead>
            <TableHead class="text-center">{{
              $t("league.standings.record")
            }}</TableHead>
            <TableHead class="text-center">{{
              $t("league.standings.rounds")
            }}</TableHead>
            <TableHead class="text-center">{{
              $t("league.standings.round_diff")
            }}</TableHead>
            <TableHead class="text-center">{{
              $t("league.standings.remaining")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!standings.length">
            <TableCell
              colspan="6"
              class="py-8 text-center text-sm text-muted-foreground"
            >
              {{ $t("league.standings.empty") }}
            </TableCell>
          </TableRow>
          <TableRow
            v-for="row in standings"
            :key="row.league_team_season_id"
            :class="[
              isMine(row)
                ? 'bg-[hsl(var(--tac-amber)/0.12)] shadow-[inset_3px_0_0_hsl(var(--tac-amber))]'
                : isPlayoffSeat(row)
                  ? 'bg-[hsl(var(--tac-amber)/0.05)]'
                  : undefined,
              isCutoffRow(row)
                ? '[&>td]:border-b-2 [&>td]:border-dashed [&>td]:!border-b-[hsl(var(--tac-amber)/0.55)]'
                : '',
            ]"
          >
            <TableCell class="text-center font-mono text-sm">
              <span
                :class="
                  isPlayoffSeat(row)
                    ? 'font-bold text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
                >{{ row.rank }}</span
              >
            </TableCell>
            <TableCell class="font-medium">
              <span
                :class="{
                  'text-muted-foreground line-through': isWithdrawn(row),
                }"
              >
                {{ teamNames[row.league_team_season_id] ?? "—" }}
              </span>
              <span
                v-if="isWithdrawn(row)"
                class="ml-2 rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-destructive"
                >{{ $t("league.standings.removed") }}</span
              >
            </TableCell>
            <TableCell class="text-center font-mono text-sm">
              {{ row.wins }}–{{ row.losses }}
            </TableCell>
            <TableCell
              class="text-center font-mono text-sm text-muted-foreground"
            >
              {{ row.rounds_won }}:{{ row.rounds_lost }}
            </TableCell>
            <TableCell class="text-center font-mono text-sm">
              <span
                :class="
                  row.round_diff > 0
                    ? 'text-success'
                    : row.round_diff < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                "
                >{{ row.round_diff > 0 ? "+" : "" }}{{ row.round_diff }}</span
              >
            </TableCell>
            <TableCell
              class="text-center font-mono text-sm text-muted-foreground"
            >
              {{ row.matches_remaining }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Legend -->
    <div
      v-if="cutoffActive || hasMine || everyoneAdvances"
      class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[0.7rem] text-muted-foreground"
    >
      <span v-if="cutoffActive" class="flex items-center gap-1.5">
        <span
          class="h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--tac-amber)/0.45)] ring-1 ring-inset ring-[hsl(var(--tac-amber)/0.55)]"
        ></span>
        {{ $t("league.standings.legend.advances", { n: playoffSeats }) }}
      </span>
      <span v-if="cutoffActive" class="flex items-center gap-1.5">
        <span
          class="inline-block h-0 w-5 border-t-2 border-dashed border-[hsl(var(--tac-amber)/0.6)]"
        ></span>
        {{ $t("league.standings.legend.cutoff") }}
      </span>
      <span v-if="hasMine" class="flex items-center gap-1.5">
        <span class="h-3 w-1 rounded-sm bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("league.standings.legend.your_team") }}
      </span>
      <span v-if="everyoneAdvances" class="flex items-center gap-1.5">
        {{ $t("league.standings.legend.all_advance") }}
      </span>
    </div>
  </div>
</template>
