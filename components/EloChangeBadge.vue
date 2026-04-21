<script setup lang="ts">
import { computed } from "vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ArrowUpRight, ArrowDownRight } from "lucide-vue-next";

interface EloChange {
  elo_change?: number | string | null;
  current_elo?: number | string | null;
  updated_elo?: number | string | null;
  player_team_elo_avg?: number | string | null;
  opponent_team_elo_avg?: number | string | null;
  expected_score?: number | string | null;
  actual_score?: number | string | null;
  k_factor?: number | string | null;
  impact?: number | string | null;
  performance_multiplier?: number | string | null;
  series_multiplier?: number | string | null;
  map_wins?: number | string | null;
  map_losses?: number | string | null;
  kills?: number | string | null;
  deaths?: number | string | null;
  assists?: number | string | null;
  kda?: number | string | null;
  team_avg_kda?: number | string | null;
  damage?: number | string | null;
  damage_percent?: number | string | null;
  type?: string | null;
  match_result?: string | null;
}

const props = defineProps<{
  eloChange?: EloChange | null;
  size?: "xs" | "sm";
}>();

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const change = computed(() => toNum(props.eloChange?.elo_change));
const isWin = computed(() => change.value > 0);

const hasData = computed(
  () =>
    !!props.eloChange && Number.isFinite(change.value) && change.value !== 0,
);

const seriesMult = computed(() => toNum(props.eloChange?.series_multiplier));
const hasSeriesBonus = computed(() => seriesMult.value > 1);

const perfMult = computed(() => toNum(props.eloChange?.performance_multiplier));
const impact = computed(() => toNum(props.eloChange?.impact) || perfMult.value);
const impactDelta = computed(() => Math.round((impact.value - 1) * 100));
const expectedScore = computed(() => toNum(props.eloChange?.expected_score));
const actualScore = computed(() => toNum(props.eloChange?.actual_score));
const kFactor = computed(() => toNum(props.eloChange?.k_factor) || 500);

const currentElo = computed(() =>
  Math.round(toNum(props.eloChange?.current_elo)),
);
const updatedElo = computed(() =>
  Math.round(toNum(props.eloChange?.updated_elo)),
);

const playerTeamElo = computed(() =>
  Math.round(toNum(props.eloChange?.player_team_elo_avg)),
);
const opponentTeamElo = computed(() =>
  Math.round(toNum(props.eloChange?.opponent_team_elo_avg)),
);

const eloGapBar = computed(() => {
  const p = playerTeamElo.value;
  const o = opponentTeamElo.value;
  if (!p && !o) return 50;
  const diff = p - o;
  const clamped = Math.max(-3000, Math.min(3000, diff));
  return 50 + (clamped / 3000) * 50;
});

const damagePercent = computed(() =>
  Math.round(toNum(props.eloChange?.damage_percent) * 100),
);

