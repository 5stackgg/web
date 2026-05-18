<script setup lang="ts">
import LineupOverviewRow from "~/components/match/LineupOverviewRow.vue";
import SortableTableHead from "~/components/ui/SortableTableHead.vue";
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
    member?.player?.match_map_stats ?? member?.player?.match_stats ?? null;
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

// Per-row KAST/Survived/HLTV computation duplicates LineupOverviewRow's
// logic (since the row component computes them lazily and isn't easy to
// query from the parent for sorting). Match is read off the v-for scope
// via a closure passed into sortGetters at template time.
function kastFor(match: any, member: any): { kast: number; survived: number } {
  let total = 0;
  let participated = 0;
  let survived = 0;
  const steamId = String(member?.steam_id);
  const maps = match?.match_maps ?? [];
  for (const map of maps) {
    const rounds = map?.rounds;
    if (!Array.isArray(rounds)) continue;
    for (const round of rounds) {
      if (round.round === 0) continue;
      total++;
      const kills = round.kills || [];
      const assists = round.assists || [];
      const myDeath = kills.find(
        (k: any) => String(k.attacked_player?.steam_id) === steamId,
      );
      const gotKill = kills.some(
        (k: any) =>
          String(k.player?.steam_id) === steamId &&
          String(k.attacked_player?.steam_id) !== steamId,
      );
      const gotAssist = assists.some(
        (a: any) => String(a.attacker_steam_id) === steamId,
      );
      const didSurvive = !myDeath;
      if (didSurvive) survived++;
      let traded = false;
      if (myDeath) {
        const killerId = String(myDeath.player?.steam_id || "");
        if (killerId) {
          const idx = kills.indexOf(myDeath);
          traded = kills.some(
            (k: any, i: number) =>
              i > idx &&
              String(k.attacked_player?.steam_id) === killerId &&
              String(k.player?.steam_id) !== steamId,
          );
        }
      }
      if (gotKill || gotAssist || didSurvive || traded) participated++;
    }
  }
  return { kast: total ? participated / total : 0, survived };
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
    0.0073 * (kast * 100) +
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
import { e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";
import PlayerDisplay from "../PlayerDisplay.vue";
import { PencilIcon } from "lucide-vue-next";
import { useOverviewColumns } from "~/composables/useMatchTableColumns";

const { visibility: overviewVis } = useOverviewColumns();
import JoinLineupForm from "~/components/match/JoinLineupForm.vue";
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
  <Table class="min-w-[480px]">
    <TableHeader>
      <TableRow>
        <TableHead
          v-if="!hideMember"
          class="w-[220px] text-left sticky left-0 z-20 bg-card border-r border-border shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]"
        >
          <div class="flex items-center gap-4">
            <div
              v-if="match.status === e_match_status_enum.WaitingForCheckIn"
              class="relative inline-flex"
            >
              <span
                class="absolute inline-flex h-2 w-2 rounded-full animate-ping"
                :class="{
                  'bg-red-600': !lineup.is_ready,
                  'bg-green-600': lineup.is_ready,
                }"
              ></span>
              <span
                class="relative inline-flex h-2 w-2 rounded-full"
                :class="{
                  'bg-red-600': !lineup.is_ready,
                  'bg-green-600': lineup.is_ready,
                }"
              ></span>
            </div>
            <span class="truncate">{{ lineup.name }}</span>
            <div class="w-6 h-6 flex-shrink-0">
              <Dialog
                v-if="lineup.can_update_lineup"
                v-model:open="editModalOpen"
              >
                <DialogTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6"
                    @click="prepareEditName()"
                  >
                    <PencilIcon class="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>{{
                    $t("match.overview.update_team_name")
                  }}</DialogTitle>
                  <form @submit.prevent="saveTeamName" class="space-y-4 pt-2">
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
            class="w-10 md:w-[4ch] text-center whitespace-nowrap"
            @sort="toggle"
          >
            <span class="xl:hidden">K</span>
            <span class="hidden xl:inline">{{ $t("common.stats.kills") }}</span>
          </SortableTableHead>
          <SortableTableHead
            v-if="overviewVis.assists !== false"
            sort-key="assists"
            :active-key="sortKey"
            :direction="sortDir"
            :disabled="sortDisabled"
            class="hidden md:table-cell w-10 md:w-[4ch] text-center whitespace-nowrap"
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
            class="w-10 md:w-[4ch] text-center whitespace-nowrap"
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
            class="hidden md:table-cell w-12 md:w-[16ch] text-center whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.overview.kd") }}</SortableTableHead
          >
          <SortableTableHead
            v-if="overviewVis.hs !== false"
            sort-key="hs"
            :active-key="sortKey"
            :direction="sortDir"
            :disabled="sortDisabled"
            class="hidden lg:table-cell w-[4ch] text-center whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.overview.hs") }}</SortableTableHead
          >
          <SortableTableHead
            v-if="overviewVis.survived !== false"
            sort-key="survived"
            :active-key="sortKey"
            :direction="sortDir"
            :disabled="sortDisabled"
            class="hidden xl:table-cell w-[6ch] text-center whitespace-nowrap"
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
            class="hidden xl:table-cell w-[30ch] text-center whitespace-nowrap"
            @sort="toggle"
          >
            <span class="hidden 2xl:inline">
              {{ $t("match.overview.multi_kill_rounds") }}
            </span>
            <span class="2xl:hidden"> {{ $t("match.overview.mkr") }} </span>
          </SortableTableHead>
          <SortableTableHead
            v-if="overviewVis.hltv !== false"
            sort-key="hltv"
            :active-key="sortKey"
            :direction="sortDir"
            :disabled="sortDisabled"
            class="hidden md:table-cell w-[6ch] text-center whitespace-nowrap"
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
            class="hidden lg:table-cell w-[6ch] text-center whitespace-nowrap"
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
            class="text-center w-20 md:w-[24ch] whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.overview.total_damage") }}</SortableTableHead
          >
          <SortableTableHead
            v-if="overviewVis.team_damage"
            sort-key="team_damage"
            :active-key="sortKey"
            :direction="sortDir"
            :disabled="sortDisabled"
            class="w-[16ch] text-center whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.overview.team_damage") }}</SortableTableHead
          >
          <SortableTableHead
            v-if="overviewVis.knife_kills"
            sort-key="knife_kills"
            :active-key="sortKey"
            :direction="sortDir"
            :disabled="sortDisabled"
            class="w-[4ch] text-center whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.overview.knifes") }}</SortableTableHead
          >
          <SortableTableHead
            v-if="overviewVis.zeus_kills"
            sort-key="zeus_kills"
            :active-key="sortKey"
            :direction="sortDir"
            :disabled="sortDisabled"
            class="w-[4ch] text-center whitespace-nowrap"
            @sort="toggle"
            >{{ $t("match.overview.zeus") }}</SortableTableHead
          >
          <TableHead v-if="lineup.can_update_lineup"> </TableHead>
        </template>
      </TableRow>
    </TableHeader>
    <TableBody>
      <LineupOverviewRow
        :match="match"
        :member="member"
        :lineup="lineup"
        :show-stats="showStats"
        :hide-member="hideMember"
        :match-side="matchSide"
        v-for="member of sortRows(
          lineup.lineup_players,
          buildSortGetters(match),
        )"
      ></LineupOverviewRow>
      <TableRow
        v-for="slot of Math.max(
          0,
          match.max_players_per_lineup - lineup.lineup_players.length,
        )"
        v-if="canViewEmptySlots"
      >
        <TableCell colspan="100%">
          <div class="flex gap-4">
            <PlayerDisplay
              :show-flag="false"
              :show-role="false"
              :player="{
                name: `${$t('match.overview.slot', { number: slot + lineup.lineup_players.length })} ${slot + lineup.lineup_players.length > match.min_players_per_lineup ? $t('match.overview.substitute') : ''}`,
              }"
            />
            <div v-if="slot === 1" class="flex gap-4">
              <template v-if="canAddToLineup">
                <AssignPlayerToLineup
                  :lineup="lineup"
                  :exclude="excludePlayers"
                  :match-id="match.id"
                ></AssignPlayerToLineup>
              </template>
              <template
                v-if="
                  (match.options.lobby_access === e_lobby_access_enum.Open ||
                    match.options.lobby_access ===
                      e_lobby_access_enum.Invite) &&
                  !match.is_in_lineup &&
                  match.status === e_match_status_enum.PickingPlayers
                "
              >
                <JoinLineupForm
                  :match="match"
                  :lineup="lineup"
                  @joined="$emit('joined')"
                ></JoinLineupForm>
              </template>
            </div>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
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
      editModalOpen: false as boolean,
      editName: "" as string,
    };
  },
  computed: {
    // Sort UI is meaningless when there's only one row (player page).
    sortDisabled() {
      return (this.lineup?.lineup_players?.length ?? 0) <= 1;
    },
    canAddToLineup() {
      return (
        this.lineup.can_update_lineup &&
        this.lineup.lineup_players.length < this.maxPlayers
      );
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
    prepareEditName() {
      this.editName = this.lineup?.name ?? "";
    },
    async saveTeamName() {
      const newName = this.editName?.trim();
      if (!newName) {
        return;
      }
      await this.updateLineupName(this.lineup.id, newName);
      this.editModalOpen = false;
      this.$emit("joined");
    },
  },
};
</script>
