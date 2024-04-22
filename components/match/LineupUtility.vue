<script lang="ts" setup>
import LineupMember from "~/components/match/LineupMember.vue";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="hidden sm:table-cell">
          {{ lineup.name }}
        </TableHead>
        <TableHead class="hidden sm:table-cell"> Flashes Thrown </TableHead>
        <TableHead class="hidden sm:table-cell"> Flash Assists </TableHead>
        <TableHead class="hidden md:table-cell"> Enemies Flashed </TableHead>
        <TableHead> Team Flashed </TableHead>
        <TableHead> Avg bling time </TableHead>
        <TableHead> HE Damage </TableHead>
        <TableHead> Total Damage </TableHead>
        <TableHead> Team Damage </TableHead>
        <TableHead> Molotov Damage </TableHead>
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
        <TableCell> TODO assits </TableCell>
        <TableCell>
          {{ member.player.flashed_players_aggregate.aggregate.count }}
        </TableCell>
        <TableCell>
          {{ member.player.team_flashes_aggregate.aggregate.count }}
        </TableCell>
        <TableCell>
          duration
          {{
            formatStatValue(
              member.player.avg_flash_duration_aggregate.aggregate.avg.duration
            )
          }}
        </TableCell>
        <TableCell>
          {{ member.player.he_damage_aggregate.aggregate.sum.damage || 0 }}
        </TableCell>
        <TableCell>
          {{ member.player.molotov_damage_aggregate.aggregate.sum.damage || 0 }}
        </TableCell>
        <TableCell> TODO </TableCell>
        <TableCell> TODO </TableCell>
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
