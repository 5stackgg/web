<script setup lang="ts">
import LineupOverviewRow from "~/components/match/LineupOverviewRow.vue";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import { useTableSort } from "~/composables/useTableSort";
import { useMatchSide } from "~/composables/useMatchSide";

const matchSide = useMatchSide();
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "~/components/ui/table";

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>(
  "kills",
  "desc",
);

function statFor(member: any) {
  const arr =
    member?.player?.match_stats ?? member?.player?.match_map_stats ?? null;
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

// Per-row KAST/Survived for sorting, mirroring LineupOverviewRow: KAST is the
// rounds-weighted kast_pct from the player.match_map_hltv view (0-100 scale, to
// match LineupOverviewRow.kastPct); survived = rounds_played - deaths. No
// round-walking.
function kastFor(_match: any, member: any): { kast: number; survived: number } {
  const rows = member?.player?.match_map_hltv ?? [];
  let weighted = 0;
  let hltvRounds = 0;
  for (const r of rows) {
    const rp = r.rounds_played ?? 0;
    weighted += (r.kast_pct ?? 0) * rp;
    hltvRounds += rp;
  }
  const kast = hltvRounds > 0 ? weighted / hltvRounds : 0;
  const s = statFor(member);
  const rp = s?.rounds_played ?? 0;
  const survived = rp > 0 ? Math.max(0, rp - (s?.deaths ?? 0)) : 0;
  return { kast, survived };
}

function totalRoundsFor(match: any): number {
  let r = 0;
  for (const m of match?.match_maps ?? []) {
    r += (m.lineup_1_score ?? 0) + (m.lineup_2_score ?? 0);
  }
  return r;
}

function hltvFor(match: any, member: any): number {
  const s = statFor(member);
  if (!s) return 0;
  const rounds = s.rounds_played ?? totalRoundsFor(match);
  if (!rounds) return 0;
  const kpr = (s.kills ?? 0) / rounds;
  const dpr = (s.deaths ?? 0) / rounds;
  const apr = (s.assists ?? 0) / rounds;
  const adr = (s.damage ?? 0) / rounds;
  const { kast } = kastFor(match, member);
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  return (
    0.0073 * kast +
    0.3591 * kpr -
    0.5329 * dpr +
    0.2372 * impact +
    0.0032 * adr +
    0.1587
  );
}

function buildSortGetters(match: any) {
  return {
    name: (m: any) => m?.player?.name ?? m?.placeholder_name ?? "",
    kills: (m: any) => statFor(m)?.kills ?? 0,
    assists: (m: any) => statFor(m)?.assists ?? 0,
    deaths: (m: any) => statFor(m)?.deaths ?? 0,
    kd: (m: any) => {
      const s = statFor(m);
      if (!s) return 0;
      if (!s.deaths) return s.kills ?? 0;
      return (s.kills ?? 0) / s.deaths;
    },
    hltv: (m: any) => hltvFor(match, m),
    hs: (m: any) => {
      const s = statFor(m);
      if (!s?.kills) return 0;
      return (s.hs_kills ?? 0) / s.kills;
    },
    kast: (m: any) => kastFor(match, m).kast,
    survived: (m: any) => kastFor(match, m).survived,
    damage: (m: any) => statFor(m)?.damage ?? 0,
    team_damage: (m: any) => statFor(m)?.team_damage ?? 0,
    multikills: (m: any) => {
      const s = statFor(m);
      if (!s) return 0;
      return (
        (s.two_kill_rounds ?? 0) +
        (s.three_kill_rounds ?? 0) +
        (s.four_kill_rounds ?? 0) +
        (s.five_kill_rounds ?? 0)
      );
    },
    k2: (m: any) => statFor(m)?.two_kill_rounds ?? 0,
    k3: (m: any) => statFor(m)?.three_kill_rounds ?? 0,
    k4: (m: any) => statFor(m)?.four_kill_rounds ?? 0,
    k5: (m: any) => statFor(m)?.five_kill_rounds ?? 0,
    knife_kills: (m: any) => statFor(m)?.knife_kills ?? 0,
    zeus_kills: (m: any) => statFor(m)?.zeus_kills ?? 0,
  };
}
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "~/components/ui/dialog";
import AssignPlayerToLineup from "~/components/match/AssignPlayerToLineup.vue";
import { e_match_status_enum } from "~/generated/zeus";
import PlayerDisplay from "../PlayerDisplay.vue";
import { PencilIcon } from "lucide-vue-next";
import { useOverviewColumns } from "~/composables/useMatchTableColumns";

const { visibility: overviewVis } = useOverviewColumns();
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  FormItem,
  FormControl,
  FormMessage,
  FormField,
} from "~/components/ui/form";
</script>

