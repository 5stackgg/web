<script lang="ts" setup>
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
</script>

<template>
  <div>
    {{ teamName }}

    <template v-if="bracket.match">
      <Badge>
        <NuxtLink :to="`/matches/${bracket.match.id}`">{{
          bracket.match.status
        }}</NuxtLink>
      </Badge>
      <MatchLineupScoreDisplay :match="bracket.match" :lineup="bracket.match.lineup_1" ></MatchLineupScoreDisplay>
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
