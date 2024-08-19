<script lang="ts" setup>

</script>

<template>
    <span
        class="font-bold"
        :class="{
            [`text-green-400`]: winning,
            [`text-red-400`]: losing,
            [`text-gray-400`]: tied,
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
      [<span class="text-yellow-500">{{ tWins }}</span>:<span class="text-blue-400">{{ ctWins }}</span>]
    </small>
</template>

<script lang="ts">
import {e_sides_enum} from "~/generated/zeus";

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
    }
  },
  computed: {
    winning() {
      if(this.match.winning_lineup_id && this.match.winning_lineup_id === this.lineup.id) {
        return true;
      }

      if(this.tied) {
        return false;
      }

      return this.matchStats.won > this.matchStats.lost;
    },
    losing() {
      if(this.match.winning_lineup_id && this.match.winning_lineup_id !== this.lineup.id) {
        return true;
      }

      if(this.tied) {
        return false;
      }

      return this.matchStats.lost > this.matchStats.won;
    },
    tied() {
      return this.matchStats.won === this.matchStats.lost
    },
    matchStats() {
      let stats = {
        won: 0,
        lost: 0,
      }

      for(const matchMap of this.match.match_maps) {
        if(matchMap.status !== "Finished") {
          continue;
        }


        if(this.match.lineup_1_id === this.lineup.id && matchMap.lineup_1_score > matchMap.lineup_2_score) {
          stats.won++;
        } else if(this.match.lineup_2_id === this.lineup.id && matchMap.lineup_2_score > matchMap.lineup_1_score) {
          stats.lost++;
        }
      }

      return stats
    },
    teamScore() {
      return this.isLineup1 ? this.matchMap.lineup_1_score: this.matchMap.lineup_2_score
    },
    isLineup1() {
      return this.match.lineup_1_id === this.lineup.id;
    },
    ctWins() {
      const lastCtRound = this.matchMap.rounds.filter(({ lineup_1_side, lineup_2_side }) => {
        return this.isLineup1 ? lineup_1_side === e_sides_enum.CT : lineup_2_side === e_sides_enum.CT;
      }).at(-1)

      if(!lastCtRound) {
        return 0;
      }

      return this.isLineup1 ? lastCtRound.lineup_1_score : lastCtRound.lineup_2_score;
    },
    tWins() {
      const lastTRound = this.matchMap.rounds.filter(({ lineup_1_side, lineup_2_side }) => {
        return this.isLineup1 ? lineup_1_side === e_sides_enum.TERRORIST : lineup_2_side === e_sides_enum.TERRORIST;
      }).at(-1)

      if(!lastTRound) {
        return 0;
      }

      return this.isLineup1 ? lastTRound.lineup_1_score : lastTRound.lineup_2_score;
    },
  }
}
</script>