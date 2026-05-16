<script lang="ts" setup>
import { HelpCircle } from "lucide-vue-next";
import LineupMember from "~/components/match/LineupMember.vue";

const aimColumns: Array<{ label: string; tooltipKey: string }> = [
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
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[220px] text-left whitespace-nowrap">
          {{ lineup.name }}
        </TableHead>
        <TableHead
          v-for="col of aimColumns"
          :key="col.label"
          class="whitespace-nowrap"
        >
          <TooltipProvider :delay-duration="100">
            <Tooltip>
              <TooltipTrigger class="inline-flex items-center gap-1">
                {{ $t(`match.lineup.stats.${col.label}`) }}
                <HelpCircle class="w-3 h-3 opacity-60" />
              </TooltipTrigger>
              <TooltipContent class="max-w-sm space-y-3">
                <div>
                  <div class="font-semibold">
                    {{ $t(`match.lineup.stats.tooltips.${col.tooltipKey}.title`) }}
                  </div>
                  <div class="text-xs mt-1 leading-snug">
                    {{ $t(`match.lineup.stats.tooltips.${col.tooltipKey}.description`) }}
                  </div>
                </div>
                <div>
                  <div class="font-semibold text-xs">
                    {{ $t("match.lineup.stats.calc_header") }}
                  </div>
                  <div class="text-xs mt-1 leading-snug">
                    {{ $t(`match.lineup.stats.tooltips.${col.tooltipKey}.calculation`) }}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="member of lineup.lineup_players">
        <TableCell>
          <lineup-member
            :member="member"
            :lineup_id="lineup.id"
          ></lineup-member>
        </TableCell>
        <TableCell>
          <template v-if="accuracyPct(member) !== null">
            {{ accuracyPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          <template v-if="accuracySpottedPct(member) !== null">
            {{ accuracySpottedPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          <template v-if="headAccuracyPct(member) !== null">
            {{ headAccuracyPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          <template v-if="hsKillPct(member) !== null">
            {{ hsKillPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          <template v-if="sprayAccuracyPct(member) !== null">
            {{ sprayAccuracyPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          <template v-if="ttdMs(member) !== null">{{ ttdMs(member) }} ms</template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          <template v-if="spottedAcc(member) !== null">
            {{ spottedAcc(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          <template v-if="crosshairPlacement(member) !== null">
            {{ crosshairPlacement(member) }}°
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
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

export default {
  methods: {
    statsFor(member: any) {
      const arr =
        member?.player?.match_map_stats ?? member?.player?.match_stats ?? null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    },
    accuracyPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(toNumber(s?.hits), toNumber(s?.shots_fired));
    },
    accuracySpottedPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(
        toNumber(s?.hits_at_spotted),
        toNumber(s?.shots_at_spotted),
      );
    },
    headAccuracyPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(toNumber(s?.headshot_hits), toNumber(s?.non_awp_hits));
    },
    hsKillPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(toNumber(s?.hs_kills), toNumber(s?.kills));
    },
    sprayAccuracyPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(toNumber(s?.spray_hits), toNumber(s?.spray_shots));
    },
    ttdMs(member: any): number | null {
      const s = this.statsFor(member);
      const sum = toNumber(s?.time_to_damage_sum_s);
      const count = toNumber(s?.time_to_damage_count);
      if (sum !== null && count) {
        return Math.round((sum / count) * 1000);
      }
      const direct = toNumber(s?.avg_time_to_damage_s);
      if (direct !== null && direct > 0) {
        return Math.round(direct * 1000);
      }
      return null;
    },
    spottedAcc(member: any): number | null {
      const s = this.statsFor(member);
      return pct(
        toNumber(s?.spotted_with_damage_count),
        toNumber(s?.spotted_count),
      );
    },
    crosshairPlacement(member: any): number | null {
      const s = this.statsFor(member);
      const sum = toNumber(s?.crosshair_angle_sum_deg);
      const count = toNumber(s?.crosshair_angle_count);
      if (sum !== null && count) {
        return Math.round((sum / count) * 10) / 10;
      }
      const direct = toNumber(s?.avg_crosshair_angle_deg);
      if (direct !== null) return Math.round(direct * 10) / 10;
      return null;
    },
    counterStrafePct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(
        toNumber(s?.counter_strafed_shots),
        toNumber(s?.counter_strafe_eligible_shots),
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
  },
};
</script>
