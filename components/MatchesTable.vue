<script setup lang="ts">
import { InfoIcon } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { e_match_status_enum } from "~/generated/zeus";
</script>

<template>
  <Table hover>
    <TableHeader>
      <TableRow>
        <TableHead class="w-1/6">Match</TableHead>
        <TableHead class="w-1/6"></TableHead>
        <TableHead class="w-1/6 hidden sm:table-cell">Type</TableHead>
        <TableHead class="w-1/6 hidden md:table-cell">Maps</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <template v-if="matches.length === 0">
        <TableRow>
          <TableCell colspan="5" class="text-center py-8">
            <div class="text-gray-500 dark:text-gray-400">
              <p>
                <slot name="none-found">No Matches Found</slot>
              </p>
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
          <TableCell>
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
          <TableCell class="text-center">
            <Badge>
              {{ match.status }}
              <template
                v-if="match.status === e_match_status_enum.PickingPlayers"
              >
                ({{ totalPlayers(match) }} / {{ match.min_players_per_lineup }})
              </template>
            </Badge>
          </TableCell>
          <TableCell class="hidden sm:table-cell">
            {{ match.options.type }}
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
    totalPlayers(match) {
      return (
        Math.min(
          match.lineup_counts.lineup_1_count,
          match.min_players_per_lineup,
        ) +
        Math.min(
          match.lineup_counts.lineup_2_count,
          match.min_players_per_lineup,
        )
      );
    },
  },
};
</script>
