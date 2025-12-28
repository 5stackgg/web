<script lang="ts" setup>
import TournamentBracketViewer from "./TournamentBracketViewer.vue";
import RoundRobinResults from "./RoundRobinResults.vue";
</script>
<template>
  <!-- Loop through groups -->
  <div v-for="groupNumber in maxGroups" :key="groupNumber" class="mb-6">
    <h3 class="text-lg font-semibold mb-3" v-if="stage.groups > 1">
      {{
        $t("tournament.stage.group", { group: getGroupDisplay(groupNumber) })
      }}
    </h3>
    <!-- Round Robin: Show results table above bracket -->
    <RoundRobinResults
      v-if="isRoundRobin"
      :stage="stage"
      :group-number="groupNumber"
      :tournament="tournament"
      class="mb-6"
    ></RoundRobinResults>
    <!-- Bracket Viewer (for both Round Robin and Elimination) -->
    <TournamentBracketViewer
      :stage="stage.order"
      :rounds="getRoundsForGroup(groupNumber)"
      :is-final-stage="isFinalStage"
      :is-loser-bracket="groupNumber > stage.groups"
      :total-groups="maxGroups"
      :stage-type="stage.type"
    ></TournamentBracketViewer>
  </div>
</template>

<script lang="ts">
import { e_tournament_stage_types_enum } from "~/generated/zeus";

export default {
  props: {
    stage: {
      type: Object,
      required: true,
    },
    isFinalStage: {
      type: Boolean,
      required: true,
    },
    tournament: {
      type: Object,
      required: false,
    },
  },
  computed: {
    isRoundRobin() {
      return this.stage?.type === e_tournament_stage_types_enum.RoundRobin;
    },
    maxGroups() {
      if (!this.stage.brackets || this.stage.brackets.length === 0) {
        return this.stage.groups || 1;
      }
      return Math.max(
        ...this.stage.brackets.map((bracket: any) => bracket.group),
      );
    },
    getRoundsForGroup() {
      return (groupNumber: number) => {
        const rounds = new Map();
        for (const match of this.stage?.brackets) {
          if (match.group == groupNumber) {
            const matches = rounds.get(match.round) || [];
            matches.push(match);
            rounds.set(match.round, matches);
          }
        }
        return rounds;
      };
    },
    getGroupDisplay() {
      return (groupNumber: number) => {
        // If we have 26 or fewer groups, use letters a-z
        if (this.stage.groups <= 26) {
          return String.fromCharCode(96 + groupNumber).toUpperCase();
        }
        // Otherwise use the original number
        return groupNumber;
      };
    },
  },
};
</script>
