<script lang="ts" setup>
import { computed } from "vue";
import { Bomb, Skull, Wrench, Clock } from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  e_sides_enum,
  e_winning_reasons_enum,
} from "~/generated/zeus";

type Round = {
  round: number;
  winning_side?: e_sides_enum | null;
  winning_reason?: e_winning_reasons_enum | null;
  lineup_1_side?: e_sides_enum | null;
  lineup_2_side?: e_sides_enum | null;
};

const props = defineProps<{
  match: any;
  matchMap: any;
  compact?: boolean;
}>();

const chronologicalRounds = computed<Round[]>(() => {
  const rounds: Round[] = props.matchMap?.rounds ?? [];
  return rounds
    .filter((r) => r && r.round > 0 && r.winning_side != null)
    .slice()
    .sort((a, b) => a.round - b.round);
});

const halftimeIndex = computed(() => {
  const rounds = chronologicalRounds.value;
  for (let i = 1; i < rounds.length; i++) {
    if (rounds[i].lineup_1_side !== rounds[i - 1].lineup_1_side) {
      return i;
    }
  }
  return -1;
});

function iconFor(reason?: e_winning_reasons_enum | null) {
  switch (reason) {
    case e_winning_reasons_enum.BombExploded:
      return Bomb;
    case e_winning_reasons_enum.BombDefused:
      return Wrench;
    case e_winning_reasons_enum.TimeRanOut:
      return Clock;
    case e_winning_reasons_enum.CTsWin:
    case e_winning_reasons_enum.TerroristsWin:
      return Skull;
    default:
      return Skull;
  }
}

function sideColor(side?: e_sides_enum | null) {
  if (side === e_sides_enum.CT) return "text-blue-400";
  if (side === e_sides_enum.TERRORIST) return "text-yellow-500";
  return "text-muted-foreground";
}

function lineupWonRound(round: Round, isLineup1: boolean) {
  const lineupSide = isLineup1 ? round.lineup_1_side : round.lineup_2_side;
  return lineupSide && round.winning_side === lineupSide;
}

function reasonLabel(reason?: e_winning_reasons_enum | null) {
  switch (reason) {
    case e_winning_reasons_enum.BombExploded:
      return "Bomb Exploded";
    case e_winning_reasons_enum.BombDefused:
      return "Bomb Defused";
    case e_winning_reasons_enum.TimeRanOut:
      return "Time Ran Out";
    case e_winning_reasons_enum.CTsWin:
      return "CTs Eliminated Ts";
    case e_winning_reasons_enum.TerroristsWin:
      return "Ts Eliminated CTs";
    default:
      return "Unknown";
  }
}

function winnerName(round: Round) {
  if (round.lineup_1_side && round.winning_side === round.lineup_1_side) {
    return props.match.lineup_1?.name;
  }
  if (round.lineup_2_side && round.winning_side === round.lineup_2_side) {
    return props.match.lineup_2?.name;
  }
  return "";
}
</script>

<template>
  <div v-if="chronologicalRounds.length > 0" class="flex flex-col gap-1">
    <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
      {{ $t("match.round_history") }}
    </div>
    <div class="flex items-stretch gap-2">
      <div class="flex flex-col justify-between shrink-0 py-[2px]">
        <span
          v-for="lineup in [match.lineup_1, match.lineup_2]"
          :key="lineup.id"
          :class="[
            'font-bold uppercase truncate text-muted-foreground leading-none',
            compact ? 'text-[9px] max-w-[3rem]' : 'text-[10px] max-w-[4rem]',
          ]"
        >
          {{ lineup.name }}
        </span>
      </div>
      <div class="min-w-0 overflow-x-auto round-history-scroll">
        <div class="flex items-center gap-[2px] w-max">
          <template
            v-for="(round, index) in chronologicalRounds"
            :key="round.round"
          >
            <div
              v-if="halftimeIndex > 0 && index === halftimeIndex"
              :class="['w-px bg-border mx-1 self-stretch']"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <div class="flex flex-col items-center gap-[2px] cursor-help">
                  <div
                    :class="[
                      'flex items-center justify-center rounded-sm bg-background/40',
                      compact ? 'w-4 h-4' : 'w-5 h-5',
                    ]"
                  >
                    <component
                      v-if="lineupWonRound(round, true)"
                      :is="iconFor(round.winning_reason)"
                      :class="[
                        sideColor(round.winning_side),
                        compact ? 'w-3 h-3' : 'w-3.5 h-3.5',
                      ]"
                    />
                  </div>
                  <span
                    :class="[
                      'tabular-nums text-muted-foreground leading-none',
                      compact ? 'text-[8px]' : 'text-[9px]',
                    ]"
                  >
                    {{ round.round }}
                  </span>
                  <div
                    :class="[
                      'flex items-center justify-center rounded-sm bg-background/40',
                      compact ? 'w-4 h-4' : 'w-5 h-5',
                    ]"
                  >
                    <component
                      v-if="lineupWonRound(round, false)"
                      :is="iconFor(round.winning_reason)"
                      :class="[
                        sideColor(round.winning_side),
                        compact ? 'w-3 h-3' : 'w-3.5 h-3.5',
                      ]"
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div class="flex flex-col gap-0.5 text-xs">
                  <span class="font-semibold">
                    {{ $t("common.round", { number: round.round }) }}
                  </span>
                  <span v-if="winnerName(round)" :class="sideColor(round.winning_side)">
                    {{ winnerName(round) }}
                  </span>
                  <span class="text-muted-foreground">
                    {{ reasonLabel(round.winning_reason) }}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.round-history-scroll {
  scrollbar-width: thin;
}
.round-history-scroll::-webkit-scrollbar {
  height: 4px;
}
.round-history-scroll::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 2px;
}
</style>
