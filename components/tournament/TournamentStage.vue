<script lang="ts" setup>
import TournamentBracketViewer from "./TournamentBracketViewer.vue";
import SwissBracketViewer from "./SwissBracketViewer.vue";
import { e_tournament_stage_types_enum } from "~/generated/zeus";
</script>
<template>
  <!-- Swiss Format - groups represent record pools, so don't loop through them -->
  <SwissBracketViewer
    v-if="isSwissFormat"
    :stage="stage"
    :tournament="tournament"
  ></SwissBracketViewer>

  <!-- Other Bracket Formats - loop through groups -->
  <template v-else>
    <div v-for="groupNumber in maxGroups" :key="groupNumber" class="mb-6">
      <h3 class="text-lg font-semibold mb-3" v-if="stage.groups > 1">
        {{
          $t("tournament.stage.group", { group: getGroupDisplay(groupNumber) })
        }}
      </h3>
      <TournamentBracketViewer
        :stage="stage.order"
        :tournament="tournament"
        :rounds="getRoundsForGroup(groupNumber)"
        :is-final-stage="isFinalStage"
        :is-loser-bracket="groupNumber > stage.groups"
        :total-groups="maxGroups"
        :stage-type="stage.type"
      ></TournamentBracketViewer>
    </div>
  </template>
</template>

<script lang="ts">
export default {
  props: {
    stage: {
      type: Object,
      required: true,
    },
    tournament: {
      type: Object,
      required: true,
    },
    isFinalStage: {
      type: Boolean,
      required: true,
    },
  },
  computed: {
    isSwissFormat() {
      return (
        this.stage?.type === e_tournament_stage_types_enum.Swiss ||
        this.stage?.e_tournament_stage_type?.value === e_tournament_stage_types_enum.Swiss
      );
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
