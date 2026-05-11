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
          $t("match.lineup.stats.flashes_thrown")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.flash_assists")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.enemies_flashed")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.team_flashed")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.avg_blind_time")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.he_damage")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.lineup.stats.molotov_damage")
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
        <TableCell>{{ statsFor(member)?.flashes_thrown ?? "—" }}</TableCell>
        <TableCell>{{ statsFor(member)?.flash_assists ?? "—" }}</TableCell>
        <TableCell>{{ statsFor(member)?.enemies_flashed ?? "—" }}</TableCell>
        <TableCell>{{ statsFor(member)?.team_flashed ?? "—" }}</TableCell>
        <TableCell>
          <template v-if="(avgFlashDuration(member) ?? null) !== null">
            {{ formatStatValue(String(avgFlashDuration(member))) }}
            {{ $t("match.lineup.stats.seconds") }}
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>{{ statsFor(member)?.he_damage ?? "—" }}</TableCell>
        <TableCell>{{ statsFor(member)?.molotov_damage ?? "—" }}</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
import formatStatValue from "../../utilities/formatStatValue";

// Hasura serialises Postgres `numeric` as a string. Accept either form so the
// helpers below can read the view (avg_flash_duration) and the per-map table
// (flash_duration_sum / _count) without caring which one Apollo handed us.
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export default {
  methods: {
    formatStatValue,
    // Resolve to the per-map row (player_match_map_stats) if present, else fall
    // back to the all-maps view row (player_match_stats_v). Both are exposed
    // as array_relationships of length <= 1, so we pluck [0].
    statsFor(member: any) {
      const arr =
        member?.player?.match_map_stats ?? member?.player?.match_stats ?? null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    },
    // The all-maps view exposes avg_flash_duration directly; the per-map table
    // exposes sum + count so we can compute it the same way the SQL view does.
    // Postgres `numeric` columns come over the wire as strings (Hasura preserves
    // precision), so we coerce here.
    avgFlashDuration(member: any): number | null {
      const s = this.statsFor(member);
      if (!s) return null;
      const avg = toNumber(s.avg_flash_duration);
      if (avg !== null) return avg;
      const sum = toNumber(s.flash_duration_sum);
      const count = toNumber(s.flash_duration_count);
      if (sum !== null && count) return sum / count;
      return null;
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
