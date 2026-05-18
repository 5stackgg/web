<script lang="ts" setup>
import { computed } from "vue";
import LineupMember from "~/components/match/LineupMember.vue";
import SortableTableHead from "~/components/ui/SortableTableHead.vue";
import { useTableSort } from "~/composables/useTableSort";
import { useAimColumns } from "~/composables/useMatchTableColumns";
import { useCurrentUserRow } from "~/composables/useCurrentUserRow";

const { visibility: aimVis } = useAimColumns();
const { rowClass, stickyCellClass } = useCurrentUserRow();

const allAimColumns: Array<{ label: string; tooltipKey: string }> = [
  { label: "accuracy", tooltipKey: "accuracy" },
  { label: "accuracy_spotted", tooltipKey: "accuracy_spotted" },
  { label: "head_accuracy", tooltipKey: "head_accuracy" },
  { label: "hs_kill_pct", tooltipKey: "hs_kill_pct" },
  { label: "spray_accuracy", tooltipKey: "spray_accuracy" },
  { label: "time_to_damage", tooltipKey: "time_to_damage" },
  { label: "spotted_acc", tooltipKey: "spotted_acc" },
  { label: "crosshair_placement", tooltipKey: "crosshair_placement" },
  { label: "counter_strafing", tooltipKey: "counter_strafing" },
];

const aimColumns = computed(() =>
  allAimColumns.filter(
    (c) => c.label === "accuracy" || aimVis.value[c.label] !== false,
  ),
);

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>();
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead
          v-if="!hideMember"
          class="w-[220px] text-left whitespace-nowrap sticky left-0 z-20 bg-card border-r border-border shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]"
        >
          {{ lineup.name }}
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
        v-for="member of sortRows(lineup.lineup_players, sortGetters)"
        :class="['group', rowClass(member)]"
      >
        <TableCell
          v-if="!hideMember"
          :class="[
            'sticky left-0 z-10 border-r border-border',
            stickyCellClass(member) ||
              'bg-card group-hover:bg-muted shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]',
          ]"
        >
          <lineup-member
            :member="member"
            :lineup_id="lineup.id"
          ></lineup-member>
        </TableCell>
        <TableCell :class="tierClass('accuracy', accuracyPct(member))">
          <template v-if="accuracyPct(member) !== null">
            {{ accuracyPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell
          v-if="aimVis.accuracy_spotted !== false"
          :class="tierClass('accuracy_spotted', accuracySpottedPct(member))"
        >
          <template v-if="accuracySpottedPct(member) !== null">
            {{ accuracySpottedPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell
          v-if="aimVis.head_accuracy !== false"
          :class="tierClass('head_accuracy', headAccuracyPct(member))"
        >
          <template v-if="headAccuracyPct(member) !== null">
            {{ headAccuracyPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell v-if="aimVis.hs_kill_pct !== false">
          <template v-if="hsKillPct(member) !== null">
            {{ hsKillPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell
          v-if="aimVis.spray_accuracy !== false"
          :class="tierClass('spray_accuracy', sprayAccuracyPct(member))"
        >
          <template v-if="sprayAccuracyPct(member) !== null">
            {{ sprayAccuracyPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell
          v-if="aimVis.time_to_damage !== false"
          :class="tierClass('time_to_damage', ttdMs(member))"
        >
          <template v-if="ttdMs(member) !== null"
            >{{ ttdMs(member) }} ms</template
          >
          <template v-else>—</template>
        </TableCell>
        <TableCell
          v-if="aimVis.spotted_acc !== false"
          :class="tierClass('spotted_acc', spottedAcc(member))"
        >
          <template v-if="spottedAcc(member) !== null">
            {{ spottedAcc(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell
          v-if="aimVis.crosshair_placement !== false"
          :class="tierClass('crosshair_placement', crosshairPlacement(member))"
        >
          <template v-if="crosshairPlacement(member) !== null">
            {{ crosshairPlacement(member) }}°
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell
          v-if="aimVis.counter_strafing !== false"
          :class="tierClass('counter_strafing', counterStrafePct(member))"
        >
          <template v-if="counterStrafePct(member) !== null">
            {{ counterStrafePct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
      </TableRow>
    </TableBody>
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

import { statTierClass, type StatTierConfig } from "~/utils/statTiers";

const TIER_CONFIG: Record<string, StatTierConfig> = {
  accuracy: { dir: "high", cuts: [21, 16, 13] },
  accuracy_spotted: { dir: "high", cuts: [21, 16, 13] },
  head_accuracy: { dir: "high", cuts: [30, 17, 10] },
  spray_accuracy: { dir: "high", cuts: [46, 28, 18] },
  time_to_damage: { dir: "low", cuts: [600, 680, 770] },
  spotted_acc: { dir: "high", cuts: [37, 29, 25] },
  crosshair_placement: { dir: "low", cuts: [8, 13, 16] },
  counter_strafing: { dir: "high", cuts: [88, 74, 71] },
};

export default {
  computed: {
    sortGetters(): Record<string, (m: any) => unknown> {
      return {
        accuracy: (m: any) => this.accuracyPct(m) ?? -1,
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
      };
    },
  },
  methods: {
    tierClass(stat: string, value: number | null): string {
      return statTierClass(TIER_CONFIG[stat], value);
    },
    statsFor(member: any) {
      const arr =
        member?.player?.match_map_stats ?? member?.player?.match_stats ?? null;
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
    hideMember: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
