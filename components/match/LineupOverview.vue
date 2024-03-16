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
      <lineup-overview-row
        :member="member"
        v-for="member of lineup.lineup_players"
        :lineup_id="lineup.id"
      ></lineup-overview-row>
    </tbody>
  </clickable-table>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import LineupOverviewRow from "~/components/match/LineupOverviewRow.vue";

export default {
  components: { LineupOverviewRow, LineupMember },
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
