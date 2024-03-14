<template>
  <clickable-table class="mt-2 mb-2">
    <thead>
      <tr>
        <th></th>
        <th>Status</th>
        <th>Type</th>
        <th>Maps</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="match of matches">
        <tr @click="viewMatch(match.id)">
          <td>{{ lineup1(match).name }} vs {{ lineup2(match).name }}</td>
          <td>{{ match.status }}</td>
          <td>{{ match.type }} (MR {{ match.mr }})</td>
          <td>
            <template v-for="match_map of match.match_maps">
              {{ match_map.map }}
              <br />
              <p>{{ lineup1(match).name }} {{ match_map.lineup_1_score }}</p>
              <p>{{ lineup2(match).name }} {{ match_map.lineup_2_score }}</p>
            </template>
          </td>
          <td>
            {{ match.created_at }}
          </td>
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
    lineup1(match) {
      return match?.lineups.find((lineup) => {
        return lineup.id === match.lineup_1_id;
      });
    },
    lineup2(match) {
      return match?.lineups?.find((lineup) => {
        return lineup.id === match.lineup_2_id;
      });
    },
  },
};
</script>
