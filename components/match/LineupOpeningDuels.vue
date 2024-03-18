<template>
  <clickable-table :caption="lineup.name">
    <thead>
      <tr>
        <th>{{ lineup.name }}</th>
        <th>Attempts</th>
        <th>Success</th>
      </tr>
    </thead>
    <tbody>
      <lineup-opening-duel-row
        :member="member"
        :lineup="lineup"
        :match="match"
        v-for="member of lineup.lineup_players"
      ></lineup-opening-duel-row>
    </tbody>
  </clickable-table>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import LineupOpeningDuelRow from "~/components/match/LineupOpeningDuelRow.vue";

export default {
  components: { LineupOpeningDuelRow, LineupMember },
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