<template>
  <Table
    class="min-w-full w-max [&_td]:whitespace-nowrap [&_th]:px-2 [&_td]:px-2 [&_th.sticky+th]:!pl-5 [&_td.sticky+td]:!pl-5"
  >
    <template v-for="(lp, lpIdx) of lineupsToRender" :key="lp.id">
      <TableHeader
        :class="[
          '[&_th]:h-12 bg-muted/20',
          lpIdx > 0 ? '[&_th]:pt-7 border-t-[3px] border-border/80' : '',
        ]"
      >
        <TableRow>
          <TableHead
            v-if="!hideMember"
            class="w-[110px] md:w-[220px] text-left sticky left-0 z-20 bg-card border-r border-border shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)] touch-pan-y [transform:translateZ(0)]"
          >
            <div class="flex items-center gap-1 md:gap-4">
              <div
                v-if="match.status === e_match_status_enum.WaitingForCheckIn"
                class="relative inline-flex"
              >
                <span
                  class="absolute inline-flex h-2 w-2 rounded-full animate-ping"
                  :class="{
                    'bg-red-600': !lp.is_ready,
                    'bg-green-600': lp.is_ready,
                  }"
                ></span>
                <span
                  class="relative inline-flex h-2 w-2 rounded-full"
                  :class="{
                    'bg-red-600': !lp.is_ready,
                    'bg-green-600': lp.is_ready,
                  }"
                ></span>
              </div>
              <span class="truncate">{{ lp.name }}</span>
              <div v-if="canEditTeamName(lp)" class="w-6 h-6 flex-shrink-0">
                <Dialog
                  :open="editingLineupId === lp.id"
                  @update:open="(v) => (editingLineupId = v ? lp.id : null)"
                >
                  <DialogTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6"
                      @click="prepareEditName(lp)"
                    >
                      <PencilIcon class="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogTitle>{{
                      $t("match.overview.update_team_name")
                    }}</DialogTitle>
                    <form
                      @submit.prevent="saveTeamName(lp)"
                      class="space-y-4 pt-2"
                    >
                      <FormField name="team_name" v-slot="{ componentField }">
                        <FormItem>
                          <FormControl>
                            <Input
                              v-bind="componentField"
                              v-model="editName"
                              :placeholder="$t('common.team_name') as string"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </FormField>
                      <div class="flex justify-end gap-2">
                        <DialogClose as-child>
                          <Button type="button" variant="outline">{{
                            $t("common.cancel")
                          }}</Button>
                        </DialogClose>
                        <Button type="submit" :disabled="!editName?.trim()">{{
                          $t("common.save")
                        }}</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </TableHead>
          <template v-if="showStats">
            <SortableTableHead
              sort-key="kills"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
            >
              <span class="xl:hidden">K</span>
              <span class="hidden xl:inline">{{
                $t("common.stats.kills")
              }}</span>
            </SortableTableHead>
            <SortableTableHead
              v-if="overviewVis.assists !== false"
              sort-key="assists"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
            >
              <span class="xl:hidden">A</span>
              <span class="hidden xl:inline">{{
                $t("common.stats.assists")
              }}</span>
            </SortableTableHead>
            <SortableTableHead
              sort-key="deaths"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
            >
              <span class="xl:hidden">D</span>
              <span class="hidden xl:inline">{{
                $t("common.stats.deaths")
              }}</span>
            </SortableTableHead>
            <SortableTableHead
              v-if="overviewVis.kd !== false"
              sort-key="kd"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
              ><StatLabel stat="kd" :label="$t('match.overview.kd')"
            /></SortableTableHead>
            <SortableTableHead
              v-if="overviewVis.hs !== false"
              sort-key="hs"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
              >{{ $t("match.overview.hs") }}</SortableTableHead
            >
            <SortableTableHead
              v-if="overviewVis.survived !== false"
              sort-key="survived"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
            >
              <Tooltip>
                <TooltipTrigger
                  class="inline-flex items-center gap-1 underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] hover:decoration-foreground"
                >
                  {{ $t("match.overview.survived") }}
                </TooltipTrigger>
                <TooltipContent class="max-w-xs">
                  <div
                    class="font-mono text-[0.7rem] font-bold tracking-[0.18em] uppercase text-[hsl(var(--tac-amber))]"
                  >
                    {{ $t("match.overview.tooltips.survived.title") }}
                  </div>
                  <div class="text-xs mt-1 leading-snug">
                    {{ $t("match.overview.tooltips.survived.description") }}
                  </div>
                </TooltipContent>
              </Tooltip>
            </SortableTableHead>
            <SortableTableHead
              v-if="overviewVis.multikills !== false"
              sort-key="multikills"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
            >
              <StatLabel stat="mkr">
                <span class="hidden 2xl:inline">
                  {{ $t("match.overview.multi_kill_rounds") }}
                </span>
                <span class="2xl:hidden">
                  {{ $t("match.overview.mkr") }}
                </span>
              </StatLabel>
            </SortableTableHead>
            <SortableTableHead
              v-if="overviewVis.hltv !== false"
              sort-key="hltv"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
            >
              <Tooltip>
                <TooltipTrigger
                  class="inline-flex items-center gap-1 underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] hover:decoration-foreground"
                >
                  {{ $t("match.overview.hltv") }}
                </TooltipTrigger>
                <TooltipContent class="max-w-xs">
                  <div
                    class="font-mono text-[0.7rem] font-bold tracking-[0.18em] uppercase text-[hsl(var(--tac-amber))]"
                  >
                    {{ $t("match.overview.tooltips.hltv.title") }}
                  </div>
                  <div class="text-xs mt-1 leading-snug">
                    {{ $t("match.overview.tooltips.hltv.description") }}
                  </div>
                </TooltipContent>
              </Tooltip>
            </SortableTableHead>
            <SortableTableHead
              v-if="overviewVis.kast !== false"
              sort-key="kast"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
            >
              <Tooltip>
                <TooltipTrigger
                  class="inline-flex items-center gap-1 underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] hover:decoration-foreground"
                >
                  {{ $t("match.overview.kast") }}
                </TooltipTrigger>
                <TooltipContent class="max-w-xs">
                  <div
                    class="font-mono text-[0.7rem] font-bold tracking-[0.18em] uppercase text-[hsl(var(--tac-amber))]"
                  >
                    {{ $t("match.overview.tooltips.kast.title") }}
                  </div>
                  <div class="text-xs mt-1 leading-snug">
                    {{ $t("match.overview.tooltips.kast.description") }}
                  </div>
                </TooltipContent>
              </Tooltip>
            </SortableTableHead>
            <SortableTableHead
              sort-key="damage"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
            >
              <StatLabel stat="adr">
                <span class="md:hidden">ADR</span>
                <span class="hidden md:inline">{{
                  $t("match.overview.total_damage")
                }}</span>
              </StatLabel>
            </SortableTableHead>
            <SortableTableHead
              v-if="overviewVis.team_damage"
              sort-key="team_damage"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
              >{{ $t("match.overview.team_damage") }}</SortableTableHead
            >
            <SortableTableHead
              v-if="overviewVis.knife_kills"
              sort-key="knife_kills"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
              >{{ $t("match.overview.knifes") }}</SortableTableHead
            >
            <SortableTableHead
              v-if="overviewVis.zeus_kills"
              sort-key="zeus_kills"
              :active-key="sortKey"
              :direction="sortDir"
              :disabled="sortDisabled"
              class="whitespace-nowrap"
              @sort="toggle"
              >{{ $t("match.overview.zeus") }}</SortableTableHead
            >
          </template>
        </TableRow>
      </TableHeader>
      <TableBody>
        <LineupOverviewRow
          :match="match"
          :member="member"
          :lineup="lp"
          :show-stats="showStats"
          :hide-member="hideMember"
          :match-side="matchSide"
          v-for="member of sortRows(lp.lineup_players, buildSortGetters(match))"
        ></LineupOverviewRow>
        <TableRow
          v-for="slot of Math.max(
            0,
            match.max_players_per_lineup - lp.lineup_players.length,
          )"
          v-if="canViewEmptySlots && !hideMember"
          class="group"
        >
          <TableCell
            v-if="!hideMember"
            class="w-[110px] md:w-[220px] sticky left-0 z-10 border-r border-border bg-card [transform:translateZ(0)] shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]"
          >
            <AssignPlayerToLineup
              v-if="canAddToLineupFor(lp)"
              :lineup="lp"
              :exclude="excludePlayers"
              :match-id="match.id"
            >
              <button
                type="button"
                class="flex items-center gap-2 w-full text-left text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0"
              >
                <span
                  class="inline-flex h-7 w-7 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-sm border border-dashed border-border/70 text-muted-foreground group-hover:border-[hsl(var(--tac-amber)/0.6)] group-hover:text-[hsl(var(--tac-amber))]"
                  >+</span
                >
                <span class="truncate">
                  {{
                    $t("match.overview.slot", {
                      number: slot + lp.lineup_players.length,
                    })
                  }}<template
                    v-if="
                      slot + lp.lineup_players.length >
                      match.min_players_per_lineup
                    "
                  >
                    {{ $t("match.overview.substitute") }}</template
                  >
                </span>
              </button>
            </AssignPlayerToLineup>
            <div
              v-else
              class="flex items-center gap-2 text-xs md:text-sm text-muted-foreground min-w-0"
            >
              <span
                class="inline-flex h-7 w-7 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-sm border border-dashed border-border/60 opacity-60"
                >·</span
              >
              <span class="truncate">
                {{
                  $t("match.overview.slot", {
                    number: slot + lp.lineup_players.length,
                  })
                }}<template
                  v-if="
                    slot + lp.lineup_players.length >
                    match.min_players_per_lineup
                  "
                >
                  {{ $t("match.overview.substitute") }}</template
                >
              </span>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </template>
  </Table>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";

