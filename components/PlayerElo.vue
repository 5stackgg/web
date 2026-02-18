<script lang="ts" setup>
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "~/components/ui/hover-card";
import { Separator } from "~/components/ui/separator";
import { ChevronUpIcon } from "lucide-vue-next";
</script>

<template>
  <HoverCard v-if="hasAnyElo">
    <HoverCardTrigger as-child>
      <div
        class="inline-flex items-center gap-1 rounded-md cursor-default transition-colors hover:bg-muted"
      >
        <!-- Primary ELO -->
        <span
          :class="getEloColorClass(primaryElo)"
          class="text-sm font-semibold"
        >
          {{ primaryElo ?? "-" }}
        </span>

        <!-- Indicator if more ranks exist -->
        <ChevronUpIcon
          v-if="hasMultipleElos"
          class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5"
        />
      </div>
    </HoverCardTrigger>

    <!-- Hover Content -->
    <HoverCardContent class="w-64">
      <div class="space-y-3 text-sm">
        <!-- Season ELO Section -->
        <div v-if="hasSeasonElo">
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Season ELO</p>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Competitive</span>
              <span
                v-if="competitiveElo"
                class="font-mono font-semibold"
                :class="getEloColorClass(competitiveElo)"
              >
                {{ competitiveElo }}
              </span>
              <span v-else class="text-muted-foreground">&mdash;</span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Duel</span>
              <span
                v-if="duelElo"
                class="font-mono font-semibold"
                :class="getEloColorClass(duelElo)"
              >
                {{ duelElo }}
              </span>
              <span v-else class="text-muted-foreground">&mdash;</span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Wingman</span>
              <span
                v-if="wingmanElo"
                class="font-mono font-semibold"
                :class="getEloColorClass(wingmanElo)"
              >
                {{ wingmanElo }}
              </span>
              <span v-else class="text-muted-foreground">&mdash;</span>
            </div>
          </div>
        </div>

        <Separator v-if="hasSeasonElo && hasTournamentElo" />

        <!-- Tournament ELO Section -->
        <div v-if="hasTournamentElo">
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tournament ELO</p>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Competitive</span>
              <span
                v-if="tournamentCompetitiveElo"
                class="font-mono font-semibold"
                :class="getEloColorClass(tournamentCompetitiveElo)"
              >
                {{ tournamentCompetitiveElo }}
              </span>
              <span v-else class="text-muted-foreground">&mdash;</span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Duel</span>
              <span
                v-if="tournamentDuelElo"
                class="font-mono font-semibold"
                :class="getEloColorClass(tournamentDuelElo)"
              >
                {{ tournamentDuelElo }}
              </span>
              <span v-else class="text-muted-foreground">&mdash;</span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Wingman</span>
              <span
                v-if="tournamentWingmanElo"
                class="font-mono font-semibold"
                :class="getEloColorClass(tournamentWingmanElo)"
              >
                {{ tournamentWingmanElo }}
              </span>
              <span v-else class="text-muted-foreground">&mdash;</span>
            </div>
          </div>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>

  <span v-else class="text-sm text-muted-foreground">-</span>
</template>
<script lang="ts">
export default {
  props: {
    elo: {
      type: Object as () => {
        competitive?: number;
        wingman?: number;
        duel?: number;
        tournament_competitive?: number;
        tournament_wingman?: number;
        tournament_duel?: number;
      },
      required: false,
    },
    type: {
      type: String,
      required: false,
      default: "competitive",
    },
  },
  computed: {
    competitiveElo(): number | undefined {
      return this.elo?.competitive;
    },
    wingmanElo(): number | undefined {
      return this.elo?.wingman;
    },
    duelElo(): number | undefined {
      return this.elo?.duel;
    },
    tournamentCompetitiveElo(): number | undefined {
      return this.elo?.tournament_competitive;
    },
    tournamentWingmanElo(): number | undefined {
      return this.elo?.tournament_wingman;
    },
    tournamentDuelElo(): number | undefined {
      return this.elo?.tournament_duel;
    },
    hasSeasonElo(): boolean {
      return !!(this.competitiveElo || this.wingmanElo || this.duelElo);
    },
    hasTournamentElo(): boolean {
      return !!(
        this.tournamentCompetitiveElo ||
        this.tournamentWingmanElo ||
        this.tournamentDuelElo
      );
    },
    hasAnyElo(): boolean {
      return this.hasSeasonElo || this.hasTournamentElo;
    },
    hasMultipleElos(): boolean {
      const count = [
        this.competitiveElo,
        this.wingmanElo,
        this.duelElo,
        this.tournamentCompetitiveElo,
        this.tournamentWingmanElo,
        this.tournamentDuelElo,
      ].filter(Boolean).length;
      return count > 1;
    },
    primaryElo(): number | undefined {
      // Season competitive first, then fall back to tournament competitive
      return this.competitiveElo || this.tournamentCompetitiveElo;
    },
  },
  methods: {
    getEloColorClass(elo: number): string {
      if (elo >= 30000) return "text-[#EB4B4B]";
      if (elo >= 25000) return "text-[#D22CE6]";
      if (elo >= 20000) return "text-[#FED700]";
      if (elo >= 15000) return "text-[#8846FF]";
      if (elo >= 10000) return "text-[#4B69FF]";
      if (elo >= 5000) return "text-[#5E98D7]";
      return "text-[#B1C3D9]";
    },
  },
};
</script>
