<script lang="ts" setup>
import LineupMember from "~/components/match/LineupMember.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import StatChevron from "~/components/StatChevron.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import TeamUtilitySummary from "~/components/match/TeamUtilitySummary.vue";
import { useTableSort } from "~/composables/useTableSort";
import { type StatTierConfig } from "~/utils/statTiers";
import { useUtilityColumns } from "~/composables/useMatchTableColumns";
import { useCurrentUserRow } from "~/composables/useCurrentUserRow";

const { visibility: utilityVis } = useUtilityColumns();
const { rowClass, stickyCellClass } = useCurrentUserRow();

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>();

function pickStats(member: any) {
  const arr =
    member?.player?.match_stats ?? member?.player?.match_map_stats ?? null;
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

const sortGetters: Record<string, (m: any) => unknown> = {
  flashes_thrown: (m) => pickStats(m)?.flashes_thrown ?? -1,
  flash_assists: (m) => {
    const s = pickStats(m);
    if (!s?.flashes_thrown) return -1;
    return (s.flash_assists ?? 0) / s.flashes_thrown;
  },
  enemies_flashed: (m) => {
    const s = pickStats(m);
    if (!s?.flashes_thrown) return -1;
    return (s.enemies_flashed ?? 0) / s.flashes_thrown;
  },
  // Lower is better for friendly flashes; invert.
  team_flashed: (m) => {
    const s = pickStats(m);
    if (!s?.flashes_thrown) return -1;
    return -((s.team_flashed ?? 0) / s.flashes_thrown);
  },
  avg_blind_time: (m) => {
    const s = pickStats(m);
    if (s?.avg_flash_duration != null) return s.avg_flash_duration;
    if (!s?.flash_duration_count) return -1;
    return (s.flash_duration_sum ?? 0) / s.flash_duration_count;
  },
  he_damage: (m) => {
    const s = pickStats(m);
    if (!s?.he_throws) return -1;
    return (s.he_damage ?? 0) / s.he_throws;
  },
  he_team_damage: (m) => {
    const s = pickStats(m);
    if (!s?.he_throws) return -1;
    return -((s.he_team_damage ?? 0) / s.he_throws);
  },
  molotov_damage: (m) => {
    const s = pickStats(m);
    if (!s?.molotov_throws) return -1;
    return (s.molotov_damage ?? 0) / s.molotov_throws;
  },
  // Lower is better; invert so default desc puts elite (least wasted) first.
  unused_utility: (m) => {
    const s = pickStats(m);
    if (s?.unused_utility_value == null) return -1;
    return -s.unused_utility_value;
  },
  // Lower is better; invert so desc puts the most disciplined first.
  wasted_magazine_pct: (m) => {
    const s = pickStats(m);
    if (!s) return -1;
    const wasted = Number(s.wasted_magazine_shots) || 0;
    const fired = Number(s.shots_fired) || 0;
    const total = fired + wasted;
    if (total === 0) return 0;
    return -((wasted / total) * 100);
  },
};

const TIER_CONFIG: Record<string, StatTierConfig> = {
  enemies_flashed_per: { dir: "high", cuts: [0.9, 0.6, 0.35, 0.2] },
  team_flashed_per: { dir: "low", cuts: [0.15, 0.25, 0.4, 0.5] },
  avg_blind_time: { dir: "high", cuts: [2.2, 1.5, 0.8, 0.5] },
  he_damage_per: { dir: "high", cuts: [14, 9, 4, 2] },
  he_team_damage_per: { dir: "low", cuts: [0.3, 1, 3, 5] },
  molotov_damage_per: { dir: "high", cuts: [14, 9, 4, 2] },
  unused_utility: { dir: "low", cuts: [150, 250, 350, 450] },
  flash_assists_per: { dir: "high", cuts: [12, 7, 3, 1] },
  // Lower is better — fewer shots wasted (reload-before-empty) is elite.
  wasted_magazine_pct: { dir: "low", cuts: [8, 15, 22, 30] },
};
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
            class="w-[110px] md:w-[220px] text-left whitespace-nowrap sticky left-0 z-20 bg-card border-r border-border shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)] [transform:translateZ(0)]"
          >
            {{ lp.name }}
          </TableHead>
          <SortableTableHead
            v-for="col of [
              'flashes_thrown',
              'flash_assists',
              'enemies_flashed',
              'team_flashed',
              'avg_blind_time',
              'he_damage',
              'he_team_damage',
              'molotov_damage',
              'unused_utility',
              'wasted_magazine_pct',
            ].filter((c) => c === 'flashes_thrown' || utilityVis[c] !== false)"
            :key="col"
            :sort-key="col"
            :active-key="sortKey"
            :direction="sortDir"
            class="whitespace-nowrap"
            @sort="toggle"
          >
            {{ $t(`match.lineup.stats.${col}`) }}
          </SortableTableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="!hideMember">
          <TableCell colspan="100" class="bg-muted/10 py-2">
            <TeamUtilitySummary :lineup="lp" />
          </TableCell>
        </TableRow>
        <TableRow
          v-for="member of sortRows(lp.lineup_players, sortGetters)"
          :class="['group', rowClass(member)]"
        >
          <TableCell
            v-if="!hideMember"
            :class="[
              'w-[110px] md:w-[220px] sticky left-0 z-10 border-r border-border [transform:translateZ(0)]',
              stickyCellClass(member) ||
                'bg-card group-hover:bg-muted shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]',
            ]"
          >
            <lineup-member :member="member" :lineup_id="lp.id"></lineup-member>
          </TableCell>
          <TableCell
            ><AnimatedStat :value="statsFor(member)?.flashes_thrown ?? '—'"
          /></TableCell>
          <TableCell v-if="utilityVis.flash_assists !== false">
            <span class="inline-flex items-center gap-0.5">
              <template v-if="flashAssistPct(member) !== null">
                <AnimatedStat :value="flashAssistPct(member) + '%'" />
              </template>
              <template v-else>—</template>
              <StatChevron
                :cfg="TIER_CONFIG.flash_assists_per"
                :value="flashAssistPct(member)"
              />
            </span>
          </TableCell>
          <TableCell v-if="utilityVis.enemies_flashed !== false">
            <span class="inline-flex items-baseline gap-1">
              <template v-if="enemiesFlashedPer(member) !== null">
                <span class="tabular-nums"
                  ><AnimatedStat :value="statsFor(member)?.enemies_flashed ?? 0"
                /></span>
                <span
                  class="tabular-nums text-xs text-muted-foreground leading-none"
                  >(<StatLabel stat="enemies_flashed_per"
                    ><AnimatedStat
                      :value="formatStatValue(String(enemiesFlashedPer(member)))" /></StatLabel
                  >)</span
                >
              </template>
              <template v-else>—</template>
              <StatChevron
                class="self-center"
                :cfg="TIER_CONFIG.enemies_flashed_per"
                :value="enemiesFlashedPer(member)"
              />
            </span>
          </TableCell>
          <TableCell v-if="utilityVis.team_flashed !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  teamFlashedPer(member) !== null
                    ? formatStatValue(String(teamFlashedPer(member)))
                    : '—'
                "
              />
              <StatChevron
                :cfg="TIER_CONFIG.team_flashed_per"
                :value="teamFlashedPer(member)"
              />
            </span>
          </TableCell>
          <TableCell v-if="utilityVis.avg_blind_time !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                v-if="(avgFlashDuration(member) ?? null) !== null"
                :value="
                  formatStatValue(String(avgFlashDuration(member))) +
                  ' ' +
                  $t('match.lineup.stats.seconds')
                "
              />
              <template v-else>—</template>
              <StatChevron
                :cfg="TIER_CONFIG.avg_blind_time"
                :value="avgFlashDuration(member)"
              />
            </span>
          </TableCell>
          <TableCell v-if="utilityVis.he_damage !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  hePer(member) !== null
                    ? formatStatValue(String(hePer(member)))
                    : '—'
                "
              />
              <StatChevron
                :cfg="TIER_CONFIG.he_damage_per"
                :value="hePer(member)"
              />
            </span>
          </TableCell>
          <TableCell v-if="utilityVis.he_team_damage !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  heTeamPer(member) !== null
                    ? formatStatValue(String(heTeamPer(member)))
                    : '—'
                "
              />
              <StatChevron
                :cfg="TIER_CONFIG.he_team_damage_per"
                :value="heTeamPer(member)"
              />
            </span>
          </TableCell>
          <TableCell v-if="utilityVis.molotov_damage !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  molotovPer(member) !== null
                    ? formatStatValue(String(molotovPer(member)))
                    : '—'
                "
              />
              <StatChevron
                :cfg="TIER_CONFIG.molotov_damage_per"
                :value="molotovPer(member)"
              />
            </span>
          </TableCell>
          <TableCell v-if="utilityVis.unused_utility !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  unusedUtility(member) !== null
                    ? '$' + unusedUtility(member)
                    : '—'
                "
              />
              <StatChevron
                :cfg="TIER_CONFIG.unused_utility"
                :value="unusedUtility(member)"
              />
            </span>
          </TableCell>
          <TableCell v-if="utilityVis.wasted_magazine_pct !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  wastedMagazinePct(member) !== null
                    ? wastedMagazinePct(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :cfg="TIER_CONFIG.wasted_magazine_pct"
                :value="wastedMagazinePct(member)"
              />
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </template>
  </Table>
</template>

<script lang="ts">
import formatStatValue from "../../utilities/formatStatValue";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function ratio(
  num: number | null,
  den: number | null,
  decimals = 2,
): number | null {
  if (num === null || den === null || den === 0) return null;
  const r = num / den;
  const mult = 10 ** decimals;
  return Math.round(r * mult) / mult;
}

export default {
  computed: {
    lineupsToRender(): any[] {
      return this.combineWith ? [this.lineup, this.combineWith] : [this.lineup];
    },
  },
  methods: {
    formatStatValue,
    statsFor(member: any) {
      const arr =
        member?.player?.match_stats ?? member?.player?.match_map_stats ?? null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    },
    // If the player has stats for this match, fall back to 0 instead of
    // null so live tables show "0%" / "0" rather than a dash. Only
    // players with no match_stats row at all keep the dash.
    avgFlashDuration(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      const avg = toNumber(s.avg_flash_duration);
      if (avg !== null) return avg;
      const sum = toNumber(s.flash_duration_sum);
      const count = toNumber(s.flash_duration_count);
      if (sum !== null && count) return Math.round((sum / count) * 100) / 100;
      return 0;
    },
    enemiesFlashedPer(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return (
        ratio(toNumber(s.enemies_flashed), toNumber(s.flashes_thrown)) ?? 0
      );
    },
    teamFlashedPer(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return ratio(toNumber(s.team_flashed), toNumber(s.flashes_thrown)) ?? 0;
    },
    flashAssistPct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      const assists = toNumber(s.flash_assists);
      const thrown = toNumber(s.flashes_thrown);
      if (!thrown) return 0;
      return Math.round(((assists ?? 0) / thrown) * 100);
    },
    hePer(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return ratio(toNumber(s.he_damage), toNumber(s.he_throws)) ?? 0;
    },
    heTeamPer(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return ratio(toNumber(s.he_team_damage), toNumber(s.he_throws)) ?? 0;
    },
    molotovPer(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return ratio(toNumber(s.molotov_damage), toNumber(s.molotov_throws)) ?? 0;
    },
    unusedUtility(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return toNumber(s.unused_utility_value) ?? 0;
    },
    wastedMagazinePct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      const wasted = toNumber(s.wasted_magazine_shots) ?? 0;
      const fired = toNumber(s.shots_fired) ?? 0;
      const total = fired + wasted;
      if (total === 0) return 0;
      return Math.round((wasted / total) * 100);
    },
  },
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
    hideMember: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
