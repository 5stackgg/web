<script lang="ts" setup></script>

<template>
  <span
    class="font-bold"
    :class="{
      [`text-green-400`]: winning,
      [`text-red-400`]: losing,
      [`text-white-400`]: tied,
    }"
  >
    <template v-if="matchMap">
      {{ teamScore }}
    </template>
    <template v-else>
      {{ matchStats.won }}
    </template>
  </span>

  <small v-if="matchMap">
    [<span class="text-yellow-500">{{ tWins }}</span
    >:<span class="text-blue-400">{{ ctWins }}</span
    >]
  </small>
</template>

<script lang="ts">
import { e_sides_enum } from "~/generated/zeus";

export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
    matchMap: {
      required: false,
      type: Object,
    },
  },
  computed: {
    winning() {
      if (this.matchMap) {
        return !this.tied && this.isLineup1
          ? this.matchMap.lineup_1_score > this.matchMap.lineup_2_score
          : this.matchMap.lineup_2_score > this.matchMap.lineup_1_score;
      }

      if (
        this.match.winning_lineup_id &&
        this.match.winning_lineup_id === this.lineup.id
      ) {
        return true;
      }

      if (this.tied) {
        return false;
      }

      return this.matchStats.won > this.matchStats.lost;
    },
    losing() {
      if (this.matchMap) {
        return !this.tied && this.isLineup1
          ? this.matchMap.lineup_1_score < this.matchMap.lineup_2_score
          : this.matchMap.lineup_2_score < this.matchMap.lineup_1_score;
      }

      if (
        this.match.winning_lineup_id &&
        this.match.winning_lineup_id !== this.lineup.id
      ) {
        return true;
      }

      if (this.tied) {
        return false;
      }

      return this.matchStats.lost > this.matchStats.won;
    },
    tied() {
      if (this.matchMap) {
        return this.matchMap.lineup_1_score === this.matchMap.lineup_2_score;
      }

      return this.matchStats.won === this.matchStats.lost;
    },
    matchStats() {
      let stats = {
        won: 0,
        lost: 0,
      };

      for (const matchMap of this.match.match_maps) {
        if (matchMap.winning_lineup_id === this.lineup.id) {
          stats.won++;
        } else {
          stats.lost++;
        }
      }
      return stats;
    },
    teamScore() {
      if (!this.matchMap) {
        return;
      }
      return this.isLineup1
        ? this.matchMap.lineup_1_score
        : this.matchMap.lineup_2_score;
    },
    isLineup1() {
      return this.match.lineup_1_id === this.lineup.id;
    },
    ctWins() {
      if (!this.matchMap) {
        return;
      }
      let wins = 0;
      for (const round of this.matchMap.rounds) {
        if (round.winning_side === e_sides_enum.CT) {
          if (this.isLineup1 && round.lineup_1_side === e_sides_enum.CT) {
            wins++;
          } else if (
            !this.isLineup1 &&
            round.lineup_2_side === e_sides_enum.CT
          ) {
            wins++;
          }
        }
      }
      return wins;
    },
    tWins() {
      if (!this.matchMap) {
        return;
      }
      let wins = 0;
      for (const round of this.matchMap.rounds) {
        if (round.winning_side === e_sides_enum.TERRORIST) {
          if (
            this.isLineup1 &&
            round.lineup_1_side === e_sides_enum.TERRORIST
          ) {
            wins++;
          } else if (
            !this.isLineup1 &&
            round.lineup_2_side === e_sides_enum.TERRORIST
          ) {
            wins++;
          }
        }
      }
      return wins;
    },
  },
};
</script>
