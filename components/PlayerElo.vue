<script lang="ts" setup>
import { useMediaQuery } from "@vueuse/core";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "~/components/ui/hover-card";

// Touch surfaces have no usable hover; suppress the popover so a tap
// doesn't leave a sticky card open over the row underneath.
const isMobile = useMediaQuery("(max-width: 768px)");
</script>

<template>
  <HoverCard
    v-if="competitiveElo || wingmanElo || duelElo"
    :open-delay="80"
    :close-delay="140"
  >
    <HoverCardTrigger as-child>
      <button
        type="button"
        :class="triggerClasses"
        :style="{ '--tier-rgb': primaryTier.rgb }"
        :aria-label="`ELO, primary ${primaryTier.label} ${primaryElo}`"
      >
        <template v-if="bordered">
          <span :class="triggerNotchClasses" aria-hidden="true"></span>
        </template>
        <span :class="triggerValueClasses">
          {{ primaryElo ?? "—" }}
        </span>
      </button>
    </HoverCardTrigger>

    <HoverCardContent
      v-if="!isMobile"
      :side-offset="8"
      :collision-padding="12"
      :class="cardClasses"
    >
      <span
        :class="[cornerTickClasses, '-left-px -top-px border-l border-t']"
        aria-hidden="true"
      ></span>
      <span
        :class="[cornerTickClasses, '-right-px -top-px border-r border-t']"
        aria-hidden="true"
      ></span>
      <span
        :class="[cornerTickClasses, '-left-px -bottom-px border-l border-b']"
        aria-hidden="true"
      ></span>
      <span
        :class="[cornerTickClasses, '-right-px -bottom-px border-r border-b']"
        aria-hidden="true"
      ></span>

      <span :class="scanlineClasses" aria-hidden="true"></span>

      <header :class="headerClasses">
        <span :class="headerEyebrowClasses">
          <span :class="headerChevronClasses">◢</span>
          ELO
        </span>
        <span :class="headerCountClasses"> {{ activeCount }}/3 </span>
      </header>

      <div :class="rowsContainerClasses">
        <div
          v-for="(row, idx) in eloRows"
          :key="row.key"
          :class="[
            rowClasses,
            row.atPeak ? rowPeakClasses : '',
            !row.value ? rowEmptyClasses : '',
          ]"
          :style="row.value ? { '--row-rgb': row.rgb } : undefined"
        >
          <div :class="rowRailClasses">
            <span :class="rowModeClasses">{{ row.mode }}</span>
          </div>

          <div :class="rowMidClasses">
            <div
              v-if="row.value"
              :class="rowBarTrackClasses"
              aria-hidden="true"
            >
              <span
                :class="rowBarFillClasses"
                :style="{ width: row.bracketProgress + '%' }"
              ></span>
              <span
                v-for="n in 4"
                :key="n"
                :class="rowBarTickClasses"
                :style="{ left: n * 20 + '%' }"
              ></span>
            </div>
          </div>

          <div :class="rowValueWrapClasses">
            <template v-if="row.value">
              <span :class="rowValueClasses">
                {{ row.value.toLocaleString() }}
              </span>
              <span
                v-if="row.peak && row.peak > row.value"
                :class="rowPeakHintClasses"
                :style="{ '--peak-row-rgb': peakRgbFor(row.peak) }"
              >
                ▲ {{ row.peak.toLocaleString() }}
              </span>
            </template>
            <span v-else :class="rowValueEmptyClasses">— — —</span>
          </div>

          <span
            v-if="row.atPeak"
            :class="rowPeakBadgeClasses"
            aria-hidden="true"
          >
            ▲
          </span>
        </div>
      </div>

      <footer
        v-if="peakRow"
        :class="footerClasses"
        :style="{ '--peak-rgb': peakRow.peakRgb }"
      >
        <span :class="footerLabelClasses">{{ $t("player.all_time_peak") }}</span>
        <span :class="footerDotClasses" aria-hidden="true"></span>
        <span :class="footerValueClasses">
          {{ peakRow.peak?.toLocaleString() }}
        </span>
      </footer>
    </HoverCardContent>
  </HoverCard>

  <span v-else class="text-sm text-muted-foreground">—</span>
</template>

<script lang="ts">
import {
  ELO_BASELINE,
  RANK_TIERS,
  tierFor,
  type RankTier,
} from "~/utils/eloTier";

type ModeKey = "competitive" | "wingman" | "duel";

function bracketProgress(elo: number): number {
  if (elo < ELO_BASELINE) return 0;
  const tier = tierFor(elo);
  const tierIdx = RANK_TIERS.indexOf(tier);
  // tierIdx 0 is the top — no upper bound, so use a wide synthetic ceiling.
  const upperThreshold =
    tierIdx > 0 ? RANK_TIERS[tierIdx - 1].threshold : tier.threshold + 6000;
  const span = upperThreshold - tier.threshold;
  if (span <= 0) return 100;
  const pct = ((elo - tier.threshold) / span) * 100;
  return Math.max(4, Math.min(100, pct));
}