export default {
  emits: ["joined"],
  props: {
    match: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
    combineWith: {
      type: Object,
      default: null,
    },
    showStats: {
      type: Boolean,
      default: true,
    },
    // When true, drops the leftmost "Player" column (header + body
    // cell). Useful when the table is already scoped to a single
    // player (e.g. analysis zone on the player page) so the column
    // would just duplicate context.
    hideMember: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            team_name: z.string(),
          }),
        ),
      }),
      editingLineupId: null as string | null,
      editName: "" as string,
    };
  },
  computed: {
    lineupsToRender(): any[] {
      return this.combineWith ? [this.lineup, this.combineWith] : [this.lineup];
    },
    // Sort UI is meaningless when there's only one row (player page).
    sortDisabled() {
      const total = this.lineupsToRender.reduce(
        (sum, lp) => sum + (lp?.lineup_players?.length ?? 0),
        0,
      );
      return total <= 1;
    },
    canViewEmptySlots() {
      return ![
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
      ].includes(this.match.status);
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
  methods: {
    async updateLineupName(lineup_id: string, name: string) {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          update_match_lineups_by_pk: [
            {
              pk_columns: { id: lineup_id },
              _set: { team_name: $("name", "String!") },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          name,
        },
      });
    },
    canAddToLineupFor(lp: any): boolean {
      return lp.can_update_lineup && lp.lineup_players.length < this.maxPlayers;
    },
    canEditTeamName(lp: any): boolean {
      if (!lp?.can_update_lineup) return false;
      return [
        e_match_status_enum.Scheduled,
        e_match_status_enum.PickingPlayers,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.WaitingForServer,
        e_match_status_enum.Veto,
      ].includes(this.match.status);
    },
    prepareEditName(lp: any) {
      this.editName = lp?.name ?? "";
    },
    async saveTeamName(lp: any) {
      const newName = this.editName?.trim();
      if (!newName) {
        return;
      }
      await this.updateLineupName(lp.id, newName);
      this.editingLineupId = null;
      this.$emit("joined");
    },
  },
};
</script>
