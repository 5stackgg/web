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
          <td>{{ match.lineup_1.name }} vs {{ match.lineup_2.name }}</td>
          <td>{{ match.status }}</td>
          <td>{{ match.type }} (MR {{ match.mr }})</td>
          <td>
            {{ match.map }}
          </td>
          <td>
            {{ match.created_at }}
          </td>
          <td>{{ match.lineup_1.score }} - {{ match.lineup_2.score }}</td>
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