interface ModeRow {
  key: ModeKey;
  mode: string;
  label: string;
  value: number | undefined;
  peak: number | undefined;
  atPeak: boolean;
  rgb: string;
  bracketProgress: number;
}

export default {
  props: {
    elo: {
      type: Object as () => {
        competitive?: number;
        wingman?: number;
        duel?: number;
        // Tournament ELO track — currently passed through but not yet surfaced
        // in this redesigned card (see seasons-feature tweak list).
        tournament_competitive?: number;
        tournament_wingman?: number;
        tournament_duel?: number;
      },
      required: false,
    },
    peak: {
      type: Object as () => {
        competitive?: number;
        wingman?: number;
        duel?: number;
      },
      required: false,
    },
    type: {
      type: String,
      required: false,
      default: "competitive",
    },
    bordered: {
      type: Boolean,
      required: false,
      default: false,
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
    modeKey(): ModeKey {
      const normalized = (this.type ?? "").toLowerCase();
      if (normalized === "wingman" || normalized === "duel") {
        return normalized;
      }
      // Premier / Faceit / unknown types rank on the competitive ladder.
      return "competitive";
    },
    primaryElo(): number | undefined {
      return (
        this.elo?.[this.modeKey] ??
        this.competitiveElo ??
        this.wingmanElo ??
        this.duelElo
      );
    },
    primaryTier(): RankTier {
      return this.primaryElo ? tierFor(this.primaryElo) : RANK_TIERS.at(-1)!;
    },
    activeCount(): number {
      return [this.competitiveElo, this.wingmanElo, this.duelElo].filter(
        Boolean,
      ).length;
    },
    eloRows(): ModeRow[] {
      const seed: Array<{
        key: ModeKey;
        mode: string;
        label: string;
        value: number | undefined;
        peak: number | undefined;
      }> = [
        {
          key: "competitive",
          mode: this.$t("pages.leaderboard.match_types.competitive"),
          label: this.$t("pages.leaderboard.match_types.competitive"),
          value: this.competitiveElo,
          peak: this.peak?.competitive,
        },
        {
          key: "wingman",
          mode: this.$t("pages.leaderboard.match_types.wingman"),
          label: this.$t("pages.leaderboard.match_types.wingman"),
          value: this.wingmanElo,
          peak: this.peak?.wingman,
        },
        {
          key: "duel",
          mode: this.$t("pages.leaderboard.match_types.duel"),
          label: this.$t("pages.leaderboard.match_types.duel"),
          value: this.duelElo,
          peak: this.peak?.duel,
        },
      ];

      return seed.map((row): ModeRow => {
        if (!row.value) {
          return {
            ...row,
            atPeak: false,
            rgb: "120 130 140",
            bracketProgress: 0,
          };
        }
        return {
          ...row,
          atPeak: row.peak !== undefined && row.value >= row.peak,
          rgb: tierFor(row.value).rgb,
          bracketProgress: bracketProgress(row.value),
        };
      });
    },
    peakRow(): (ModeRow & { peakRgb: string }) | null {
      // Find the highest historical peak across all modes (not the current snapshot).
      const candidates = this.eloRows.filter((r) => r.peak && r.peak > 0);
      if (candidates.length === 0) return null;
      const top = candidates.reduce((best, r) =>
        (r.peak ?? 0) > (best.peak ?? 0) ? r : best,
      );
      return {
        ...top,
        peakRgb: tierFor(top.peak ?? 0).rgb,
      };
    },

    triggerClasses(): string {
      if (this.bordered) {
        return [
          "group/elo relative inline-flex items-center gap-1.5 cursor-pointer select-none leading-none",
          "h-[26px] px-[0.6rem] rounded",
          "border border-[rgb(var(--tier-rgb)/0.4)] bg-[hsl(var(--card)/0.55)]",
          "[backdrop-filter:blur(6px)]",
          "transition-[transform,border-color,box-shadow] duration-150",
          "hover:border-[rgb(var(--tier-rgb)/0.85)] hover:-translate-y-px",
          "hover:shadow-[0_0_0_1px_rgb(var(--tier-rgb)/0.25),0_6px_18px_-8px_rgb(var(--tier-rgb)/0.55)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.5)]",
        ].join(" ");
      }
      return [
        "group/elo relative inline-flex items-center cursor-pointer select-none leading-none",
        "px-0 py-0 bg-transparent border-0",
        "transition-[transform,color] duration-150",
        "hover:-translate-y-px",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.5)] focus-visible:ring-offset-1",
      ].join(" ");
    },
    triggerNotchClasses(): string {
      return "h-[7px] w-[7px] rounded-[1px] bg-[rgb(var(--tier-rgb))] [box-shadow:0_0_8px_rgb(var(--tier-rgb)/0.7)]";
    },
    triggerLabelClasses(): string {
      return "font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/85 group-hover/elo:text-[hsl(var(--tac-amber))]";
    },
    triggerSeparatorClasses(): string {
      return "h-3 w-px bg-border/70";
    },
    triggerValueClasses(): string {
      return "font-mono text-[0.75rem] font-bold tabular-nums tracking-[0.04em] text-[rgb(var(--tier-rgb))] [text-shadow:0_0_10px_rgb(var(--tier-rgb)/0.35)]";
    },

    cardClasses(): string {
      return [
        "relative w-[290px] p-0 overflow-hidden",
        "border border-border/80 rounded-none",
        "bg-[hsl(240_8%_10%)] text-[hsl(var(--popover-foreground))]",
        "[font-family:'Oxanium',sans-serif]",
        "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04),0_0_0_1px_hsl(var(--tac-amber)/0.08),0_18px_40px_-12px_hsl(0_0%_0%/0.85)]",
        "[background-image:radial-gradient(circle_at_top_right,hsl(var(--tac-amber)/0.10)_0%,transparent_55%),linear-gradient(180deg,hsl(0_0%_100%/0.02)_0%,transparent_60%)]",
        "animate-[playerelo-in_180ms_cubic-bezier(0.2,0.8,0.2,1)]",
      ].join(" ");
    },
    cornerTickClasses(): string {
      return "absolute h-[8px] w-[8px] border-[hsl(var(--tac-amber))] pointer-events-none";
    },
    scanlineClasses(): string {
      return "pointer-events-none absolute inset-0 mix-blend-overlay opacity-60 [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_3px,hsl(0_0%_100%/0.02)_3px,hsl(0_0%_100%/0.02)_4px)]";
    },
    headerClasses(): string {
      return "relative flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-border/60";
    },
    headerEyebrowClasses(): string {
      return "inline-flex items-center gap-1.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground";
    },
    headerChevronClasses(): string {
      return "text-[0.55rem] text-[hsl(var(--tac-amber))]";
    },
    headerCountClasses(): string {
      return "font-mono text-[0.6rem] font-semibold tabular-nums tracking-[0.16em] text-[hsl(var(--tac-amber))] border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] px-1.5 py-[1px] rounded-[2px]";
    },
    rowsContainerClasses(): string {
      return "relative flex flex-col";
    },
    rowClasses(): string {
      return [
        "relative grid grid-cols-[90px_1fr_auto] items-center gap-2.5 px-3 py-2",
        "border-b border-border/40 last:border-b-0",
        "transition-colors duration-150 hover:bg-[hsl(var(--tac-amber)/0.04)]",
      ].join(" ");
    },
    rowPeakClasses(): string {
      return "bg-[hsl(var(--tac-amber)/0.05)]";
    },
    rowEmptyClasses(): string {
      return "opacity-65";
    },
    rowRailClasses(): string {
      return "flex items-center leading-none";
    },
    rowModeClasses(): string {
      return "font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-foreground truncate";
    },
    rowMidClasses(): string {
      return "flex flex-col justify-center min-w-0";
    },
    rowBarTrackClasses(): string {
      return "relative h-[3px] w-full bg-[hsl(0_0%_100%/0.05)] border border-border/40 overflow-hidden";
    },
    rowBarFillClasses(): string {
      return "absolute inset-y-0 left-0 bg-[rgb(var(--row-rgb))] [box-shadow:0_0_6px_rgb(var(--row-rgb)/0.6)] transition-[width] duration-300 ease-out";
    },
    rowBarTickClasses(): string {
      return "absolute top-0 bottom-0 w-px bg-[hsl(0_0%_100%/0.06)]";
    },
    rowValueWrapClasses(): string {
      return "flex flex-col items-end gap-0.5 leading-none";
    },
    rowValueClasses(): string {
      return "font-mono text-[0.86rem] font-bold tabular-nums tracking-[0.02em] leading-none text-[rgb(var(--row-rgb))] [text-shadow:0_0_10px_rgb(var(--row-rgb)/0.35)]";
    },
    rowPeakHintClasses(): string {
      return "font-mono text-[0.55rem] tabular-nums tracking-[0.08em] text-[rgb(var(--peak-row-rgb)/0.9)] inline-flex items-center gap-[2px]";
    },
    rowValueEmptyClasses(): string {
      return "font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground/45";
    },
    rowPeakBadgeClasses(): string {
      return "absolute right-[3px] top-[3px] text-[7px] leading-none text-[hsl(var(--tac-amber))] [text-shadow:0_0_4px_hsl(var(--tac-amber)/0.6)]";
    },
    footerClasses(): string {
      return "relative flex items-center gap-1.5 px-3 py-2 border-t border-dashed border-border/55 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground bg-[hsl(0_0%_100%/0.015)]";
    },
    footerLabelClasses(): string {
      return "font-semibold text-[hsl(var(--tac-amber))]";
    },
    footerDotClasses(): string {
      return "h-[6px] w-[6px] rounded-[1px] bg-[rgb(var(--peak-rgb))] [box-shadow:0_0_6px_rgb(var(--peak-rgb)/0.6)]";
    },
    footerValueClasses(): string {
      return "ml-auto font-bold tabular-nums tracking-[0.04em] text-[rgb(var(--peak-rgb))]";
    },
  },
  methods: {
    peakRgbFor(elo: number): string {
      return tierFor(elo).rgb;
    },
  },
};
</script>

<style>
@keyframes playerelo-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
