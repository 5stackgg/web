<script lang="ts" setup>
import { TooltipProvider } from "reka-ui";
definePageMeta({ layout: false });
</script>

<template>
  <TooltipProvider
    :delay-duration="200"
    :skip-delay-duration="300"
    :disable-hoverable-content="true"
  >
    <div class="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <header
        v-if="tournament"
        class="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
      >
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-[hsl(var(--tac-amber))]">◢</span>
          <span class="truncate text-foreground font-bold">{{
            tournament.name
          }}</span>
          <span v-if="activeStage" class="opacity-50">·</span>
          <span v-if="activeStage" class="truncate">
            {{
              activeStage.e_tournament_stage_type?.description ||
              activeStage.type
            }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <div
            v-if="isCycleMode && totalSlides > 1"
            class="flex items-center gap-1"
          >
            <span class="tabular-nums text-foreground">
              {{ String(slideIndex + 1).padStart(2, "0") }}
            </span>
            <span class="opacity-50">/</span>
            <span class="tabular-nums opacity-70">
              {{ String(totalSlides).padStart(2, "0") }}
            </span>
          </div>
          <div
            v-if="isCurrentMode"
            class="flex items-center gap-1.5 rounded border border-destructive/55 bg-destructive/15 px-2 py-0.5 text-destructive"
          >
            <span
              class="h-1.5 w-1.5 rounded-full bg-current animate-pulse"
            ></span>
            {{ $t("tournament.bracket.embed_current_label") }}
          </div>
        </div>
      </header>

      <div class="relative flex-1 overflow-hidden">
        <div
          v-if="!tournament"
          class="flex h-full w-full items-center justify-center text-sm text-muted-foreground"
        >
          {{ $t("common.loading") }}
        </div>
        <div
          v-else-if="!activeStage"
          class="flex h-full w-full items-center justify-center text-sm text-muted-foreground"
        >
          {{ $t("tournament.bracket.embed_no_stage") }}
        </div>
        <div v-else class="flex h-full w-full flex-col px-4 py-2 overflow-auto">
          <div
            v-if="isCycleMode && activeSlide && (slideDivision || slideSide)"
            class="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground"
          >
            <span
              v-if="slideDivision"
              class="rounded border border-border bg-muted/40 px-2 py-0.5"
            >
              {{ $t("tournament.stage.group", { group: slideDivision }) }}
            </span>
            <span
              v-if="slideSide"
              class="rounded border border-border bg-muted/40 px-2 py-0.5"
            >
              {{ slideSide }}
            </span>
          </div>

          <template v-if="isCycleMode && activeSlide">
            <div
              v-for="group of cycleGroupsToShow"
              :key="`${activeStage.id}-${group}`"
              class="min-h-0 flex-1"
            >
              <TournamentBracketViewer
                :stage="activeStage"
                :tournament="tournament"
                :rounds="getRoundsForGroup(activeStage, group)"
                :is-final-stage="isFinalStage"
                :is-loser-bracket="group > (activeStage.groups || 1)"
                :total-groups="cycleGroupsToShow.length"
                :stage-type="activeStage.type"
                :embed="true"
              />
            </div>
          </template>

          <TournamentStage
            v-else
            :stage="activeStage"
            :tournament="tournament"
            :is-final-stage="isFinalStage"
            :embed="true"
          />
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<script lang="ts">
import TournamentBracketViewer from "~/components/tournament/TournamentBracketViewer.vue";
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";

interface SlideEntry {
  stageOrder: number;
  division: number;
  side: "winner" | "loser" | null;
}

export default {
  components: { TournamentBracketViewer, TournamentStage },
  data() {
    return {
      tournament: null as any,
      slideIndex: 0,
      cycleTimer: null as ReturnType<typeof setInterval> | null,
    };
  },
  apollo: {
    $subscribe: {
      tournaments_by_pk: {
        query: typedGql("subscription")({
          tournaments_by_pk: [
            { id: $("tournamentId", "uuid!") },
            {
              id: true,
              name: true,
              status: true,
              stages: [
                { order_by: [{ order: order_by.asc }] },
                {
                  id: true,
                  type: true,
                  order: true,
                  groups: true,
                  third_place_match: true,
                  e_tournament_stage_type: { description: true },
                  options: matchOptionsFields,
                  brackets: [
                    {
                      order_by: [
                        { round: order_by.asc },
                        { group: order_by.asc },
                        { path: order_by.desc },
                        { match_number: order_by.asc },
                      ],
                    },
                    {
                      id: true,
                      round: true,
                      group: true,
                      bye: true,
                      match_number: true,
                      scheduled_at: true,
                      scheduled_eta: true,
                      team_1_seed: true,
                      team_2_seed: true,
                      path: true,
                      loser_parent_bracket_id: true,
                      match_options_id: true,
                      options: { best_of: true },
                      parent_bracket: {
                        id: true,
                        round: true,
                        group: true,
                        match_number: true,
                        path: true,
                      },
                      loser_bracket: {
                        id: true,
                        round: true,
                        group: true,
                        match_number: true,
                        path: true,
                      },
                      feeding_brackets: {
                        id: true,
                        round: true,
                        group: true,
                        match_number: true,
                        path: true,
                        parent_bracket_id: true,
                        loser_parent_bracket_id: true,
                        team_1_seed: true,
                        team_2_seed: true,
                      },
                      match: {
                        id: true,
                        status: true,
                        winning_lineup_id: true,
                        lineup_1_id: true,
                        lineup_2_id: true,
                        options: { best_of: true },
                        match_maps: [
                          { order_by: [{ order: order_by.asc }] },
                          {
                            lineup_1_score: true,
                            lineup_2_score: true,
                            winning_lineup_id: true,
                            order: true,
                            status: true,
                          },
                        ],
                        lineup_1: { id: true, name: true, team_id: true },
                        lineup_2: { id: true, name: true, team_id: true },
                      },
                      team_1: {
                        id: true,
                        name: true,
                        team: { name: true },
                      },
                      team_2: {
                        id: true,
                        name: true,
                        team: { name: true },
                      },
                      created_at: true,
                    },
                  ],
                },
              ],
            },
          ],
        }),
        variables(this: any) {
          return { tournamentId: this.$route.params.tournamentId };
        },
        result(this: any, { data }: any) {
          this.tournament = data.tournaments_by_pk;
        },
      },
    },
  },
  computed: {
    orderedStages(): any[] {
      return [...(this.tournament?.stages || [])].sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );
    },
    stageParam(): string {
      return (this.$route.query.stage as string) || "current";
    },
    isCycleMode(): boolean {
      const v = this.$route.query.cycle;
      return v === "1" || v === "true";
    },
    isCurrentMode(): boolean {
      return !this.isCycleMode && this.stageParam === "current";
    },
    intervalSeconds(): number {
      const v = Number(this.$route.query.interval);
      return Number.isFinite(v) && v >= 5 && v <= 600 ? v : 15;
    },
    slides(): SlideEntry[] {
      const stages = this.orderedStages;
      if (!this.isCycleMode) {
        let chosen: any = null;
        if (this.isCurrentMode) {
          chosen = this.findCurrentStage(stages);
        } else {
          const n = Number(this.stageParam);
          chosen = stages.find((s) => s.order === n) || null;
        }
        if (!chosen) return [];
        return [{ stageOrder: chosen.order, division: 1, side: null }];
      }
      const out: SlideEntry[] = [];
      for (const stage of stages) {
        const divisions = stage.groups || 1;
        for (let d = 1; d <= divisions; d++) {
          if (this.divisionHasLoserBracket(stage, d)) {
            out.push({ stageOrder: stage.order, division: d, side: "winner" });
            out.push({ stageOrder: stage.order, division: d, side: "loser" });
          } else {
            out.push({ stageOrder: stage.order, division: d, side: null });
          }
        }
      }
      return out;
    },
    totalSlides(): number {
      return this.slides.length;
    },
    activeSlide(): SlideEntry | null {
      if (!this.slides.length) return null;
      return this.slides[this.slideIndex % this.slides.length];
    },
    activeStage(): any | null {
      if (!this.activeSlide) return null;
      return (
        this.orderedStages.find(
          (s) => s.order === this.activeSlide!.stageOrder,
        ) || null
      );
    },
    isFinalStage(): boolean {
      if (!this.activeStage || !this.orderedStages.length) return false;
      const lastOrder =
        this.orderedStages[this.orderedStages.length - 1].order;
      return this.activeStage.order === lastOrder;
    },
    slideDivision(): string | null {
      if (!this.activeStage || !this.activeSlide) return null;
      const divisions = this.activeStage.groups || 1;
      if (divisions <= 1) return null;
      const d = this.activeSlide.division;
      if (divisions <= 26) {
        return String.fromCharCode(96 + d).toUpperCase();
      }
      return String(d);
    },
    slideSide(): string | null {
      const side = this.activeSlide?.side;
      if (side === "winner")
        return this.$t("tournament.bracket.embed_winner_label");
      if (side === "loser")
        return this.$t("tournament.bracket.embed_loser_label");
      return null;
    },
    cycleGroupsToShow(): number[] {
      const stage = this.activeStage;
      const slide = this.activeSlide;
      if (!stage || !slide) return [];
      const divisions = stage.groups || 1;
      const winnerGroup = slide.division;
      const loserGroup = slide.division + divisions;
      if (slide.side === "winner") return [winnerGroup];
      if (slide.side === "loser") return [loserGroup];
      const groups = [winnerGroup];
      if (this.divisionHasLoserBracket(stage, slide.division)) {
        groups.push(loserGroup);
      }
      return groups;
    },
  },
  watch: {
    isCycleMode: {
      immediate: true,
      handler(active: boolean) {
        this.stopCycle();
        if (active) {
          this.$nextTick(() => this.startCycle());
        }
      },
    },
    intervalSeconds() {
      if (this.isCycleMode) {
        this.stopCycle();
        this.startCycle();
      }
    },
    totalSlides() {
      if (this.slideIndex >= this.totalSlides && this.totalSlides > 0) {
        this.slideIndex = 0;
      }
    },
  },
  beforeUnmount() {
    this.stopCycle();
  },
  methods: {
    startCycle() {
      if (this.cycleTimer) return;
      this.cycleTimer = setInterval(() => {
        if (this.totalSlides <= 1) return;
        this.slideIndex = (this.slideIndex + 1) % this.totalSlides;
      }, this.intervalSeconds * 1000);
    },
    stopCycle() {
      if (this.cycleTimer) {
        clearInterval(this.cycleTimer);
        this.cycleTimer = null;
      }
    },
    distinctGroups(stage: any): number[] {
      const set = new Set<number>();
      for (const b of stage.brackets || []) {
        if (typeof b.group === "number") set.add(b.group);
      }
      return [...set].sort((a, b) => a - b);
    },
    divisionHasLoserBracket(stage: any, division: number): boolean {
      const divisions = stage.groups || 1;
      const loserGroup = division + divisions;
      return this.distinctGroups(stage).includes(loserGroup);
    },
    findCurrentStage(stages: any[]): any | null {
      if (!stages.length) return null;
      for (const stage of stages) {
        const unresolved = (stage.brackets || []).some((b: any) => {
          if (b.bye) return false;
          if (!b.team_1 && !b.team_2) return false;
          if (!b.match) return true;
          return !b.match.winning_lineup_id;
        });
        if (unresolved) return stage;
      }
      return stages[stages.length - 1];
    },
    getRoundsForGroup(stage: any, groupNumber: number): Map<number, any> {
      const rounds = new Map<number, any>();
      for (const match of stage?.brackets || []) {
        if (match.group == groupNumber) {
          const arr = rounds.get(match.round) || [];
          arr.push(match);
          rounds.set(match.round, arr);
        }
      }
      return rounds;
    },
  },
};
</script>
