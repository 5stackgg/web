<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import LineupMember from "~/components/match/LineupMember.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import StatChevron from "~/components/StatChevron.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import { useTableSort } from "~/composables/useTableSort";
import { type StatTierConfig } from "~/utils/statTiers";
import { useUtilityColumns } from "~/composables/useMatchTableColumns";
import { useCurrentUserRow } from "~/composables/useCurrentUserRow";

const props = withDefaults(
  defineProps<{
    match: any;
    lineup: any;
    combineWith?: any;
    hideMember?: boolean;
    // One player as a vertical label/value list (mobile profile expand).
    stacked?: boolean;
  }>(),
  { combineWith: null, hideMember: false, stacked: false },
);

const { t } = useI18n();
const { visibility: utilityVis } = useUtilityColumns();
const { rowClass, stickyCellClass } = useCurrentUserRow();
const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>();

// Raw counts per player. Every rate is computed from these, so the team row
// sums them and gets the team's real rate (total over total), not an average
// of averages.
type Totals = {
  flashes: number;
  enemiesFlashed: number;
  teamFlashed: number;
  flashAssists: number;
  blindSum: number;
  blindHits: number;
  smokes: number;
  hes: number;
  heDamage: number;
  heTeamDamage: number;
  molotovs: number;
  molotovDamage: number;
  unusedSum: number;
  unusedCount: number;
  wastedShots: number;
  shotsFired: number;
};

function n(value: unknown): number {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
}

function totalsFor(member: any): Totals | null {
  const arr =
    member?.player?.match_stats ?? member?.player?.match_map_stats ?? null;
  const s = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  if (!s) return null;
  const enemiesFlashed = n(s.enemies_flashed);
  const exactBlind = s.flash_duration_count != null;
  return {
    flashes: n(s.flashes_thrown),
    enemiesFlashed,
    teamFlashed: n(s.team_flashed),
    flashAssists: n(s.flash_assists),
    blindSum: exactBlind
      ? n(s.flash_duration_sum)
      : n(s.avg_flash_duration) * enemiesFlashed,
    blindHits: exactBlind ? n(s.flash_duration_count) : enemiesFlashed,
    smokes: n(s.smoke_throws),
    hes: n(s.he_throws),
    heDamage: n(s.he_damage),
    heTeamDamage: n(s.he_team_damage),
    molotovs: n(s.molotov_throws),
    molotovDamage: n(s.molotov_damage),
    unusedSum:
      s.utility_on_death != null
        ? n(s.utility_on_death)
        : n(s.util_on_death_count)
          ? n(s.util_on_death_sum) / n(s.util_on_death_count)
          : 0,
    unusedCount: 1,
    wastedShots: n(s.wasted_magazine_shots),
    shotsFired: n(s.shots_fired),
  };
}

function sumTotals(list: Array<Totals | null>): Totals | null {
  const present = list.filter((x): x is Totals => x !== null);
  if (present.length === 0) return null;
  const out = { ...present[0] };
  for (const x of present.slice(1)) {
    for (const key of Object.keys(out) as Array<keyof Totals>) {
      out[key] += x[key];
    }
  }
  return out;
}

