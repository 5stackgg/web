<template>
  <clickable-table class="mt-2 mb-2">
    <thead>
      <tr>
        <th></th>
        <th>Status</th>
        <th>Type</th>
        <th>Map</th>
        <th>Date</th>
        <th>Score</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="match of matches">
        <tr @click="viewMatch(match.id)">
          <td>{{ match.lineups[0].name }} vs {{ match.lineups[1].name }}</td>
          <td>{{ match.status }}</td>
          <td>{{ match.type }} (MR {{ match.mr }})</td>
          <td>
            {{ match.map }}
          </td>
          <td>
            {{ match.created_at }}
          </td>
          <td>TODO - get number of maps and current map socre</td>
        </tr>
      </template>
    </tbody>
  </clickable-table>
</template>

<script lang="ts">
export default {
  props: {
    matches: {
      type: Array,
      required: true,
    },
  },
  methods: {
    viewMatch(matchId) {
      this.$router.push(`/matches/${matchId}`);
    },
  },
};
</script>
