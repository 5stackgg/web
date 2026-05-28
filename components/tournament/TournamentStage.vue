<script lang="ts" setup>
import BracketPair from "./BracketPair.vue";
import SwissBracketViewer from "./SwissBracketViewer.vue";
import StageStandings from "./StageStandings.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  e_tournament_stage_types_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
</script>

<template>
  <SwissBracketViewer
    v-if="isSwissFormat"
    :stage="stage"
    :tournament="tournament"
  ></SwissBracketViewer>

  <template v-else>
    <!-- Multiple group divisions: use tabs -->
    <Tabs
      v-if="stage.groups > 1"
      v-model="activeGroupTab"
      :default-value="`group-1`"
      class="w-full"
    >
      <TabsList
        class="flex flex-wrap gap-2 p-0 bg-transparent border-none h-auto w-full justify-start mb-4"
      >
        <TabsTrigger
          v-for="division in stage.groups"
          :key="`tab-${division}`"
          :value="`group-${division}`"
          class="inline-flex items-center gap-2 !px-4 !py-2 !bg-card/45 !border !border-border !rounded-md !text-muted-foreground font-[inherit] tracking-normal normal-case text-left [transition:border-color_180ms_ease,background_180ms_ease,color_180ms_ease] hover:!border-[hsl(var(--tac-amber)/0.35)] hover:!bg-card/70 data-[state=active]:!border-[hsl(var(--tac-amber)/0.55)] data-[state=active]:!bg-[hsl(var(--tac-amber)/0.08)] data-[state=active]:!text-foreground data-[state=active]:!shadow-none"
        >
          <span class="font-mono text-xs opacity-70 tabular-nums">
            {{ String(division).padStart(2, "0") }}
          </span>
          <span class="font-semibold text-sm uppercase tracking-[0.04em]">
            {{
              $t("tournament.stage.group", { group: getGroupDisplay(division) })
            }}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-for="division in stage.groups"
        :key="`content-${division}`"
        :value="`group-${division}`"
      >
        <StageStandings
          v-if="shouldShowStandings"
          class="mb-4"
          :stage="stage"
          :only-group="division"
        />

        <BracketPair
          :stage="stage"
          :tournament="tournament"
          :upper-rounds="getRoundsForGroup(division)"
          :lower-rounds="
            hasLoserBracket(division)
              ? getRoundsForGroup(division + stage.groups)
              : null
          "
          :is-final-stage="isFinalStage"
          :stage-type="stage.type"
          :embed="embed"
          :page-scroll="effectivePageScroll"
          :hide-finished-rounds="hideFinishedRounds"
          :persistence-key="`${stage.id}:${division}`"
        />
      </TabsContent>
    </Tabs>

    <!-- Single division: render directly -->
    <BracketPair
      v-else
      :stage="stage"
      :tournament="tournament"
      :upper-rounds="getRoundsForGroup(1)"
      :lower-rounds="hasLoserBracket(1) ? getRoundsForGroup(2) : null"
      :is-final-stage="isFinalStage"
      :stage-type="stage.type"
      :embed="embed"
      :page-scroll="viewMode === 'scroll'"
      :hide-finished-rounds="hideFinishedRounds"
      :persistence-key="`${stage.id}:1`"
    />
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
    embed: {
      type: Boolean,
      default: false,
    },
    viewMode: {
      type: String,
      default: "split",
    },
    hideFinishedRounds: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      activeGroupTab: "group-1",
    };
  },
  computed: {
    effectivePageScroll() {
      return this.viewMode === "scroll";
    },
    isSwissFormat() {
      return (
        this.stage?.type === e_tournament_stage_types_enum.Swiss ||
        this.stage?.e_tournament_stage_type?.value ===
          e_tournament_stage_types_enum.Swiss
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
        for (const match of this.stage?.brackets || []) {
          if (match.group == groupNumber) {
            const matches = rounds.get(match.round) || [];
            matches.push(match);
            rounds.set(match.round, matches);
          }
        }
        return rounds;
      };
    },
    hasLoserBracket() {
      return (division: number) => {
        const divisions = this.stage.groups || 1;
        const loserGroup = division + divisions;
        return this.maxGroups >= loserGroup;
      };
    },
    getGroupDisplay() {
      return (groupNumber: number) => {
        if ((this.stage.groups || 1) <= 26) {
          return String.fromCharCode(96 + groupNumber).toUpperCase();
        }
        return groupNumber;
      };
    },
    shouldShowStandings() {
      const status = (this.tournament as any)?.status;
      return (
        status === e_tournament_status_enum.Live ||
        status === e_tournament_status_enum.Paused ||
        status === e_tournament_status_enum.Finished
      );
    },
  },
};
</script>