// No throws means nothing to grade: a dash, never a 0 with a chevron.
function per(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

type Column = {
  key: string;
  stat: string;
  label: string;
  sub?: string;
  value: (x: Totals) => number | null;
  format: (v: number) => string;
  tier?: StatTierConfig;
  // A throw count: the team row adds its share of the team's utility.
  count?: boolean;
};

const int = (v: number) => String(Math.round(v));
const fixed = (digits: number) => (v: number) => v.toFixed(digits);
const pct = (v: number) => `${Math.round(v)}%`;

const groups = computed(() => {
  const u = (key: string) => t(`match.lineup.utility.${key}`);
  const all: Array<{
    key: string;
    label: string;
    icon?: string;
    columns: Column[];
  }> = [
    {
      key: "flash",
      label: t("match.lineup.stats.utility_summary_flashes"),
      icon: "/img/equipment/flashbang.svg",
      columns: [
        {
          key: "flashes_thrown",
          stat: "flashes_thrown",
          label: u("thrown"),
          value: (x) => x.flashes,
          format: int,
          count: true,
        },
        {
          key: "enemies_flashed",
          stat: "enemies_flashed_per",
          label: u("blinded"),
          sub: u("per_flash"),
          value: (x) => per(x.enemiesFlashed, x.flashes),
          format: fixed(2),
          tier: { dir: "high", cuts: [0.9, 0.6, 0.35, 0.2] },
        },
        {
          key: "team_flashed",
          stat: "team_flashed_per",
          label: u("teammates"),
          sub: u("per_flash"),
          value: (x) => per(x.teamFlashed, x.flashes),
          format: fixed(2),
          tier: { dir: "low", cuts: [0.15, 0.25, 0.4, 0.5] },
        },
        {
          key: "avg_blind_time",
          stat: "avg_flash_duration",
          label: u("blind"),
          sub: u("avg"),
          value: (x) => per(x.blindSum, x.blindHits),
          format: (v) =>
            t("match.lineup.utility.seconds", { count: v.toFixed(1) }),
          tier: { dir: "high", cuts: [2.2, 1.5, 0.8, 0.5] },
        },
        {
          key: "flash_assists",
          stat: "flash_assist_pct",
          label: u("assists"),
          sub: u("of_flashes"),
          value: (x) => {
            const r = per(x.flashAssists, x.flashes);
            return r === null ? null : r * 100;
          },
          format: pct,
          tier: { dir: "high", cuts: [12, 7, 3, 1] },
        },
      ],
    },
    {
      key: "smoke",
      label: t("match.lineup.stats.utility_summary_smokes"),
      icon: "/img/equipment/smokegrenade.svg",
      columns: [
        {
          key: "smoke_throws",
          stat: "smokes_thrown",
          label: u("thrown"),
          value: (x) => x.smokes,
          format: int,
          count: true,
        },
      ],
    },
    {
      key: "he",
      label: t("match.lineup.stats.utility_summary_hes"),
      icon: "/img/equipment/hegrenade.svg",
      columns: [
        {
          key: "he_throws",
          stat: "he_throws",
          label: u("thrown"),
          value: (x) => x.hes,
          format: int,
          count: true,
        },
        {
          key: "he_damage",
          stat: "he_damage_per",
          label: u("damage"),
          sub: u("per_nade"),
          value: (x) => per(x.heDamage, x.hes),
          format: fixed(1),
          tier: { dir: "high", cuts: [14, 9, 4, 2] },
        },
        {
          key: "he_team_damage",
          stat: "he_team_damage_per",
          label: u("team_damage"),
          sub: u("per_nade"),
          value: (x) => per(x.heTeamDamage, x.hes),
          format: fixed(1),
          tier: { dir: "low", cuts: [0.3, 1, 3, 5] },
        },
      ],
    },
    {
      key: "fire",
      label: t("match.lineup.stats.utility_summary_molotovs"),
      icon: "/img/equipment/molotov.svg",
      columns: [
        {
          key: "molotov_throws",
          stat: "molotov_throws",
          label: u("thrown"),
          value: (x) => x.molotovs,
          format: int,
          count: true,
        },
        {
          key: "molotov_damage",
          stat: "molotov_damage_per",
          label: u("damage"),
          sub: u("per_nade"),
          value: (x) => per(x.molotovDamage, x.molotovs),
          format: fixed(1),
          tier: { dir: "high", cuts: [14, 9, 4, 2] },
        },
      ],
    },
    {
      key: "waste",
      label: u("waste"),
      columns: [
        {
          key: "unused_utility",
          stat: "unused_utility",
          label: u("unused"),
          sub: u("on_death"),
          value: (x) => per(x.unusedSum, x.unusedCount),
          format: (v) => `$${Math.round(v)}`,
          tier: { dir: "low", cuts: [150, 250, 350, 450] },
        },
        {
          key: "wasted_magazine_pct",
          stat: "wasted_magazine_pct",
          label: u("mag_left"),
          sub: u("at_reload"),
          value: (x) => {
            const r = per(x.wastedShots, x.shotsFired + x.wastedShots);
            return r === null ? null : r * 100;
          },
          format: pct,
          tier: { dir: "low", cuts: [8, 15, 22, 30] },
        },
      ],
    },
  ];
  return all
    .map((group) => ({
      ...group,
      columns: group.columns.filter(
        (c) => c.key === "flashes_thrown" || utilityVis.value[c.key] !== false,
      ),
    }))
    .filter((group) => group.columns.length > 0);
});

const columnCount = computed(() =>
  groups.value.reduce((count, group) => count + group.columns.length, 0),
);

type Row = { member: any; totals: Totals | null };

const sections = computed(() =>
  (props.combineWith ? [props.lineup, props.combineWith] : [props.lineup])
    .filter(Boolean)
    .map((lineup) => {
      const rows: Row[] = (lineup.lineup_players ?? []).map((member: any) => ({
        member,
        totals: totalsFor(member),
      }));
      const team = sumTotals(rows.map((r) => r.totals));
      return {
        lineup,
        rows,
        team,
        thrown: team
          ? team.flashes + team.smokes + team.hes + team.molotovs
          : 0,
      };
    }),
);

function valueOf(col: Column, totals: Totals | null): number | null {
  return totals ? col.value(totals) : null;
}

// Lower-is-better columns sort inverted, so the first (desc) click puts the
// best player on top for every column.
const sortGetters = computed(() => {
  const getters: Record<string, (row: Row) => number | null> = {};
  for (const group of groups.value) {
    for (const col of group.columns) {
      getters[col.key] = (row) => {
        const v = valueOf(col, row.totals);
        return v === null ? null : col.tier?.dir === "low" ? -v : v;
      };
    }
  }
  return getters;
});

function share(value: number | null, thrown: number): string | null {
  return value === null || thrown === 0
    ? null
    : `${Math.round((value / thrown) * 100)}%`;
}

const stickyHead =
  "w-[110px] md:w-[220px] text-left whitespace-nowrap sticky left-0 z-20 bg-card border-r border-border shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)] [transform:translateZ(0)]";
const stickyCell =
  "w-[110px] md:w-[220px] sticky left-0 z-10 border-r border-border [transform:translateZ(0)]";
const stickyShadow = "shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]";
const subClass =
  "font-mono text-[0.56rem] font-normal uppercase tracking-[0.12em] text-muted-foreground/60";
const valueGrid =
  "inline-grid grid-cols-[auto_0.875rem] items-center justify-end gap-0.5 tabular-nums";
</script>

<template>
  <div v-if="stacked">
    <template v-for="section of sections" :key="section.lineup.id">
      <div
        v-for="(row, index) of section.rows"
        :key="row.member.steam_id ?? index"
      >
        <div v-for="group of groups" :key="group.key">
          <div
            class="flex items-center gap-1.5 px-3 pb-1 pt-3 font-mono text-[0.56rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"
          >
            <NuxtImg
              v-if="group.icon"
              :src="group.icon"
              alt=""
              class="h-3 w-3 opacity-70"
              aria-hidden="true"
            />
            {{ group.label }}
          </div>
          <div
            v-for="col of group.columns"
            :key="col.key"
            class="flex h-8 items-center justify-between gap-3 border-t border-border/40 px-3 text-sm"
          >
            <span class="inline-flex min-w-0 items-baseline gap-1.5">
              <span class="text-muted-foreground"
                ><StatLabel :stat="col.stat" :label="col.label"
              /></span>
              <span v-if="col.sub" :class="subClass">{{ col.sub }}</span>
            </span>
            <span :class="valueGrid">
              <AnimatedStat
                v-if="valueOf(col, row.totals) !== null"
                :value="col.format(valueOf(col, row.totals) as number)"
              />
              <span v-else class="text-muted-foreground/60">—</span>
              <StatChevron :cfg="col.tier" :value="valueOf(col, row.totals)" />
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>

  <Table
    v-else
    class="min-w-full w-max [&_td]:whitespace-nowrap [&_th]:px-2.5 [&_td]:px-2.5"
  >
    <TableHeader class="bg-muted/20">
      <TableRow class="border-b-0 hover:bg-transparent">
        <TableHead v-if="!hideMember" :class="[stickyHead, 'h-8']" />
        <TableHead
          v-for="group of groups"
          :key="group.key"
          :colspan="group.columns.length"
          class="h-8 border-l border-border pt-2 align-bottom"
        >
          <span
            class="inline-flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em]"
          >
            <NuxtImg
              v-if="group.icon"
              :src="group.icon"
              alt=""
              class="h-3.5 w-3.5 opacity-75"
              aria-hidden="true"
            />
            {{ group.label }}
          </span>
        </TableHead>
      </TableRow>
    </TableHeader>

    <TableBody
      v-for="(section, sectionIndex) of sections"
      :key="section.lineup.id"
    >
      <!-- Each team's bar carries the column labels, so the second team
           never has to look back up to the top header. -->
      <TableRow
        :class="[
          'bg-muted/20 hover:bg-muted/20',
          sectionIndex > 0 && 'border-t-[3px] border-border/80',
        ]"
      >
        <TableHead v-if="!hideMember" :class="[stickyHead, 'h-12']">
          <span
            class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{ section.lineup.name }}
          </span>
        </TableHead>
        <template v-for="group of groups" :key="group.key">
          <SortableTableHead
            v-for="(col, index) of group.columns"
            :key="col.key"
            :sort-key="col.key"
            :active-key="sortKey"
            :direction="sortDir"
            :class="[
              'h-12 whitespace-nowrap pb-2 text-right align-bottom',
              index === 0 && 'border-l border-border',
            ]"
            @sort="toggle"
          >
            <span class="inline-flex flex-col items-end leading-tight">
              <span class="inline-flex items-center gap-1">
                <NuxtImg
                  v-if="col.count && group.icon"
                  :src="group.icon"
                  alt=""
                  class="h-3 w-3 opacity-60"
                  aria-hidden="true"
                />
                <StatLabel :stat="col.stat" :label="col.label" />
              </span>
              <span :class="subClass">{{ col.sub ?? "\u00a0" }}</span>
            </span>
          </SortableTableHead>
        </template>
      </TableRow>

      <TableRow
        v-for="(row, index) of sortRows(section.rows, sortGetters)"
        :key="row.member.steam_id ?? index"
        :class="['group', rowClass(row.member)]"
      >
        <TableCell
          v-if="!hideMember"
          :class="[
            stickyCell,
            stickyCellClass(row.member) ||
              `bg-card group-hover:bg-muted ${stickyShadow}`,
          ]"
        >
          <lineup-member
            :member="row.member"
            :match="match"
            :lineup_id="section.lineup.id"
          ></lineup-member>
        </TableCell>
        <template v-for="group of groups" :key="group.key">
          <TableCell
            v-for="(col, index) of group.columns"
            :key="col.key"
            :class="['text-right', index === 0 && 'border-l border-border']"
          >
            <span :class="valueGrid">
              <AnimatedStat
                v-if="valueOf(col, row.totals) !== null"
                :value="col.format(valueOf(col, row.totals) as number)"
              />
              <span v-else class="text-muted-foreground/60">—</span>
              <StatChevron :cfg="col.tier" :value="valueOf(col, row.totals)" />
            </span>
          </TableCell>
        </template>
      </TableRow>

      <TableRow
        v-if="!hideMember && section.team"
        class="border-t border-border bg-muted/30 hover:bg-muted/30"
      >
        <TableCell :class="[stickyCell, stickyShadow, 'bg-card']">
          <span
            class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("match.lineup.utility.team_total") }}
          </span>
        </TableCell>
        <template v-for="group of groups" :key="group.key">
          <TableCell
            v-for="(col, index) of group.columns"
            :key="col.key"
            :class="['text-right', index === 0 && 'border-l border-border']"
          >
            <span :class="valueGrid">
              <span class="inline-flex flex-col items-end leading-tight">
                <span class="font-semibold">{{
                  valueOf(col, section.team) !== null
                    ? col.format(valueOf(col, section.team) as number)
                    : "—"
                }}</span>
                <span
                  v-if="col.count"
                  class="font-mono text-[0.58rem] text-muted-foreground/70"
                  >{{ share(valueOf(col, section.team), section.thrown) }}</span
                >
              </span>
            </span>
          </TableCell>
        </template>
      </TableRow>
    </TableBody>
  </Table>
</template>
