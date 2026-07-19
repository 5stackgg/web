<script setup lang="ts">
import { UsersIcon } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import MiniMapDisplay from "~/components/MinIMapDisplay.vue";
import { Badge } from "~/components/ui/badge";
</script>

<template>
  <div
    class="group cursor-pointer rounded-lg border border-border bg-muted/30 transition-[border-color,transform,background-color] duration-200 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.4)] hover:bg-muted/20"
    @click="navigateToTournament(tournament.id, $event)"
  >
    <div class="flex gap-3 p-3 sm:gap-4 sm:p-4">
      <!-- Leading media: banner (or deterministic gradient) with logo overlay -->
      <div
        class="relative hidden h-[76px] w-[132px] shrink-0 overflow-hidden rounded-md border border-border sm:block"
      >
        <img
          v-if="bannerUrl"
          :src="bannerUrl"
          :alt="tournament.name"
          class="absolute inset-0 h-full w-full object-cover"
        />
        <div
          v-else
          class="absolute inset-0"
          :style="{ background: fallbackGradient }"
        ></div>
        <div class="absolute inset-0 bg-black/30"></div>
        <img
          v-if="logoUrl"
          :src="logoUrl"
          :alt="tournament.name"
          class="absolute bottom-1 left-1 h-8 w-8 rounded border border-white/20 bg-black/50 object-contain backdrop-blur-sm"
        />
      </div>

      <!-- Content -->
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <img
              v-if="logoUrl"
              :src="logoUrl"
              :alt="tournament.name"
              class="mb-1.5 h-9 w-9 rounded-md border border-border bg-muted/30 object-contain sm:hidden"
            />
            <h3
              class="truncate text-base font-semibold text-foreground sm:text-lg"
            >
              {{ tournament.name }}
            </h3>
            <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" class="shrink-0 text-xs">
                {{ tournament.options.type }}
              </Badge>
              <template v-if="stageCount > 1">
                <Badge
                  v-for="stage in sortedStages"
                  :key="stage.id"
                  variant="outline"
                  class="shrink-0 text-xs"
                >
                  {{ getStageLabel(stage) }}
                </Badge>
              </template>
              <Badge
                v-if="singleStageType"
                variant="outline"
                class="shrink-0 text-xs"
              >
                {{ singleStageTypeWithBestOf }}
              </Badge>
              <Badge
                v-for="category in categories"
                :key="category.category"
                variant="outline"
                class="shrink-0 text-xs"
              >
                {{
                  category.e_tournament_category?.description ??
                  category.category
                }}
              </Badge>
            </div>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" class="text-xs">
              {{ tournament.e_tournament_status.description }}
            </Badge>
            <div class="text-xs text-muted-foreground">
              <TimeAgo :date="tournament.start"></TimeAgo>
            </div>
          </div>
        </div>

        <!-- Map Pool and Teams Info -->
        <div
          class="mt-auto flex items-center justify-between gap-4 border-t border-border/50 pt-2"
        >
          <div class="min-w-0 flex-1">
            <div
              v-if="
                tournament.options?.map_pool &&
                tournament.options.map_pool.maps?.length > 0
              "
              class="flex flex-wrap items-center gap-2"
            >
              <span
                class="shrink-0 text-xs uppercase tracking-wide text-muted-foreground"
              >
                {{ $t("tournament.table.maps_label") }}
              </span>
              <div class="flex flex-wrap gap-2">
                <MiniMapDisplay
                  :map="map"
                  v-for="map in tournament.options.map_pool.maps"
                  :key="map.id"
                />
              </div>
            </div>
          </div>

          <div
            class="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
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
    logoUrl() {
      const logo = this.tournament?.logo;
      if (!logo) {
        return null;
      }

      return `https://${useRuntimeConfig().public.apiDomain}/${logo}`;
    },
    bannerUrl() {
      const banner = this.tournament?.banner;
      if (!banner) {
        return null;
      }

      return `https://${useRuntimeConfig().public.apiDomain}/${banner}`;
    },
    categories() {
      return this.tournament?.categories || [];
    },
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
