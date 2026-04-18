<script lang="ts" setup>
import { computed } from "vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { e_veto_pick_types_enum } from "~/generated/zeus";

type Veto = {
  side?: string | null;
  type?: string | null;
  match_lineup_id?: string | null;
};

type MatchMap = {
  map?: { name?: string | null; label?: string | null } | null;
  lineup_1_score?: number | null;
  lineup_2_score?: number | null;
  winning_lineup_id?: string | null;
  vetos?: Veto[];
};

type Lineup = { id?: string; name?: string | null };

const props = defineProps<{
  match: {
    options?: { best_of?: number };
    winning_lineup_id?: string | null;
    lineup_1?: Lineup;
    lineup_2?: Lineup;
    lineup_1_id?: string;
    lineup_2_id?: string;
    match_maps?: MatchMap[];
  };
}>();

type DotStatus = "completed" | "current" | "not_started" | "unused";

type Dot = {
  status: DotStatus;
  matchMap?: MatchMap;
  index: number;
};

const dots = computed<Dot[]>(() => {
  const bestOf = props.match.options?.best_of || 0;
  const maps = props.match.match_maps || [];
  const matchOver = !!props.match.winning_lineup_id;
  const result: Dot[] = [];
  let foundCurrent = false;

  for (let i = 0; i < bestOf; i++) {
    const matchMap = maps[i];
    let status: DotStatus;
    if (matchMap?.winning_lineup_id) {
      status = "completed";
    } else if (matchOver) {
      status = "unused";
    } else if (matchMap && !foundCurrent) {
      status = "current";
      foundCurrent = true;
    } else {
      status = "not_started";
    }
    result.push({ status, matchMap, index: i });
  }
  return result;
});

const mapDisplayName = (dot: Dot) =>
  dot.matchMap?.map?.label || dot.matchMap?.map?.name || `Map ${dot.index + 1}`;

const statusLabel = (status: DotStatus) => {
  switch (status) {
    case "completed":
      return "COMPLETE";
    case "current":
      return "LIVE";
    case "unused":
      return "UNPLAYED";
    default:
      return "UPCOMING";
  }
};

const lineupName = (id?: string | null) => {
  if (!id) return null;
  if (id === props.match.lineup_1_id) return props.match.lineup_1?.name;
  if (id === props.match.lineup_2_id) return props.match.lineup_2?.name;
  return null;
};

const pickedBy = (matchMap?: MatchMap) => {
  if (!matchMap?.vetos?.length) return null;
  const decider = matchMap.vetos.find(
    (v) => v.type === e_veto_pick_types_enum.Decider,
  );
  if (decider) return "Decider";
  const pick = matchMap.vetos.find(
    (v) => v.type === e_veto_pick_types_enum.Pick,
  );
  return lineupName(pick?.match_lineup_id);
};

const showScoreFor = (status: DotStatus) =>
  status === "completed" || status === "current";

const dotClass = (status: DotStatus) => {
  switch (status) {
    case "current":
      return "bg-[hsl(142_71%_55%)] shadow-[0_0_8px_hsl(142_71%_55%/0.6)]";
    case "completed":
      return "bg-white";
    case "unused":
      return "bg-gray-500 opacity-30";
    default:
      return "bg-gray-400";
  }
};

const statusAccent = (status: DotStatus) => {
  switch (status) {
    case "current":
      return "text-[hsl(142_71%_60%)] bg-[hsl(142_71%_40%/0.12)]";
    case "completed":
      return "text-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)]";
    case "unused":
      return "text-muted-foreground bg-muted/30";
    default:
      return "text-muted-foreground bg-muted/30";
  }
};

const tooltipShadow = (status: DotStatus) => {
  switch (status) {
    case "current":
      return "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_0_0_1px_hsl(142_71%_50%/0.2),0_2px_4px_hsl(0_0%_0%/0.4),0_12px_28px_-8px_hsl(0_0%_0%/0.85),0_30px_70px_-20px_hsl(0_0%_0%/0.95),0_0_50px_-12px_hsl(142_71%_45%/0.35)]";
    case "completed":
      return "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_0_0_1px_hsl(var(--tac-amber)/0.2),0_2px_4px_hsl(0_0%_0%/0.4),0_12px_28px_-8px_hsl(0_0%_0%/0.85),0_30px_70px_-20px_hsl(0_0%_0%/0.95),0_0_50px_-12px_hsl(var(--tac-amber)/0.35)]";
    default:
      return "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_0_0_1px_hsl(240_6%_30%/0.4),0_2px_4px_hsl(0_0%_0%/0.4),0_12px_28px_-8px_hsl(0_0%_0%/0.85),0_30px_70px_-20px_hsl(0_0%_0%/0.95)]";
  }
};

const labelClass =
  "text-[8.5px] tracking-[0.2em] uppercase text-muted-foreground/85 font-semibold leading-none";
const monoNum = "font-mono tabular-nums tracking-[0.01em]";
</script>

