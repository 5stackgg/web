<template>
  <clickable-table class="mt-2 mb-2">
    <thead>
      <tr>
        <th>Team</th>
        <th>Wins</th>
        <th>Losses</th>
        <th>Overtime Losses</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="team of teams">
        <tr @click="viewTeam(team.id)">
          <td>{{ team.name }}</td>
          <td>Wins</td>
          <td>Losses</td>
          <td>Overtime Losses</td>
        </tr>
      </template>
    </tbody>
  </clickable-table>
</template>

<script lang="ts">
export default {
  props: {
    teams: {
      required: true,
      type: Object,
    },
  },
  methods: {
    viewTeam(teamId) {
      this.$router.push(`/teams/${teamId}`);
    },
  },
};
</script>
