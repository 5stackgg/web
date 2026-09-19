<script lang="ts" setup></script>

<template>
  <span>
    <span
      v-if="score"
      class="font-bold"
      :class="{
        [`text-green-400`]: winning && showOutcomeColor,
        [`text-red-400`]: losing && showOutcomeColor,
        [`text-white-400`]: tied && showOutcomeColor,
      }"
    >
      <template v-if="matchMap">
        {{ teamScore }}
      </template>
      <template v-else-if="singleMap">
        {{ singleMapTeamScore }}
      </template>
      <template v-else>
        {{ matchStats.won }}
      </template>
    </span>

    <small v-if="matchMap && halves && hasSideWins">
      [<span class="text-yellow-500">{{ tWins }}</span
      >:<span class="text-blue-400">{{ ctWins }}</span
      >]
    </small>
  </span>
</template>

<script lang="ts">
import { matchSideWins } from "~/utilities/matchSideWins";

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
    score: {
      type: Boolean,
      default: true,
    },
    halves: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    showOutcomeColor() {
      if (this.matchMap) {
        return true;
      }
      return !!this.match.winning_lineup_id;
    },
    singleMap() {
      return !this.matchMap && this.match.options?.best_of === 1
        ? this.match.match_maps?.[0]
        : null;
    },
    singleMapTeamScore() {
      if (!this.singleMap) {
        return;
      }
      return this.isLineup1
        ? this.singleMap.lineup_1_score
        : this.singleMap.lineup_2_score;
    },
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

      if (this.singleMap) {
        return this.isLineup1
          ? this.singleMap.lineup_1_score > this.singleMap.lineup_2_score
          : this.singleMap.lineup_2_score > this.singleMap.lineup_1_score;
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

      if (this.singleMap) {
        return this.isLineup1
          ? this.singleMap.lineup_1_score < this.singleMap.lineup_2_score
          : this.singleMap.lineup_2_score < this.singleMap.lineup_1_score;
      }

      return this.matchStats.lost > this.matchStats.won;
    },
    tied() {
      if (this.matchMap) {
        return this.matchMap.lineup_1_score === this.matchMap.lineup_2_score;
      }

      if (this.singleMap) {
        return this.singleMap.lineup_1_score === this.singleMap.lineup_2_score;
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
      const latestRound = this.matchMap.rounds?.[0];
      if (latestRound) {
        return this.isLineup1
          ? latestRound.lineup_1_score
          : latestRound.lineup_2_score;
      }
      return this.isLineup1
        ? this.matchMap.lineup_1_score
        : this.matchMap.lineup_2_score;
    },
    isLineup1() {
      return this.match.lineup_1_id === this.lineup.id;
    },
    sideWins() {
      if (!this.matchMap) {
        return { ct: 0, t: 0 };
      }
      return matchSideWins(this.matchMap.rounds, this.isLineup1, {
        currentSide: this.isLineup1
          ? this.matchMap.lineup_1_side
          : this.matchMap.lineup_2_side,
        mr: this.match.options?.mr,
      });
    },
    hasSideWins() {
      return this.sideWins.ct + this.sideWins.t > 0;
    },
    ctWins() {
      return this.matchMap ? this.sideWins.ct : undefined;
    },
    tWins() {
      return this.matchMap ? this.sideWins.t : undefined;
    },
  },
};
</script>
