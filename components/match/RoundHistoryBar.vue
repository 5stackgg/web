<script lang="ts" setup>
import { computed } from "vue";
import { Bomb, Skull, Wrench, Clock } from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { e_sides_enum, e_winning_reasons_enum } from "~/generated/zeus";

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
  seamless?: boolean;
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

const currentSides = computed(() => {
  const last = chronologicalRounds.value[chronologicalRounds.value.length - 1];
  return {
    lineup1: last?.lineup_1_side ?? null,
    lineup2: last?.lineup_2_side ?? null,
  };
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

function sideTextClass(side?: e_sides_enum | null) {
  if (side === e_sides_enum.CT) return "text-sky-300";
  if (side === e_sides_enum.TERRORIST) return "text-amber-300";
  return "text-muted-foreground";
}

function sideDotClass(side?: e_sides_enum | null) {
  if (side === e_sides_enum.CT)
    return "bg-sky-400 shadow-[0_0_6px_theme(colors.sky.400)]";
  if (side === e_sides_enum.TERRORIST)
    return "bg-amber-400 shadow-[0_0_6px_theme(colors.amber.400)]";
  return "bg-muted-foreground/40";
}

function cellClass(round: Round, isLineup1: boolean) {
  const lineupSide = isLineup1 ? round.lineup_1_side : round.lineup_2_side;
  const won = lineupSide && round.winning_side === lineupSide;
  if (!won) {
    return "bg-black/30 ring-1 ring-inset ring-border/30";
  }
  if (round.winning_side === e_sides_enum.CT) {
    return "bg-sky-500/15 ring-1 ring-inset ring-sky-400/50 shadow-[inset_0_-2px_0_0_theme(colors.sky.400)]";
  }
  return "bg-amber-500/15 ring-1 ring-inset ring-amber-400/50 shadow-[inset_0_-2px_0_0_theme(colors.amber.400)]";
}

function lineupWonRound(round: Round, isLineup1: boolean) {
  const lineupSide = isLineup1 ? round.lineup_1_side : round.lineup_2_side;
  return Boolean(lineupSide && round.winning_side === lineupSide);
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
  <div
    v-if="chronologicalRounds.length > 0"
    :class="[
      'round-history relative',
      seamless
        ? ''
        : 'rounded-md border border-border/50 bg-gradient-to-b from-background/70 to-background/20',
      seamless ? '' : compact ? 'p-1.5' : 'p-2.5',
    ]"
  >
    <div
      :class="[
        'flex items-center justify-between mb-3 uppercase tracking-[0.2em] text-muted-foreground',
        compact ? 'text-[9px]' : 'text-[10px]',
      ]"
    >
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-1 h-1 rounded-full bg-primary/70" />
        {{ $t("match.round_history") }}
      </span>
      <span class="font-mono tabular-nums text-muted-foreground/60">
        {{ chronologicalRounds.length }}
      </span>
    </div>

    <div class="relative flex items-stretch gap-4 py-1">
      <div
        class="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border/60 -translate-y-1/2"
      />
      <div
        :class="[
          'relative flex flex-col shrink-0 items-stretch py-0.5 gap-[6px]',
          compact ? 'w-[3.75rem]' : 'w-[5rem]',
        ]"
      >
        <div
          :class="['flex items-center gap-1.5', compact ? 'h-[18px]' : 'h-6']"
        >
          <span
            :class="[
              'inline-block w-1.5 h-1.5 rounded-full shrink-0',
              sideDotClass(currentSides.lineup1),
            ]"
          />
          <span
            :class="[
              'font-bold uppercase tracking-wider truncate leading-none',
              compact ? 'text-[9px]' : 'text-[10px]',
              sideTextClass(currentSides.lineup1),
            ]"
          >
            {{ match.lineup_1.name }}
          </span>
        </div>
        <div class="flex items-center justify-end">
          <span
            :class="[
              'relative z-10 font-mono tabular-nums leading-none text-muted-foreground/60 bg-card border border-border/60 rounded-sm',
              compact
                ? 'text-[8px] px-1 py-[1px]'
                : 'text-[9px] px-1.5 py-[2px]',
            ]"
          >
            RD
          </span>
        </div>
        <div
          :class="['flex items-center gap-1.5', compact ? 'h-[18px]' : 'h-6']"
        >
          <span
            :class="[
              'inline-block w-1.5 h-1.5 rounded-full shrink-0',
              sideDotClass(currentSides.lineup2),
            ]"
          />
          <span
            :class="[
              'font-bold uppercase tracking-wider truncate leading-none',
              compact ? 'text-[9px]' : 'text-[10px]',
              sideTextClass(currentSides.lineup2),
            ]"
          >
            {{ match.lineup_2.name }}
          </span>
        </div>
      </div>

      <div class="relative min-w-0 overflow-x-auto round-history__scroll pb-2">
        <div class="flex items-stretch gap-[4px] w-max py-0.5">
          <template
            v-for="(round, index) in chronologicalRounds"
            :key="round.round"
          >
            <div
              v-if="halftimeIndex > 0 && index === halftimeIndex"
              class="flex flex-col items-center justify-center px-1"
            >
              <span
                class="text-[8px] font-mono tracking-[0.3em] text-muted-foreground/70 uppercase rotate-180"
                style="writing-mode: vertical-rl"
              >
                HALF
              </span>
            </div>

            <Tooltip :delay-duration="400">
              <TooltipTrigger as-child>
                <div
                  class="flex flex-col items-center gap-[6px] cursor-help group"
                >
                  <div
                    :class="[
                      'flex items-center justify-center rounded-[3px] transition-transform group-hover:scale-110',
                      compact ? 'w-[18px] h-[18px]' : 'w-6 h-6',
                      cellClass(round, true),
                    ]"
                  >
                    <component
                      v-if="lineupWonRound(round, true)"
                      :is="iconFor(round.winning_reason)"
                      :class="[
                        sideTextClass(round.winning_side),
                        compact ? 'w-3 h-3' : 'w-3.5 h-3.5',
                      ]"
                      :stroke-width="2.25"
                    />
                  </div>
                  <span
                    :class="[
                      'relative z-10 font-mono tabular-nums leading-none text-muted-foreground/80 bg-card border border-border/60 rounded-sm',
                      compact
                        ? 'text-[9px] px-1 py-[1px]'
                        : 'text-[10px] px-1.5 py-[2px]',
                    ]"
                  >
                    {{ String(round.round).padStart(2, "0") }}
                  </span>
                  <div
                    :class="[
                      'flex items-center justify-center rounded-[3px] transition-transform group-hover:scale-110',
                      compact ? 'w-[18px] h-[18px]' : 'w-6 h-6',
                      cellClass(round, false),
                    ]"
                  >
                    <component
                      v-if="lineupWonRound(round, false)"
                      :is="iconFor(round.winning_reason)"
                      :class="[
                        sideTextClass(round.winning_side),
                        compact ? 'w-3 h-3' : 'w-3.5 h-3.5',
                      ]"
                      :stroke-width="2.25"
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent
                class="font-mono !bg-zinc-950 !text-zinc-100 border border-zinc-800 shadow-lg"
              >
                <div class="flex flex-col gap-0.5 text-xs">
                  <span
                    class="uppercase tracking-widest text-zinc-500 text-[10px]"
                  >
                    {{ $t("common.round", { number: round.round }) }}
                  </span>
                  <span
                    v-if="winnerName(round)"
                    :class="['font-bold', sideTextClass(round.winning_side)]"
                  >
                    {{ winnerName(round) }}
                  </span>
                  <span class="text-zinc-400">
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
.round-history::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background-image: linear-gradient(
    to right,
    transparent 0,
    transparent calc(100% - 1px),
    hsl(var(--border) / 0.4) calc(100% - 1px)
  );
  background-size: 6px 100%;
  opacity: 0.15;
  mask-image: linear-gradient(
    to bottom,
    transparent,
    black 30%,
    black 70%,
    transparent
  );
}

.round-history__scroll {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}
.round-history__scroll::-webkit-scrollbar {
  height: 4px;
}
.round-history__scroll::-webkit-scrollbar-track {
  background: transparent;
}
.round-history__scroll::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 2px;
}
.round-history__scroll::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--muted-foreground));
}
</style>
