<script lang="ts" setup>
import LineupMember from "~/components/match/LineupMember.vue";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[220px] text-left whitespace-nowrap">
          {{ lineup.name }}
        </TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.accuracy")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.head_accuracy")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.hs_kill_pct")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.time_to_damage")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.spotted_acc")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.crosshair_placement")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.counter_strafing")
        }}</TableHead>
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
          <template v-if="ttd(member) !== null">
            {{ ttd(member) }} {{ $t("match.lineup.stats.seconds") }}
          </template>
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
    headAccuracyPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(toNumber(s?.headshot_hits), toNumber(s?.shots_fired));
    },
    hsKillPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(toNumber(s?.hs_kills), toNumber(s?.kills));
    },
    ttd(member: any): number | null {
      const s = this.statsFor(member);
      const sum = toNumber(s?.time_to_damage_sum_s);
      const count = toNumber(s?.time_to_damage_count);
      if (sum !== null && count) {
        return Math.round((sum / count) * 100) / 100;
      }
      const direct = toNumber(s?.avg_time_to_damage_s);
      if (direct !== null && direct > 0) {
        return Math.round(direct * 100) / 100;
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
      return pct(toNumber(s?.counter_strafed_shots), toNumber(s?.shots_fired));
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
