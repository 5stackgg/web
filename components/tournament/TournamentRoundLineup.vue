<script lang="ts" setup></script>

<template>
  <div>
    {{ teamName }}

    <template v-if="bracket.match">
      <Badge>
        <NuxtLink :to="`/matches/${bracket.match.id}`">{{
          bracket.match.status
        }}</NuxtLink>
      </Badge>

      <template v-if="!matchFinished && bracket.match.match_maps.length > 0">
        <span
          :class="{
            [`text-green-400`]: mapScores.current.winning,
            [`text-red-400`]: !mapScores.current.winning,
          }"
        >
          {{ mapScores.current.score }}
        </span>

        (
        <span
          :class="{
            [`text-green-400`]: mapScores.won > mapScores.lost,
            [`text-red-400`]: mapScores.lost > mapScores.won,
          }"
        >
          {{ mapScores.won }}
        </span>
        )
      </template>
      <template v-else>
        <div
          :class="{
            [`text-green-400`]: mapScores.won > mapScores.lost,
            [`text-red-400`]: mapScores.lost > mapScores.won,
          }"
        >
          {{ mapScores.won }}
        </div>
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { e_match_map_status_enum, e_match_status_enum } from "~/generated/zeus";

export default {
  props: {
    lineup: {
      type: String,
      required: true,
    },
    bracket: {
      type: Object,
      required: true,
    },
  },
  computed: {
    teamName() {
      const team = this.bracket[`team_${this.lineup}`];

      if (!team) {
        return;
      }

      return team.team?.name || team.name;
    },
    matchFinished() {
      return this.bracket.match.status === e_match_status_enum.Finished;
    },
    mapScores() {
      const results: {
        won: number;
        lost: number;
        current: {
          score: number;
          winning: boolean;
        };
      } = {
        won: 0,
        lost: 0,
      };

      for (const map of this.bracket.match?.match_maps) {
        const { lineup_1_score, lineup_2_score } = map;

        const winning =
          this.lineup === "1"
            ? lineup_1_score > lineup_2_score
            : lineup_2_score > lineup_1_score;

        if (map.status === e_match_map_status_enum.Finished) {
          winning ? results.won++ : results.lost++;
          continue;
        }

        results.current = {
          winning,
          score: this.lineup === "1" ? lineup_1_score : lineup_2_score,
        };
      }

      return results;
    },
  },
};
</script>
