<template>
  <clickable-table :caption="lineup.name">
    <thead>
      <tr>
        <th>{{ lineup.name }}</th>
        <th>Flash Assists</th>
        <th>Enemies Flashed</th>
        <th>Team Flashed</th>
        <th>Avg bling time</th>
        <th>HE Damage</th>
        <th>HE Team damage</th>
        <th>Unused utility</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="member of lineup.lineup_players">
        <lineup-member :member="member" :lineup_id="lineup.id"></lineup-member>
        <td class="w-2">
          {{ member.player.flashes_thrown_aggregate.aggregate.count }}
        </td>
        <td class="w-2">
          {{ member.player.flashed_players_aggregate.aggregate.count }}
        </td>
        <td class="w-2">
          {{ member.player.team_flashes_aggregate.aggregate.count }}
        </td>
        <td class="w-2">
          {{
            formatStatValue(
              member.player.avg_flash_duration_aggregate.aggregate.avg.duration,
            )
          }}
        </td>
        <td class="w-2">
          {{ member.player.he_damage_aggregate.aggregate.sum.damage || 0 }}
        </td>
        <td class="w-2">TODO</td>
        <td class="w-2">TODO</td>
      </tr>
    </tbody>
  </clickable-table>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import formatStatValue from "../../utilities/formatStatValue";

export default {
  methods: { formatStatValue },
  components: { LineupMember },
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