<template>
  <div class="flex gap-1.5 items-center justify-end w-16 shrink-0">
    <TooltipProvider v-for="dot in dots" :key="dot.index" :delay-duration="120">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="inline-block w-2 h-2 rounded-full cursor-help transition-all duration-150 hover:-translate-y-px hover:scale-125"
            :class="dotClass(dot.status)"
            @click.stop
            @mousedown.stop
          />
        </TooltipTrigger>

        <TooltipContent
          side="bottom"
          align="center"
          :side-offset="10"
          :avoid-collisions="true"
          :collision-padding="12"
          :class="[
            '!p-0 !rounded-none overflow-visible relative',
            'w-[280px] max-w-[calc(100vw-32px)]',
            `bg-[hsl(240_8%_11%)] text-[hsl(var(--popover-foreground))]`,
            `font-['Oxanium',sans-serif]`,
            'border border-[hsl(240_6%_22%)]',
            tooltipShadow(dot.status),
            'animate-[map-dot-readout-in_180ms_cubic-bezier(0.2,0.8,0.2,1)]',
          ]"
        >
          <div
            :class="[
              'relative px-[14px] pt-[14px] pb-[12px]',
              `[background-image:radial-gradient(circle_at_top_right,hsl(var(--tac-amber)/0.14)_0%,transparent_55%),linear-gradient(180deg,hsl(0_0%_100%/0.035)_0%,transparent_55%)]`,
            ]"
          >
            <!-- Corner ticks -->
            <span
              class="absolute top-1 left-1 w-[8px] h-[8px] border-t-[1.5px] border-l-[1.5px] border-[hsl(var(--tac-amber))] pointer-events-none"
              aria-hidden="true"
            />
            <span
              class="absolute top-1 right-1 w-[8px] h-[8px] border-t-[1.5px] border-r-[1.5px] border-[hsl(var(--tac-amber))] pointer-events-none"
              aria-hidden="true"
            />
            <span
              class="absolute bottom-1 left-1 w-[8px] h-[8px] border-b-[1.5px] border-l-[1.5px] border-[hsl(var(--tac-amber))] pointer-events-none"
              aria-hidden="true"
            />
            <span
              class="absolute bottom-1 right-1 w-[8px] h-[8px] border-b-[1.5px] border-r-[1.5px] border-[hsl(var(--tac-amber))] pointer-events-none"
              aria-hidden="true"
            />

            <!-- Scanline overlay -->
            <span
              class="absolute inset-0 pointer-events-none mix-blend-overlay opacity-70 [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_3px,hsl(0_0%_100%/0.015)_3px,hsl(0_0%_100%/0.015)_4px)]"
              aria-hidden="true"
            />

            <!-- Header band -->
            <header
              class="relative flex items-center justify-between mb-2 pb-2 border-b border-border"
            >
              <span
                class="inline-flex items-center gap-1.5 text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium"
              >
                <span class="text-[9px] text-[hsl(var(--tac-amber))]">◢</span>
                <span>MAP {{ dot.index + 1 }}</span>
              </span>
              <span
                :class="[
                  'text-[10px] tracking-[0.22em] uppercase font-extrabold px-2 py-0.5 border border-current rounded-[2px]',
                  statusAccent(dot.status),
                ]"
              >
                {{ statusLabel(dot.status) }}
              </span>
            </header>

            <!-- Map name -->
            <div class="relative mb-2">
              <span
                :class="[
                  monoNum,
                  'font-semibold text-[15px] leading-none text-foreground',
                ]"
              >
                {{ mapDisplayName(dot) }}
              </span>
            </div>

            <!-- Score section -->
            <section
              v-if="showScoreFor(dot.status) && dot.matchMap"
              class="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 py-2 bg-muted/35 border border-border/70 mb-2"
            >
              <div class="flex flex-col gap-0.5 min-w-0">
                <span :class="labelClass">TEAM 1</span>
                <span
                  :class="[
                    monoNum,
                    'font-semibold text-[11px] text-foreground truncate',
                  ]"
                >
                  {{ match.lineup_1?.name || "Team 1" }}
                </span>
              </div>
              <div
                :class="[
                  monoNum,
                  'font-extrabold text-[18px] leading-none whitespace-nowrap text-foreground',
                ]"
              >
                {{ dot.matchMap.lineup_1_score ?? 0
                }}<span class="mx-1 text-muted-foreground">–</span
                >{{ dot.matchMap.lineup_2_score ?? 0 }}
              </div>
              <div class="flex flex-col gap-0.5 min-w-0 text-right">
                <span :class="labelClass">TEAM 2</span>
                <span
                  :class="[
                    monoNum,
                    'font-semibold text-[11px] text-foreground truncate',
                  ]"
                >
                  {{ match.lineup_2?.name || "Team 2" }}
                </span>
              </div>
            </section>

            <!-- Meta grid -->
            <section
              class="relative grid grid-cols-2 gap-px bg-border/60 border border-border/60"
            >
              <div class="flex flex-col gap-0.5 px-2 py-1.5 bg-card/80">
                <span :class="labelClass">PICK</span>
                <span
                  :class="[
                    monoNum,
                    'font-semibold text-[11px] text-foreground truncate',
                  ]"
                >
                  {{ pickedBy(dot.matchMap) || "—" }}
                </span>
              </div>
              <div class="flex flex-col gap-0.5 px-2 py-1.5 bg-card/80">
                <span :class="labelClass">WINNER</span>
                <span
                  v-if="dot.status === 'completed'"
                  :class="[
                    monoNum,
                    'font-bold text-[11px] text-[hsl(142_71%_60%)] truncate',
                  ]"
                >
                  {{ lineupName(dot.matchMap?.winning_lineup_id) || "—" }}
                </span>
                <span
                  v-else
                  :class="[
                    monoNum,
                    'font-semibold text-[11px] text-muted-foreground',
                  ]"
                >
                  —
                </span>
              </div>
            </section>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<style>
@keyframes map-dot-readout-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
