<script lang="ts" setup>
import LineupMember from "~/components/match/LineupMember.vue";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[200px] text-left">
          {{ lineup.name }}
        </TableHead>
        <TableHead> {{ $t("match.lineup.stats.flashes_thrown") }} </TableHead>
        <TableHead> {{ $t("match.lineup.stats.flash_assists") }} </TableHead>
        <TableHead> {{ $t("match.lineup.stats.enemies_flashed") }} </TableHead>
        <TableHead> {{ $t("match.lineup.stats.team_flashed") }} </TableHead>
        <TableHead> {{ $t("match.lineup.stats.avg_blind_time") }} </TableHead>
        <TableHead> {{ $t("match.lineup.stats.he_damage") }} </TableHead>
        <TableHead> {{ $t("match.lineup.stats.molotov_damage") }} </TableHead>
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
          {{ member.player.flashes_thrown_aggregate.aggregate.count }}
        </TableCell>
        <TableCell>
          {{ member.player.flash_assists.aggregate.count }}
        </TableCell>
        <TableCell>
          {{ member.player.flashed_players_aggregate.aggregate.count }}
        </TableCell>
        <TableCell>
          {{ member.player.team_flashes_aggregate.aggregate.count }}
        </TableCell>
        <TableCell>
          {{
            formatStatValue(
              member.player.avg_flash_duration_aggregate.aggregate.avg.duration,
            )
          }}
          {{ $t("match.lineup.stats.seconds") }}
        </TableCell>
        <TableCell>
          {{ member.player.he_damage_aggregate.aggregate.sum.damage || 0 }}
        </TableCell>
        <TableCell>
          {{ member.player.molotov_damage_aggregate.aggregate.sum.damage || 0 }}
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
import formatStatValue from "../../utilities/formatStatValue";

export default {
  methods: { formatStatValue },
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
