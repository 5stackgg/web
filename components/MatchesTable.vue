<script setup lang="ts">
import { InfoIcon } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <Table hover>
    <TableHeader>
      <TableRow>
        <TableHead class="w-1/3">Match</TableHead>
        <TableHead class="w-1/6 hidden sm:table-cell">Type</TableHead>
        <TableHead class="w-1/6">Status</TableHead>
        <TableHead class="w-1/6 hidden md:table-cell">Maps</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <template v-if="matches.length === 0">
        <TableRow>
          <TableCell colspan="5" class="text-center py-8">
            <div class="text-gray-500 dark:text-gray-400">
              <p>No Matches Found</p>
            </div>
          </TableCell>
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
            <div class="flex items-center space-x-2">
              <span class="font-bold">{{ match.lineup_1.name }}</span>
              <span class="text-gray-500">vs</span>
              <span class="font-bold">{{ match.lineup_2.name }}</span>
            </div>
            <div class="flex items-center space-x-2">
              <time-ago
                :date="match.created_at"
                class="text-sm text-gray-600 dark:text-gray-400"
              ></time-ago>
            </div>
          </TableCell>
          <TableCell class="hidden sm:table-cell">
            {{ match.options.type }}
          </TableCell>
          <TableCell>
            <Badge>{{ match.status }}</Badge>
          </TableCell>
          <TableCell class="hidden md:table-cell">
            <div class="flex flex-wrap gap-1">
              <Badge
                v-for="(match_map, index) of match.match_maps"
                :key="index"
                variant="outline"
              >
                {{ match_map.map.name }}
              </Badge>
            </div>
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
