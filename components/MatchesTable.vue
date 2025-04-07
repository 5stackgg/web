<script setup lang="ts">
import { UserPlusIcon } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";
import cleanMapName from "~/utilities/cleanMapName";
</script>

<template>
  <Table hover>
    <TableHeader>
      <TableRow>
        <TableHead class="w-1/6">{{
          $t("match.options.table.match")
        }}</TableHead>
        <TableHead class="w-1/6"></TableHead>
        <TableHead class="w-1/6"></TableHead>
        <TableHead class="w-1/6 hidden sm:table-cell">{{
          $t("match.options.table.type")
        }}</TableHead>
        <TableHead class="w-1/6 hidden md:table-cell">{{
          $t("match.options.table.maps")
        }}</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <template v-if="matches.length === 0">
        <TableRow>
          <TableCell colspan="5" class="text-center py-8">
            <div class="text-gray-500 dark:text-gray-400">
              <p>
                <slot name="none-found">{{
                  $t("match.options.table.no_matches_found")
                }}</slot>
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
              <span class="text-gray-500">{{ $t("match.simple.vs") }}</span>
              <span class="font-bold">{{ match.lineup_2.name }}</span>
            </div>
            <div class="flex items-center space-x-2">
              <time-ago
                :date="match.created_at"
                class="text-sm text-gray500 dark:text-gray-400"
              ></time-ago>
            </div>
          </TableCell>
          <TableCell class="text-center">
            <Button
              @click="viewMatch(match.id)"
              variant="outline"
              v-if="
                match.status === e_match_status_enum.PickingPlayers &&
                match.options.lobby_access === e_lobby_access_enum.Open &&
                !match.lineup_1.is_on_lineup &&
                !match.lineup_2.is_on_lineup
              "
            >
              <UserPlusIcon class="h-4 w-4" />
              {{ $t("match.options.table.join") }}
            </Button>
          </TableCell>
          <TableCell class="text-center">
            <Badge>
              {{ match.e_match_status.description }}
              <template
                v-if="match.status === e_match_status_enum.PickingPlayers"
              >
                ({{ totalPlayers(match) }} /
                {{ match.min_players_per_lineup * 2 }})
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
                {{ cleanMapName(match_map.map.name) }}
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
