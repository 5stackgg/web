<script lang="ts" setup>
import { computed } from "vue";
import LineupMember from "~/components/match/LineupMember.vue";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import StatChevron from "~/components/StatChevron.vue";
import { useTableSort } from "~/composables/useTableSort";
import { useAimColumns } from "~/composables/useMatchTableColumns";
import { useCurrentUserRow } from "~/composables/useCurrentUserRow";

const { visibility: aimVis } = useAimColumns();
const { rowClass, stickyCellClass } = useCurrentUserRow();

const allAimColumns: Array<{ label: string; tooltipKey: string }> = [
  { label: "accuracy", tooltipKey: "accuracy" },
  { label: "accuracy_spotted", tooltipKey: "accuracy_spotted" },
  { label: "rifle_accuracy", tooltipKey: "rifle_accuracy" },
  { label: "pistol_accuracy", tooltipKey: "pistol_accuracy" },
  { label: "sniper_accuracy", tooltipKey: "sniper_accuracy" },
  { label: "head_accuracy", tooltipKey: "head_accuracy" },
  { label: "hs_kill_pct", tooltipKey: "hs_kill_pct" },
  { label: "spray_accuracy", tooltipKey: "spray_accuracy" },
  { label: "time_to_damage", tooltipKey: "time_to_damage" },
  { label: "spotted_acc", tooltipKey: "spotted_acc" },
  { label: "crosshair_placement", tooltipKey: "crosshair_placement" },
  { label: "counter_strafing", tooltipKey: "counter_strafing" },
  { label: "first_bullet_accuracy", tooltipKey: "first_bullet_accuracy" },
  { label: "tracking", tooltipKey: "tracking" },
];

