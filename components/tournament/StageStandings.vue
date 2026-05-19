<script lang="ts" setup>
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { ChevronRight } from "lucide-vue-next";
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
                <TableHead class="w-8"></TableHead>
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
              <template
                v-for="entry in group.entries"
                :key="entry.teamId || entry.teamName"
              >
                <TableRow
                  class="cursor-pointer transition-colors hover:bg-muted/30"
                  :class="{ 'bg-muted/20': isExpanded(entry.teamId) }"
                  @click="toggleExpanded(entry.teamId)"
                >
                  <TableCell class="text-center">
                    <ChevronRight
                      class="mx-auto h-4 w-4 text-muted-foreground transition-transform duration-150"
                      :class="{ 'rotate-90': isExpanded(entry.teamId) }"
                    />
                  </TableCell>
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
                    <NuxtLink
                      v-if="entry.teamLinkId"
                      :to="`/teams/${entry.teamLinkId}`"
                      class="font-medium hover:text-[hsl(var(--tac-amber))] transition-colors"
                      @click.stop
                    >
                      {{ entry.teamName }}
                    </NuxtLink>
                    <div v-else class="font-medium">{{ entry.teamName }}</div>
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
                <TableRow
                  v-if="isExpanded(entry.teamId)"
                  class="hover:bg-transparent"
                >
                  <TableCell
                    colspan="6"
                    class="border-t border-border/40 bg-background/40 p-0"
                  >
                    <div
                      v-if="entry.roster.length === 0"
                      class="px-4 py-3 text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      {{ $t("tournament.standings_section.no_roster") }}
                    </div>
                    <div v-else class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead>
                          <tr
                            class="border-b border-border/40 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
                          >
                            <th class="px-4 py-2 text-left font-normal">
                              {{ $t("common.player") }}
                            </th>
                            <th class="px-2 py-2 text-center font-normal">K</th>
                            <th class="px-2 py-2 text-center font-normal">D</th>
                            <th class="px-2 py-2 text-center font-normal">A</th>
                            <th class="px-2 py-2 text-center font-normal">
                              K/D
                            </th>
                            <th class="px-2 py-2 text-center font-normal">
                              HS%
                            </th>
                            <th class="px-2 py-2 text-center font-normal">
                              MP
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="member in entry.roster"
                            :key="member.player.steam_id"
                            class="border-b border-border/20 last:border-b-0"
                          >
                            <td class="px-4 py-2">
                              <PlayerDisplay
                                :player="member.player"
                                :show-flag="true"
                                :show-role="false"
                                :show-elo="true"
                                :linkable="true"
                                size="xs"
                              />
                            </td>
                            <template
                              v-if="playerStatFor(member.player.steam_id)"
                            >
                              <td
                                class="px-2 py-2 text-center font-mono tabular-nums"
                              >
                                {{
                                  playerStatFor(member.player.steam_id).kills
                                }}
                              </td>
                              <td
                                class="px-2 py-2 text-center font-mono tabular-nums"
                              >
                                {{
                                  playerStatFor(member.player.steam_id).deaths
                                }}
                              </td>
                              <td
                                class="px-2 py-2 text-center font-mono tabular-nums"
                              >
                                {{
                                  playerStatFor(member.player.steam_id).assists
                                }}
                              </td>
                              <td
                                class="px-2 py-2 text-center font-mono tabular-nums font-bold"
                                :style="{
                                  color:
                                    playerStatFor(member.player.steam_id).kdr >=
                                    1
                                      ? 'hsl(142, 71%, 55%)'
                                      : 'hsl(0, 84%, 65%)',
                                }"
                              >
                                {{
                                  playerStatFor(
                                    member.player.steam_id,
                                  ).kdr.toFixed(2)
                                }}
                              </td>
                              <td
                                class="px-2 py-2 text-center font-mono tabular-nums"
                              >
                                {{
                                  playerStatFor(
                                    member.player.steam_id,
                                  ).headshot_percentage.toFixed(0)
                                }}%
                              </td>
                              <td
                                class="px-2 py-2 text-center font-mono tabular-nums text-muted-foreground"
                              >
                                {{
                                  playerStatFor(member.player.steam_id)
                                    .matches_played
                                }}
                              </td>
                            </template>
                            <template v-else>
                              <td
                                colspan="6"
                                class="px-2 py-2 text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/60"
                              >
                                {{ $t("tournament.results_section.no_data") }}
                              </td>
                            </template>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </TableCell>
                </TableRow>
              </template>
              <TableRow v-if="group.entries.length === 0">
                <TableCell
                  colspan="6"
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
    playerStats: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      expandedTeams: new Set<string>(),
    };
  },
  computed: {
    totalGroups() {
      return Number((this.stage as any)?.groups) || 1;
    },
    showGroupHeading() {
      if (this.onlyGroup != null) return false;
      return this.forceGroupHeading || this.totalGroups > 1;
    },
    statsByPlayer() {
      const map = new Map<string, any>();
      for (const s of (this.playerStats as any[]) || []) {
        if (s?.player_steam_id == null) continue;
        map.set(String(s.player_steam_id), s);
      }
      return map;
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
          teamLinkId: row.team?.team?.id || null,
          teamName: this.displayTeamName(
            row.team,
            row.tournament_team_id || row.team?.id,
          ),
          wins: Number(row.wins) || 0,
          losses: Number(row.losses) || 0,
          matchesPlayed: Number(row.matches_played) || 0,
          tied: (placementCounts.get(Number(row.placement) || 0) || 0) > 1,
          roster: (row.team?.roster || []).filter((m: any) => m?.player),
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
    isExpanded(teamId: string | undefined) {
      if (!teamId) return false;
      return this.expandedTeams.has(String(teamId));
    },
    toggleExpanded(teamId: string | undefined) {
      if (!teamId) return;
      const key = String(teamId);
      const next = new Set(this.expandedTeams);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      this.expandedTeams = next;
    },
    playerStatFor(steamId: string | number | undefined) {
      if (steamId == null) return null;
      const raw = this.statsByPlayer.get(String(steamId));
      if (!raw) return null;
      return {
        kills: Number(raw.kills ?? 0),
        deaths: Number(raw.deaths ?? 0),
        assists: Number(raw.assists ?? 0),
        headshots: Number(raw.headshots ?? 0),
        kdr: Number(raw.kdr ?? 0),
        headshot_percentage: Number(raw.headshot_percentage ?? 0),
        matches_played: Number(raw.matches_played ?? 0),
      };
    },
  },
};
</script>