function formatSigned(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString()}`;
}

function formatSignedPercent(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

// shared building blocks
const badgeBase =
  "inline-flex items-center gap-[3px] font-['Oxanium',sans-serif] font-bold tracking-[0.04em] tabular-nums rounded-[3px] border leading-none whitespace-nowrap cursor-help transition-all duration-150 hover:-translate-y-px";
const badgeSizeXs = "text-[10px] px-1.5 h-4";
const badgeSizeSm = "text-[10px] sm:text-xs px-2 py-0.5";
const winBadge =
  "text-[hsl(142_71%_55%)] border-[hsl(142_71%_55%/0.45)] [background:linear-gradient(180deg,hsl(142_71%_40%/0.18),hsl(142_71%_30%/0.08))] hover:border-[hsl(142_71%_60%/0.8)] hover:shadow-[0_0_0_1px_hsl(142_71%_55%/0.25),0_6px_16px_-6px_hsl(142_71%_45%/0.6)]";
const lossBadge =
  "text-[hsl(0_84%_66%)] border-[hsl(0_84%_66%/0.45)] [background:linear-gradient(180deg,hsl(0_84%_50%/0.18),hsl(0_84%_40%/0.08))] hover:border-[hsl(0_84%_66%/0.8)] hover:shadow-[0_0_0_1px_hsl(0_84%_66%/0.25),0_6px_16px_-6px_hsl(0_84%_50%/0.6)]";

const labelClass =
  "text-[8.5px] tracking-[0.2em] uppercase text-muted-foreground/85 font-semibold leading-none";

const monoNum = "font-mono tabular-nums tracking-[0.01em]";

const chipClipSm =
  "[clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)]";
</script>

<template>
  <TooltipProvider v-if="hasData && eloChange" :delay-duration="120">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          :class="[
            badgeBase,
            size === 'xs' ? badgeSizeXs : badgeSizeSm,
            isWin ? winBadge : lossBadge,
          ]"
          @click.stop
          @mousedown.stop
        >
          <span
            class="text-[0.7em] opacity-80 -translate-y-[0.5px]"
            aria-hidden="true"
          >
            {{ isWin ? "▲" : "▼" }}
          </span>
          <span class="font-bold">{{ formatSigned(change) }}</span>
          <span
            v-if="hasSeriesBonus"
            class="ml-[2px] pl-[5px] px-1 text-[0.75em] font-extrabold tracking-[0.08em] border-l border-current opacity-95"
            aria-hidden="true"
          >
            ×{{ seriesMult }}
          </span>
        </button>
      </TooltipTrigger>

      <TooltipContent
        side="right"
        align="center"
        :side-offset="10"
        :avoid-collisions="true"
        :collision-padding="12"
        :class="[
          '!p-0 !rounded-none overflow-visible relative',
          'w-[340px] max-w-[calc(100vw-32px)]',
          'bg-[hsl(240_8%_11%)] text-[hsl(var(--popover-foreground))]',
          'font-[\'Oxanium\',sans-serif]',
          'border border-[hsl(240_6%_22%)]',
          isWin
            ? 'shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_0_0_1px_hsl(142_71%_50%/0.2),0_2px_4px_hsl(0_0%_0%/0.4),0_12px_28px_-8px_hsl(0_0%_0%/0.85),0_30px_70px_-20px_hsl(0_0%_0%/0.95),0_0_50px_-12px_hsl(142_71%_45%/0.35)]'
            : 'shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_0_0_1px_hsl(0_84%_60%/0.2),0_2px_4px_hsl(0_0%_0%/0.4),0_12px_28px_-8px_hsl(0_0%_0%/0.85),0_30px_70px_-20px_hsl(0_0%_0%/0.95),0_0_50px_-12px_hsl(0_84%_50%/0.35)]',
          'animate-[elo-readout-in_180ms_cubic-bezier(0.2,0.8,0.2,1)]',
        ]"
      >
        <div
          :data-result="isWin ? 'win' : 'loss'"
          :class="[
            'relative px-[18px] pt-[18px] pb-[14px]',
            '[background-image:radial-gradient(circle_at_top_right,hsl(var(--tac-amber)/0.14)_0%,transparent_55%),linear-gradient(180deg,hsl(0_0%_100%/0.035)_0%,transparent_55%)]',
          ]"
        >
          <!-- Corner ticks -->
          <span
            class="absolute top-1 left-1 w-[10px] h-[10px] border-t-[1.5px] border-l-[1.5px] border-[hsl(var(--tac-amber))] pointer-events-none"
            aria-hidden="true"
          />
          <span
            class="absolute top-1 right-1 w-[10px] h-[10px] border-t-[1.5px] border-r-[1.5px] border-[hsl(var(--tac-amber))] pointer-events-none"
            aria-hidden="true"
          />
          <span
            class="absolute bottom-1 left-1 w-[10px] h-[10px] border-b-[1.5px] border-l-[1.5px] border-[hsl(var(--tac-amber))] pointer-events-none"
            aria-hidden="true"
          />
          <span
            class="absolute bottom-1 right-1 w-[10px] h-[10px] border-b-[1.5px] border-r-[1.5px] border-[hsl(var(--tac-amber))] pointer-events-none"
            aria-hidden="true"
          />

          <!-- Scanline overlay -->
          <span
            class="absolute inset-0 pointer-events-none mix-blend-overlay opacity-70 [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_3px,hsl(0_0%_100%/0.015)_3px,hsl(0_0%_100%/0.015)_4px)]"
            aria-hidden="true"
          />

          <!-- Header band -->
          <header
            class="relative flex items-center justify-between mb-2.5 pb-2 border-b border-border"
          >
            <span
              class="inline-flex items-center gap-1.5 text-[10px] tracking-[0.22em] uppercase text-muted-foreground font-medium"
            >
              <span class="text-[9px] text-[hsl(var(--tac-amber))]">◢</span>
              <span>{{ $t("match.elo_details.title") }}</span>
            </span>
            <span
              :class="[
                'text-[10px] tracking-[0.22em] uppercase font-extrabold px-2 py-0.5 border border-current rounded-[2px]',
                isWin
                  ? 'text-[hsl(142_71%_60%)] bg-[hsl(142_71%_40%/0.12)]'
                  : 'text-[hsl(0_84%_66%)] bg-[hsl(0_84%_50%/0.12)]',
              ]"
            >
              {{ isWin ? "WIN" : "LOSS" }}
            </span>
          </header>

          <!-- Hero: before → after, giant delta -->
          <section
            class="relative grid grid-cols-[1fr_auto] gap-2.5 items-stretch mb-2.5"
          >
            <div
              class="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2.5 py-2 bg-muted/35 border border-border/70"
            >
              <div class="flex flex-col gap-0.5 min-w-0">
                <span :class="labelClass">CURRENT</span>
                <span
                  :class="[
                    monoNum,
                    'font-semibold text-[15px] leading-none text-foreground',
                  ]"
                >
                  {{ currentElo.toLocaleString() }}
                </span>
              </div>
              <component
                :is="isWin ? ArrowUpRight : ArrowDownRight"
                class="w-3.5 h-3.5 text-[hsl(var(--tac-amber))]"
                stroke-width="2.5"
              />
              <div class="flex flex-col gap-0.5 min-w-0 text-right">
                <span :class="labelClass">UPDATED</span>
                <span
                  :class="[
                    monoNum,
                    'font-semibold text-[15px] leading-none text-foreground',
                  ]"
                >
                  {{ updatedElo.toLocaleString() }}
                </span>
              </div>
            </div>

            <div
              :class="[
                'flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 min-w-[62px] border rounded-[2px]',
                isWin
                  ? 'text-[hsl(142_71%_60%)] border-[hsl(142_71%_55%/0.55)] [background:linear-gradient(180deg,hsl(142_71%_45%/0.2),hsl(142_71%_30%/0.08))]'
                  : 'text-[hsl(0_84%_66%)] border-[hsl(0_84%_66%/0.55)] [background:linear-gradient(180deg,hsl(0_84%_55%/0.2),hsl(0_84%_40%/0.08))]',
              ]"
            >
              <span
                class="text-[8.5px] tracking-[0.22em] uppercase opacity-80 font-semibold"
              >
                Δ ELO
              </span>
              <span
                :class="[monoNum, 'font-extrabold text-[18px] leading-none']"
              >
                {{ formatSigned(change) }}
              </span>
            </div>
          </section>

          <!-- Series multiplier callout -->
          <section
            v-if="hasSeriesBonus"
            :class="[
              'relative flex items-center justify-between gap-2.5 px-2.5 py-1.5 mb-2.5 overflow-hidden',
              'border border-[hsl(var(--tac-amber)/0.45)]',
              '[background:linear-gradient(135deg,hsl(var(--tac-amber)/0.14)_0%,hsl(var(--tac-amber)/0.04)_100%)]',
              chipClipSm,
            ]"
          >
            <span
              class="absolute inset-0 pointer-events-none [background:linear-gradient(90deg,transparent_0%,hsl(var(--tac-amber)/0.18)_50%,transparent_100%)] -translate-x-full animate-[elo-series-sweep_2.4s_ease-in-out_infinite]"
              aria-hidden="true"
            />
            <div class="relative flex flex-col gap-0.5">
              <span :class="labelClass">SERIES MULTIPLIER</span>
              <span
                :class="[
                  monoNum,
                  'font-extrabold text-[20px] leading-none text-[hsl(var(--tac-amber))] [text-shadow:0_0_18px_hsl(var(--tac-amber)/0.4)]',
                ]"
              >
                ×{{ seriesMult }}
              </span>
            </div>
            <div class="relative flex flex-col items-end gap-0.5">
              <span
                class="text-[8.5px] tracking-[0.22em] uppercase text-[hsl(var(--tac-amber)/0.85)] font-semibold"
              >
                MAPS
              </span>
              <span :class="[monoNum, 'font-bold text-[15px] text-foreground']">
                {{ eloChange.map_wins
                }}<span class="mx-[3px] text-muted-foreground">–</span
                >{{ eloChange.map_losses }}
              </span>
            </div>
          </section>

          <!-- Team ELO gap bar -->
          <section class="relative mb-2.5">
            <div class="flex justify-between items-baseline mb-1">
              <span :class="labelClass">TEAM ELO</span>
              <span
                :class="[
                  monoNum,
                  'text-[11px] font-semibold text-foreground inline-flex gap-1.5',
                ]"
              >
                <span>{{ playerTeamElo.toLocaleString() }}</span>
                <span
                  class="text-muted-foreground font-normal text-[9px] tracking-[0.2em] px-[2px] self-center"
                >
                  VS
                </span>
                <span>{{ opponentTeamElo.toLocaleString() }}</span>
              </span>
            </div>
            <div
              class="relative h-1.5 border border-border/60 [background:linear-gradient(90deg,hsl(var(--muted)/0.5)_0%,hsl(var(--muted)/0.2)_50%,hsl(var(--muted)/0.5)_100%)]"
              aria-hidden="true"
            >
              <span
                class="absolute left-1/2 top-[-2px] bottom-[-2px] w-px bg-border opacity-80"
              />
              <span
                class="absolute top-[-3px] bottom-[-3px] w-[3px] -translate-x-1/2 bg-[hsl(var(--tac-amber))] shadow-[0_0_8px_hsl(var(--tac-amber)/0.6)] transition-[left] duration-300 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]"
                :style="{ left: eloGapBar + '%' }"
              />
            </div>
          </section>

          <!-- Performance grid -->
          <section
            class="relative grid grid-cols-2 gap-px mb-2.5 bg-border/60 border border-border/60"
          >
            <div class="flex flex-col gap-0.5 px-2 py-1.5 bg-card/80">
              <span :class="labelClass">K / D / A</span>
              <span
                :class="[monoNum, 'font-semibold text-[12px] text-foreground']"
              >
                {{ eloChange.kills
                }}<span class="text-muted-foreground mx-px">/</span
                >{{ eloChange.deaths
                }}<span class="text-muted-foreground mx-px">/</span
                >{{ eloChange.assists }}
              </span>
            </div>
            <div class="flex flex-col gap-0.5 px-2 py-1.5 bg-card/80">
              <span :class="labelClass">KDA</span>
              <span
                :class="[monoNum, 'font-semibold text-[12px] text-foreground']"
              >
                {{ toNum(eloChange.kda).toFixed(2) }}
                <span
                  class="text-[10px] text-muted-foreground font-normal ml-0.5"
                >
                  · AVG {{ toNum(eloChange.team_avg_kda).toFixed(2) }}
                </span>
              </span>
            </div>
            <div class="flex flex-col gap-0.5 px-2 py-1.5 bg-card/80">
              <span :class="labelClass">DAMAGE</span>
              <span
                :class="[monoNum, 'font-semibold text-[12px] text-foreground']"
              >
                {{ eloChange.damage }}
                <span
                  class="text-[10px] text-muted-foreground font-normal ml-0.5"
                >
                  · {{ damagePercent }}%
                </span>
              </span>
            </div>
            <div class="flex flex-col gap-0.5 px-2 py-1.5 bg-card/80">
              <span :class="labelClass">SCORE</span>
              <span
                :class="[monoNum, 'font-semibold text-[12px] text-foreground']"
              >
                {{ actualScore.toFixed(2) }}
                <span
                  class="text-[10px] text-muted-foreground font-normal ml-0.5"
                >
                  · EXP {{ expectedScore.toFixed(2) }}
                </span>
              </span>
            </div>
            <div class="flex flex-col gap-0.5 px-2 py-1.5 bg-card/80">
              <span :class="labelClass">IMPACT</span>
              <span
                :class="[
                  monoNum,
                  'font-semibold text-[12px]',
                  impact > 1
                    ? 'text-[hsl(142_71%_60%)]'
                    : impact < 1
                      ? 'text-[hsl(0_84%_66%)]'
                      : 'text-foreground',
                ]"
              >
                {{ impact.toFixed(2) }}×
                <span
                  class="text-[10px] text-muted-foreground font-normal ml-0.5"
                >
                  {{ formatSignedPercent(impactDelta) }}
                </span>
              </span>
            </div>
            <div class="flex flex-col gap-0.5 px-2 py-1.5 bg-card/80">
              <span :class="labelClass">PERF ×</span>
              <span
                :class="[monoNum, 'font-semibold text-[12px] text-foreground']"
              >
                {{ perfMult.toFixed(2) }}
              </span>
            </div>
          </section>

          <!-- Formula trace -->
          <footer
            class="relative flex flex-wrap items-center justify-center gap-x-[5px] gap-y-1 pt-[7px] pb-[3px] px-1.5 border-t border-dashed border-border font-mono text-[10px] text-muted-foreground tracking-[0.02em]"
          >
            <span
              class="inline-flex items-baseline gap-[2px] px-[5px] py-px border border-border/70 bg-muted/30 font-medium text-muted-foreground cursor-help hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground transition-colors"
              :title="$t('match.elo_details.formula.k_factor_hint')"
            >
              K<em class="not-italic text-foreground font-bold">{{
                kFactor
              }}</em>
            </span>
            <span class="text-muted-foreground/70 font-bold">×</span>
            <span
              class="inline-flex items-baseline gap-[2px] px-[5px] py-px border border-border/70 bg-muted/30 font-medium text-muted-foreground cursor-help hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground transition-colors"
              :title="
                $t('match.elo_details.formula.delta_hint', {
                  actual: actualScore.toFixed(2),
                  expected: expectedScore.toFixed(2),
                })
              "
            >
              ∆<em class="not-italic text-foreground font-bold">{{
                (actualScore - expectedScore).toFixed(2)
              }}</em>
            </span>
            <span class="text-muted-foreground/70 font-bold">×</span>
            <span
              class="inline-flex items-baseline gap-[2px] px-[5px] py-px border border-border/70 bg-muted/30 font-medium text-muted-foreground cursor-help hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground transition-colors"
              :title="$t('match.elo_details.formula.perf_hint')"
            >
              P<em class="not-italic text-foreground font-bold">{{
                perfMult.toFixed(2)
              }}</em>
            </span>
            <span class="text-muted-foreground/70 font-bold">×</span>
            <span
              :class="[
                'inline-flex items-baseline gap-[2px] px-[5px] py-px border font-medium cursor-help transition-colors',
                hasSeriesBonus
                  ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)]'
                  : 'border-border/70 bg-muted/30 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground',
              ]"
              :title="$t('match.elo_details.formula.series_hint')"
            >
              S<em
                :class="[
                  'not-italic font-bold',
                  hasSeriesBonus
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-foreground',
                ]"
                >×{{ seriesMult }}</em
              >
            </span>
            <span class="text-muted-foreground/90 font-bold mx-0.5">=</span>
            <span
              :class="[
                'font-extrabold px-1.5 py-px border border-current tabular-nums cursor-help',
                isWin
                  ? 'text-[hsl(142_71%_60%)] bg-[hsl(142_71%_40%/0.15)]'
                  : 'text-[hsl(0_84%_66%)] bg-[hsl(0_84%_50%/0.15)]',
              ]"
              :title="$t('match.elo_details.formula.result_hint')"
            >
              {{ formatSigned(change) }}
            </span>
          </footer>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>

<style>
@keyframes elo-readout-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes elo-series-sweep {
  0%,
  40% {
    transform: translateX(-100%);
  }
  70%,
  100% {
    transform: translateX(100%);
  }
}
</style>