const aimColumns = computed(() =>
  allAimColumns.filter(
    (c) => c.label === "accuracy" || aimVis.value[c.label] !== false,
  ),
);

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>();
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
            v-for="col of aimColumns"
            :key="col.label"
            :sort-key="col.label"
            :active-key="sortKey"
            :direction="sortDir"
            class="whitespace-nowrap"
            @sort="toggle"
          >
            <Tooltip>
              <TooltipTrigger
                class="inline-flex items-center gap-1 underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] hover:decoration-foreground"
              >
                {{ $t(`match.lineup.stats.${col.label}`) }}
              </TooltipTrigger>
              <TooltipContent class="max-w-sm space-y-3">
                <div>
                  <div
                    class="font-mono text-[0.7rem] font-bold tracking-[0.18em] uppercase text-[hsl(var(--tac-amber))]"
                  >
                    {{
                      $t(`match.lineup.stats.tooltips.${col.tooltipKey}.title`)
                    }}
                  </div>
                  <div class="text-xs mt-1 leading-snug text-foreground/90">
                    {{
                      $t(
                        `match.lineup.stats.tooltips.${col.tooltipKey}.description`,
                      )
                    }}
                  </div>
                </div>
                <div class="pt-2 border-t border-border/60">
                  <div
                    class="font-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-muted-foreground"
                  >
                    {{ $t("match.lineup.stats.calc_header") }}
                  </div>
                  <div class="text-xs mt-1 leading-snug text-foreground/80">
                    {{
                      $t(
                        `match.lineup.stats.tooltips.${col.tooltipKey}.calculation`,
                      )
                    }}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </SortableTableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
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
          <TableCell>
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  accuracyPct(member) !== null ? accuracyPct(member) + '%' : '—'
                "
              />
              <StatChevron
                :level="tierLevel('accuracy', accuracyPct(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.accuracy_spotted !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  accuracySpottedPct(member) !== null
                    ? accuracySpottedPct(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :level="
                  tierLevel('accuracy_spotted', accuracySpottedPct(member))
                "
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.rifle_accuracy !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  rifleAccuracy(member) !== null
                    ? rifleAccuracy(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :level="tierLevel('rifle_accuracy', rifleAccuracy(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.pistol_accuracy !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  pistolAccuracy(member) !== null
                    ? pistolAccuracy(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :level="tierLevel('pistol_accuracy', pistolAccuracy(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.sniper_accuracy !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  sniperAccuracy(member) !== null
                    ? sniperAccuracy(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :level="tierLevel('sniper_accuracy', sniperAccuracy(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.head_accuracy !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  headAccuracyPct(member) !== null
                    ? headAccuracyPct(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :level="tierLevel('head_accuracy', headAccuracyPct(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.hs_kill_pct !== false">
            <AnimatedStat
              :value="
                hsKillPct(member) !== null ? hsKillPct(member) + '%' : '—'
              "
            />
          </TableCell>
          <TableCell v-if="aimVis.spray_accuracy !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  sprayAccuracyPct(member) !== null
                    ? sprayAccuracyPct(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :level="tierLevel('spray_accuracy', sprayAccuracyPct(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.time_to_damage !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="ttdMs(member) !== null ? ttdMs(member) + ' ms' : '—'"
              />
              <StatChevron
                :level="tierLevel('time_to_damage', ttdMs(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.spotted_acc !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  spottedAcc(member) !== null ? spottedAcc(member) + '%' : '—'
                "
              />
              <StatChevron
                :level="tierLevel('spotted_acc', spottedAcc(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.crosshair_placement !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  crosshairPlacement(member) !== null
                    ? crosshairPlacement(member) + '°'
                    : '—'
                "
              />
              <StatChevron
                :level="
                  tierLevel('crosshair_placement', crosshairPlacement(member))
                "
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.counter_strafing !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  counterStrafePct(member) !== null
                    ? counterStrafePct(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :level="tierLevel('counter_strafing', counterStrafePct(member))"
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.first_bullet_accuracy !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  firstBulletAccuracy(member) !== null
                    ? firstBulletAccuracy(member) + '%'
                    : '—'
                "
              />
              <StatChevron
                :level="
                  tierLevel(
                    'first_bullet_accuracy',
                    firstBulletAccuracy(member),
                  )
                "
              />
            </span>
          </TableCell>
          <TableCell v-if="aimVis.tracking !== false">
            <span class="inline-flex items-center gap-0.5">
              <AnimatedStat
                :value="
                  trackingPct(member) !== null ? trackingPct(member) + '%' : '—'
                "
              />
              <StatChevron
                :level="tierLevel('tracking', trackingPct(member))"
              />
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </template>
  </Table>
</template>

<script lang="ts">
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return Math.round((num / den) * 100);
}

import {
  statLevelFor,
  type StatLevel,
  type StatTierConfig,
} from "~/utils/statTiers";

const TIER_CONFIG: Record<string, StatTierConfig> = {
  accuracy: { dir: "high", cuts: [24, 19, 15, 12] },
  rifle_accuracy: { dir: "high", cuts: [24, 19, 15, 12] },
  pistol_accuracy: { dir: "high", cuts: [28, 22, 17, 13] },
  sniper_accuracy: { dir: "high", cuts: [60, 50, 40, 30] },
  accuracy_spotted: { dir: "high", cuts: [24, 19, 15, 12] },
  head_accuracy: { dir: "high", cuts: [35, 25, 15, 9] },
  spray_accuracy: { dir: "high", cuts: [50, 40, 25, 16] },
  time_to_damage: { dir: "low", cuts: [560, 620, 700, 800] },
  spotted_acc: { dir: "high", cuts: [40, 34, 27, 23] },
  crosshair_placement: { dir: "low", cuts: [6, 9, 13, 17] },
  counter_strafing: { dir: "high", cuts: [90, 82, 73, 68] },
  first_bullet_accuracy: { dir: "high", cuts: [55, 45, 35, 28] },
  tracking: { dir: "high", cuts: [65, 55, 45, 35] },
};

export default {
  computed: {
    lineupsToRender(): any[] {
      return this.combineWith ? [this.lineup, this.combineWith] : [this.lineup];
    },
    sortGetters(): Record<string, (m: any) => unknown> {
      return {
        accuracy: (m: any) => this.accuracyPct(m) ?? -1,
        rifle_accuracy: (m: any) => this.rifleAccuracy(m) ?? -1,
        pistol_accuracy: (m: any) => this.pistolAccuracy(m) ?? -1,
        sniper_accuracy: (m: any) => this.sniperAccuracy(m) ?? -1,
        accuracy_spotted: (m: any) => this.accuracySpottedPct(m) ?? -1,
        head_accuracy: (m: any) => this.headAccuracyPct(m) ?? -1,
        hs_kill_pct: (m: any) => this.hsKillPct(m) ?? -1,
        spray_accuracy: (m: any) => this.sprayAccuracyPct(m) ?? -1,
        // TTD is "lower better", so invert so default desc sort puts elite first
        time_to_damage: (m: any) => {
          const v = this.ttdMs(m);
          return v === null ? -1 : -v;
        },
        spotted_acc: (m: any) => this.spottedAcc(m) ?? -1,
        crosshair_placement: (m: any) => {
          const v = this.crosshairPlacement(m);
          return v === null ? -1 : -v;
        },
        counter_strafing: (m: any) => this.counterStrafePct(m) ?? -1,
        first_bullet_accuracy: (m: any) => this.firstBulletAccuracy(m) ?? -1,
        tracking: (m: any) => this.trackingPct(m) ?? -1,
      };
    },
  },
  methods: {
    tierLevel(stat: string, value: number | null): StatLevel | null {
      return statLevelFor(TIER_CONFIG[stat], value);
    },
    statsFor(member: any) {
      const arr =
        member?.player?.match_stats ?? member?.player?.match_map_stats ?? null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    },
    // Per stat: null only if the player has no stats row for this match.
    // If they do but the relevant counter/denominator is 0, return 0 so
    // the table reads "0%" / "0ms" instead of "—".
    accuracyPct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return pct(toNumber(s.hits), toNumber(s.shots_fired)) ?? 0;
    },
    // Pivot the per-weapon-class rows (all-maps view or per-map table) into a
    // { rifle, pistol, sniper } lookup.
    weaponStatsFor(member: any): Record<string, any> {
      const arr =
        member?.player?.weapon_stats ??
        member?.player?.aim_weapon_stats ??
        null;
      const by: Record<string, any> = {};
      if (Array.isArray(arr)) {
        for (const r of arr) {
          if (r?.weapon_class) by[r.weapon_class] = r;
        }
      }
      return by;
    },
    // Per-class accuracy. null (renders "—") when the player has no row for
    // that class or fired too few shots for the % to be meaningful.
    classAccuracy(member: any, cls: string): number | null {
      const r = this.weaponStatsFor(member)[cls];
      if (!r) return null;
      const shots = toNumber(r.shots);
      if (shots === null || shots < 5) return null;
      return pct(toNumber(r.hits), shots) ?? 0;
    },
    rifleAccuracy(member: any): number | null {
      return this.classAccuracy(member, "rifle");
    },
    pistolAccuracy(member: any): number | null {
      return this.classAccuracy(member, "pistol");
    },
    sniperAccuracy(member: any): number | null {
      return this.classAccuracy(member, "sniper");
    },
    accuracySpottedPct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return (
        pct(toNumber(s.hits_at_spotted), toNumber(s.shots_at_spotted)) ?? 0
      );
    },
    headAccuracyPct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return pct(toNumber(s.headshot_hits), toNumber(s.non_awp_hits)) ?? 0;
    },
    hsKillPct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return pct(toNumber(s.hs_kills), toNumber(s.kills)) ?? 0;
    },
    sprayAccuracyPct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return pct(toNumber(s.spray_hits), toNumber(s.spray_shots)) ?? 0;
    },
    ttdMs(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      const sum = toNumber(s.time_to_damage_sum_s);
      const count = toNumber(s.time_to_damage_count);
      if (sum !== null && count) {
        return Math.round((sum / count) * 1000);
      }
      const direct = toNumber(s.avg_time_to_damage_s);
      if (direct !== null && direct > 0) {
        return Math.round(direct * 1000);
      }
      return 0;
    },
    spottedAcc(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return (
        pct(toNumber(s.spotted_with_damage_count), toNumber(s.spotted_count)) ??
        0
      );
    },
    crosshairPlacement(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      const sum = toNumber(s.crosshair_angle_sum_deg);
      const count = toNumber(s.crosshair_angle_count);
      if (sum !== null && count) {
        return Math.round((sum / count) * 10) / 10;
      }
      const direct = toNumber(s.avg_crosshair_angle_deg);
      if (direct !== null) return Math.round(direct * 10) / 10;
      return 0;
    },
    counterStrafePct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return (
        pct(
          toNumber(s.counter_strafed_shots),
          toNumber(s.counter_strafe_eligible_shots),
        ) ?? 0
      );
    },
    firstBulletAccuracy(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return (
        pct(toNumber(s.first_bullet_hits), toNumber(s.first_bullet_shots)) ?? 0
      );
    },
    trackingPct(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      return (
        pct(
          toNumber(s.on_target_frames),
          toNumber(s.total_engagement_frames),
        ) ?? 0
      );
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
