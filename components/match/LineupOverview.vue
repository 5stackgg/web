<template>
  <clickable-table :caption="lineup.name">
    <thead>
      <tr>
        <th>{{ lineup.name }}</th>
        <th>Kills</th>
        <th>Assists</th>
        <th>Deaths</th>
        <th>K/D</th>
        <th>Total Damage</th>
        <th>2k</th>
        <th>3k</th>
        <th>4k</th>
        <th>5k</th>
        <th>knifes</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="member of lineup.lineup_players">
        <lineup-member
          :member="member"
          :lineup_id="lineup.id"
          :removeable="true"
        ></lineup-member>
        <td class="w-2">
          {{ member.player.kills_aggregate.aggregate.count }}
        </td>
        <td class="w-2">
          {{ member.player.assists_aggregate.aggregate.count }}
        </td>
        <td class="w-2">TODO</td>
        <td class="w-2">TODO</td>
        <td class="w-2">
          {{ member.player.damage_dealt_aggregate.aggregate.sum.damage }}
          <span
            class="ml-2 inline-flex items-center gap-x-1.5 py-1.5 px-3 rounded-md text-xs font-medium border border-gray-200 bg-white text-gray-800 shadow-sm dark:bg-slate-900 dark:border-gray-700 dark:text-white"
            >{{
              Math.ceil(
                member.player.damage_dealt_aggregate.aggregate.sum.damage / 1,
                // TODO - need to get rounds
                // match.rounds.length,
              )
            }}
            ADR</span
          >
        </td>
        <td class="w-2">TODO</td>
        <td class="w-2">TODO</td>
        <td class="w-2">TODO</td>
        <td class="w-2">TODO</td>
        <td class="w-2">TODO</td>
      </tr>
    </tbody>
  </clickable-table>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";

export default {
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
