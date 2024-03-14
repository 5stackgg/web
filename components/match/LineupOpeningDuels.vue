<template>
  <clickable-table :caption="lineup.name">
    <thead>
      <tr>
        <th>{{ lineup.name }}</th>
        <th>Attempts</th>
        <th>Success</th>
        <th>Traded</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="member of lineup.lineup_players">
        <lineup-member :member="member" :lineup_id="lineup.id"></lineup-member>
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
