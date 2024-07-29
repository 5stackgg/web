<script setup lang="ts">
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Teams</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Maps</TableHead>
        <TableHead>Date</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <template v-if="matches.length === 0">
        <TableRow>
          <TableCell colspan="5" class="text-center">No Matches</TableCell>
        </TableRow>
      </template>
      <template v-else>
        <TableRow
          v-for="match of matches"
          :key="match.id"
          @click="viewMatch(match.id)"
          class="cursor-pointer"
        >
          <TableCell class="font-medium">
            {{ match.lineup_1.name }} vs {{ match.lineup_2.name }}
          </TableCell>
          <TableCell>{{ match.status }}</TableCell>
          <TableCell
            >{{ match.options.type }} (MR {{ match.options.mr }})</TableCell
          >
          <TableCell>
            <template v-for="(match_map, index) of match.match_maps">
              <template v-if="index > 0">,</template>
              {{ match_map.map.name }}
            </template>
          </TableCell>
          <TableCell>
            <time-ago :date="match.created_at"></time-ago>
          </TableCell>
        </TableRow>
      </template>
    </TableBody>
  </Table>
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
