<script setup lang="ts">
import { UsersIcon } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import MiniMapDisplay from "~/components/MinIMapDisplay.vue";
import { Badge } from "~/components/ui/badge";
</script>

<template>
  <div
    class="bg-muted/30 border border-border rounded-lg hover:shadow-lg hover:shadow-primary/10 hover:bg-muted/20 hover:border-primary/30 hover:scale-[1.01] transition-all duration-300 cursor-pointer group"
    @click="navigateToTournament(tournament.id, $event)"
  >
    <div class="p-6 flex flex-col gap-4">
      <!-- Tournament Header -->
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-lg text-foreground truncate mb-2">
            {{ tournament.name }}
          </h3>

          <!-- Type, Description, and Stage Badges - Second Line -->
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="secondary" class="text-xs shrink-0">
              {{ tournament.options.type }}
            </Badge>
            <!-- Multiple stages: show each stage with best_of -->
            <template v-if="stageCount > 1">
              <Badge
                v-for="stage in sortedStages"
                :key="stage.id"
                variant="outline"
                class="text-xs shrink-0"
              >
                {{ getStageLabel(stage) }}
              </Badge>
            </template>
            <!-- Single stage: show stage type with best_of -->
            <Badge
              v-if="singleStageType"
              variant="outline"
              class="text-xs shrink-0"
            >
              {{ singleStageTypeWithBestOf }}
            </Badge>
          </div>

          <!-- Description -->
          <p
            v-if="tournament.description"
            class="text-sm text-muted-foreground line-clamp-2"
          >
            {{ tournament.description }}
          </p>
        </div>

        <div class="flex items-center gap-3 flex-shrink-0">
          <Badge variant="outline" class="text-xs">
            {{ tournament.e_tournament_status.description }}
          </Badge>
          <div class="text-sm text-muted-foreground">
            <TimeAgo :date="tournament.start"></TimeAgo>
          </div>
        </div>
      </div>

      <!-- Map Pool and Teams Info -->
      <div
        class="flex items-center justify-between gap-4 pt-2 border-t border-border/50"
      >
        <!-- Map Pool -->
        <div class="flex-1 min-w-0">
          <div
            v-if="
              tournament.options?.map_pool &&
              tournament.options.map_pool.maps?.length > 0
            "
            class="flex flex-wrap gap-2 items-center"
          >
            <span
              class="text-xs text-muted-foreground uppercase tracking-wide shrink-0"
            >
              Maps:
            </span>
            <div class="flex flex-wrap gap-2">
              <MiniMapDisplay :map="map" v-for="map in tournament.options.map_pool.maps" :key="map.id" />
            </div>
          </div>
        </div>

        <!-- Teams Count -->
        <div
          class="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0"
        >
          <UsersIcon class="h-4 w-4" />
          <span>
            {{ tournament.teams_aggregate?.aggregate?.count || 0 }}
            {{ $t("tournament.table.teams_joined") }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  computed: {
    stageCount() {
      return this.tournament?.stages?.length || 0;
    },
    singleStageType() {
      if (
        this.stageCount === 1 &&
        this.tournament?.stages?.[0]?.e_tournament_stage_type
      ) {
        return this.tournament.stages[0].e_tournament_stage_type.description;
      }
      return null;
    },
    singleStageTypeWithBestOf() {
      if (!this.singleStageType) return null;

      const stage = this.tournament?.stages?.[0];
      if (!stage) return this.singleStageType;

      // Get best_of from stage options, or fall back to tournament defaults
      let bestOf: number | null = null;
      if (stage.options?.best_of) {
        bestOf = stage.options.best_of;
      } else if (this.tournament?.options?.best_of) {
        bestOf = this.tournament.options.best_of;
      }

      if (bestOf) {
        return `${this.singleStageType} - BO${bestOf}`;
      }

      return this.singleStageType;
    },
    sortedStages() {
      if (!this.tournament?.stages) return [];
      return [...this.tournament.stages].sort((a: any, b: any) => {
        return (a.order || 0) - (b.order || 0);
      });
    },
  },
  methods: {
    navigateToTournament(tournamentId: string, event?: Event) {
      if (event) {
        event.stopPropagation();
      }
      this.$router.push({
        name: "tournaments-tournamentId",
        params: { tournamentId },
      });
    },
    getStageLabel(stage: any): string {
      const stageType =
        stage.e_tournament_stage_type?.description || `Stage ${stage.order}`;

      // Get best_of from stage options, or fall back to tournament defaults
      let bestOf: number | null = null;
      if (stage.options?.best_of) {
        bestOf = stage.options.best_of;
      } else if (this.tournament?.options?.best_of) {
        bestOf = this.tournament.options.best_of;
      }

      if (bestOf) {
        return `${stageType} - BO${bestOf}`;
      }

      return stageType;
    },
  },
};
</script>
