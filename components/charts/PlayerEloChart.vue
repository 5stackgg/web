<script lang="ts" setup>
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "vue-chartjs";
import { csRankName } from "~/utilities/csRank";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

ChartJS.register({
  id: "eloChangeSymbols",
  afterDatasetsDraw: (chart: any) => {
    const ctx = chart.ctx;

    chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
      // Only annotate the focused series — multi-line readouts get unreadable otherwise.
      if (!dataset.focus) return;

      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || !meta.data) return;

      const eloChanges: (number | null | undefined)[] =
        dataset.eloChanges || [];
      const data: (number | null)[] = dataset.data || [];

      // Build the set of "noteworthy" indices we want to annotate. Labeling
      // every point is unreadable past ~30 matches (see screenshot of 98+).
      const candidates = new Set<number>();
      const nonZero: { index: number; change: number }[] = [];
      for (let i = 0; i < eloChanges.length; i++) {
        const c = eloChanges[i];
        if (typeof c === "number" && c !== 0) {
          nonZero.push({ index: i, change: c });
        }
      }
      const total = nonZero.length;

      // Tiered budget — split between top gains and top losses.
      let perSide: number;
      if (total <= 30) {
        perSide = Infinity; // label everything
      } else if (total <= 80) {
        perSide = 8;
      } else {
        perSide = 5;
      }

      if (perSide === Infinity) {
        for (const e of nonZero) candidates.add(e.index);
      } else {
        const gains = nonZero
          .filter((e) => e.change > 0)
          .sort((a, b) => b.change - a.change);
        const losses = nonZero
          .filter((e) => e.change < 0)
          .sort((a, b) => a.change - b.change);
        gains.slice(0, perSide).forEach((e) => candidates.add(e.index));
        losses.slice(0, perSide).forEach((e) => candidates.add(e.index));

        // Anchor first/last non-null and peak/trough so endpoints + extremes always show.
        let firstIdx = -1;
        let lastIdx = -1;
        let peakIdx = -1;
        let troughIdx = -1;
        let peakVal = -Infinity;
        let troughVal = Infinity;
        for (let i = 0; i < data.length; i++) {
          const v = data[i];
          if (v === null || v === undefined) continue;
          if (firstIdx === -1) firstIdx = i;
          lastIdx = i;
          if (v > peakVal) {
            peakVal = v;
            peakIdx = i;
          }
          if (v < troughVal) {
            troughVal = v;
            troughIdx = i;
          }
        }
        [firstIdx, lastIdx, peakIdx, troughIdx].forEach((i) => {
          if (
            i >= 0 &&
            typeof eloChanges[i] === "number" &&
            (eloChanges[i] as number) !== 0
          ) {
            candidates.add(i);
          }
        });
      }

      // Collision tracking — even with thinning, adjacent extremes can stack.
      const drawnRects: { x: number; y: number; w: number; h: number }[] = [];
      const overlaps = (
        a: { x: number; y: number; w: number; h: number },
        b: { x: number; y: number; w: number; h: number },
      ) =>
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;

      // Walk in chart x-order so collision skipping favors earlier (left) labels.
      meta.data.forEach((point: any, index: number) => {
        if (!candidates.has(index)) return;
        if (index >= eloChanges.length) return;

        const eloChange = eloChanges[index];
        if (typeof eloChange !== "number" || eloChange === 0) return;

        const x = point.x;
        const y = point.y;

        const symbol = eloChange > 0 ? "+" : "-";
        const color = eloChange > 0 ? "#22c55e" : "#ef4444";
        const changeText = `${symbol}${Math.abs(eloChange).toLocaleString()}`;

        ctx.save();
        ctx.font = "bold 12px Arial";
        const textMetrics = ctx.measureText(changeText);
        const textWidth = textMetrics.width;
        const textHeight = 16;
        const padding = 4;

        const rect = {
          x: x + 10 - padding,
          y: y - textHeight / 2 - padding,
          w: textWidth + padding * 2,
          h: textHeight + padding * 2,
        };

        if (drawnRects.some((r) => overlaps(r, rect))) {
          ctx.restore();
          return;
        }
        drawnRects.push(rect);

        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(changeText, x + 12, y);
        ctx.restore();
      });
    });
  },
});

// Skill-group (Valve Competitive/Wingman) ranks are discrete 0–18 art, not a
// number — so for those charts we hide the numeric y ticks and draw the rank
// badge at each integer gridline instead.
const rankImgCache: Record<string, HTMLImageElement> = {};
function rankBadgeImg(
  src: string,
  onReady: () => void,
): HTMLImageElement | null {
  let img = rankImgCache[src];
  if (!img) {
    img = new Image();
    img.onload = onReady;
    img.src = src;
    rankImgCache[src] = img;
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

ChartJS.register({
  id: "rankBadgeAxis",
  afterDraw: (chart: any) => {
    const kind = chart.options?.plugins?.rankBadgeAxis?.kind as
      | "wingman"
      | "competitive"
      | null
      | undefined;
    if (!kind) return;
    const yScale = chart.scales?.y;
    if (!yScale || !chart.chartArea) return;
    const ctx = chart.ctx;
    const prefix = kind === "wingman" ? "wingman" : "skillgroup";
    const h = 20;
    for (const tick of yScale.ticks || []) {
      const rank = tick.value;
      if (!Number.isInteger(rank) || rank < 0 || rank > 18) continue;
      const img = rankBadgeImg(`/img/skillgroups/${prefix}${rank}.svg`, () =>
        chart.draw(),
      );
      if (!img) continue;
      const ratio = img.naturalWidth / img.naturalHeight || 2.2;
      const w = h * ratio;
      const y = yScale.getPixelForValue(rank);
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(img, chart.chartArea.left - w - 8, y - h / 2, w, h);
      ctx.restore();
    }
  },
});
</script>

<template>
  <div
    class="h-full w-full origin-center transition-transform duration-200 ease-in-out"
    :class="collapsed ? 'scale-y-0' : 'scale-y-100'"
  >
    <Line
      :key="chartKey"
      :data="chartData"
      :options="chartOptions"
      v-if="chartData"
      @chart:render="onChartRender"
    />
  </div>
</template>

<script lang="ts">
interface EloHistoryEntry {
  current_elo?: number | null;
  elo_change?: number | null;
  match_created_at: string;
  match_id?: string | null;
  updated_elo?: number | null;
  [key: string]: unknown;
}

interface EloSeries {
  key: string;
  label: string;
  history: EloHistoryEntry[];
  focus?: boolean;
  // Fixed line color (e.g. the cyan comparison overlay) — bypasses the
  // elo-tier coloring.
  color?: string;
}

export default {
  components: {
    Line,
  },
  props: {
    // Multi-series mode: each series is plotted as its own line.
    // The series with `focus: true` is bold + carries +/- labels;
    // everything else is dimmed for context.
    series: {
      type: Array as () => EloSeries[],
      required: false,
      default: null,
    },
    // Single-series fallback (backwards compat).
    eloHistory: {
      type: Array as () => EloHistoryEntry[],
      required: false,
      default: null,
    },
    // Valve rank type when plotting a skill group (6 = Wingman, 7/12 =
    // Competitive). When set, the y-axis becomes the discrete 0–18 rank ladder
    // with badges instead of numbers, and the line is stepped.
    rankType: {
      type: Number as () => number | null,
      required: false,
      default: null,
    },
    // When true, an async refetch is in flight (e.g. a source flip). We hold
    // the currently-displayed data through it rather than flashing to empty,
    // and only wink-swap once the real new data arrives.
    loading: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      // Buffered copy of the incoming data. We only swap it to the new props
      // while the chart is collapsed (winked out + invisible), so switching
      // maps/modes never shows the line morphing across rescaled axes.
      displayedSeries: this.series as EloSeries[] | null,
      displayedEloHistory: this.eloHistory as EloHistoryEntry[] | null,
      collapsed: false,
      suppressDraw: false,
    };
  },
  watch: {
    series: {
      handler() {
        this.maybeSwap();
      },
      deep: true,
    },
    eloHistory: {
      handler() {
        this.maybeSwap();
      },
      deep: true,
    },
    loading(isLoading: boolean) {
      // Fetch finished and the real result is genuinely empty — commit it now
      // (wink out to the empty state) instead of holding stale data forever.
      if (!isLoading && !this.hasIncomingData() && this.hasDisplayedData()) {
        this.wink();
      }
    },
  },
  computed: {
    skillGroupKind(): "wingman" | "competitive" | null {
      const rt = Number(this.rankType);
      if (rt === 6) return "wingman";
      if (rt === 7 || rt === 12) return "competitive";
      return null;
    },
    // Padded integer y-range for skill-group charts so a flat rank still shows
    // a gridline above/below it (clamped to the 0–18 ladder).
    skillGroupRange(): { min: number; max: number } | null {
      if (!this.skillGroupKind) return null;
      const vals: number[] = [];
      for (const s of this.normalizedSeries) {
        for (const e of s.history) {
          const v = (e.updated_elo ?? e.current_elo) as number | null;
          if (typeof v === "number") vals.push(v);
        }
      }
      const lo = vals.length ? Math.min(...vals) : 0;
      const hi = vals.length ? Math.max(...vals) : 1;
      let min = Math.max(0, Math.floor(lo) - 1);
      let max = Math.min(18, Math.ceil(hi) + 1);
      if (max - min < 2) max = Math.min(18, min + 2);
      if (max - min < 2) min = Math.max(0, max - 2);
      return { min, max };
    },
    normalizedSeries(): EloSeries[] {
      if (this.displayedSeries && this.displayedSeries.length) {
        return this.displayedSeries.filter(
          (s) => s.history && s.history.length > 0,
        );
      }
      if (this.displayedEloHistory && this.displayedEloHistory.length) {
        return [
          {
            key: "elo",
            label: this.$t("pages.leaderboard.categories.elo"),
            history: this.displayedEloHistory,
            focus: true,
          },
        ];
      }
      return [];
    },
    // Unified x-axis: every match_created_at across all series, deduped and sorted asc.
    unifiedTimestamps(): string[] {
      const set = new Set<string>();
      for (const s of this.normalizedSeries) {
        for (const entry of s.history) {
          if (entry.match_created_at) set.add(entry.match_created_at);
        }
      }
      return Array.from(set).sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      );
    },
    focusSeries(): EloSeries | null {
      return (
        this.normalizedSeries.find((s) => s.focus) ??
        this.normalizedSeries[0] ??
        null
      );
    },
    chartOptions() {
      const self = this;
      const sg = this.skillGroupKind;
      const sgRange = this.skillGroupRange;
      return {
        responsive: true,
        maintainAspectRatio: false,
        animation: this.suppressDraw
          ? (false as const)
          : { duration: 750, easing: "easeInOutQuart" as const },
        interaction: {
          mode: "nearest" as const,
          axis: "xy" as const,
          intersect: false,
        },
        plugins: {
          rankBadgeAxis: { kind: sg },
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 6,
            usePointStyle: false,
            backgroundColor: "rgba(20, 22, 28, 0.96)",
            borderColor: "#fbbf24",
            borderWidth: 1,
            titleColor: "rgba(255, 255, 255, 0.9)",
            titleFont: {
              size: 11,
              weight: "600",
              family: "'Oxanium', sans-serif",
            },
            bodyColor: "rgba(255, 255, 255, 0.85)",
            bodyFont: {
              size: 12,
              family: "'Oxanium', sans-serif",
            },
            padding: 10,
            cornerRadius: 2,
            caretSize: 6,
            filter: (item: any) => {
              // Skip null points — gaps in dimmed series shouldn't surface tooltips.
              return item?.parsed?.y !== null && item?.parsed?.y !== undefined;
            },
            callbacks: {
              title: (items: any[]) => {
                const item = items?.[0];
                if (!item) return "";
                const ts = self.unifiedTimestamps?.[item.dataIndex];
                if (!ts) return "";
                return new Date(ts).toLocaleString(navigator.language, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              },
              labelColor: (item: any) => {
                // Solid tier-color swatch — same for focus and dim, so users
                // can correlate tooltip → line at a glance.
                const ds = item.dataset;
                const color = ds?.borderColor || "rgba(255,255,255,0.5)";
                return {
                  borderColor: color,
                  backgroundColor: color,
                };
              },
              label: (item: any) => {
                const ds = item.dataset;
                const mode = (ds?.label || "").toUpperCase();
                if (sg) {
                  const rank = item.parsed?.y;
                  const name =
                    csRankName(self.rankType, rank) ??
                    (typeof rank === "number" ? String(rank) : "—");
                  return `${mode}   ${name}`;
                }
                const elo =
                  typeof item.parsed?.y === "number"
                    ? item.parsed.y.toLocaleString()
                    : "—";
                const change = ds?.eloChanges?.[item.dataIndex] ?? 0;
                const changeText =
                  change > 0
                    ? `  ▲ +${Math.abs(change).toLocaleString()}`
                    : change < 0
                      ? `  ▼ -${Math.abs(change).toLocaleString()}`
                      : "";
                return `${mode}   ${elo}${changeText}`;
              },
              labelTextColor: (item: any) => {
                const ds = item.dataset;
                if (!ds) return "rgba(255,255,255,0.85)";
                return ds.focus
                  ? "rgba(255, 255, 255, 0.95)"
                  : "rgba(255, 255, 255, 0.65)";
              },
            },
          },
        },
        scales: {
          y: {
            position: "left" as const,
            beginAtZero: false,
            grid: { color: "rgba(255,255,255,0.05)" },
            ...(sg && sgRange ? { min: sgRange.min, max: sgRange.max } : {}),
            ticks: {
              color: "rgba(255, 255, 255, 0.6)",
              font: { size: 11 },
              padding: 8,
              ...(sg ? { stepSize: 1, maxTicksLimit: 10 } : {}),
              // Hide the numeric labels for skill groups — the rankBadgeAxis
              // plugin draws the rank badge at each integer tick instead.
              callback: (value: any) => (sg ? "" : value.toLocaleString()),
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: "rgba(255, 255, 255, 0.6)",
              font: { size: 11 },
              padding: 8,
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              callback: (_tickValue: any, index: number) => {
                const labels: string[] = self.unifiedTimestamps || [];
                if (index >= labels.length) return "";
                const ts = labels[index];
                if (!ts) return "";
                return new Date(ts).toLocaleDateString(navigator.language, {
                  month: "short",
                  day: "numeric",
                });
              },
            },
            afterFit: (scale: any) => {
              scale.paddingRight = 60;
            },
          },
        },
        layout: {
          padding: { right: 60, top: 10, bottom: 10, left: sg ? 60 : 10 },
        },
      };
    },
    // Remount the chart whenever the series composition or x-axis length
    // changes (e.g. a compare player's data arrives async on reload) so points
    // re-align to the unified timestamps instead of sticking to stale slots.
    chartKey(): string {
      const series = this.normalizedSeries ?? [];
      return `${series.length}:${this.unifiedTimestamps.length}:${series
        .map((s: any) => s.history?.length ?? 0)
        .join(",")}`;
    },
    chartData() {
      const labels = this.unifiedTimestamps;
      if (labels.length === 0) return null;

      const focusCount = this.focusSeries?.history?.length ?? 0;
      // Tiered sizing so dense charts (hundreds of matches) stop turning into
      // a blob of overlapping dots.
      let focusRadius: number;
      let dimRadius: number;
      if (focusCount <= 30) {
        focusRadius = 3;
        dimRadius = 1.5;
      } else if (focusCount <= 80) {
        focusRadius = 2.25;
        dimRadius = 1.25;
      } else if (focusCount <= 200) {
        focusRadius = 1.5;
        dimRadius = 1;
      } else {
        focusRadius = 1;
        dimRadius = 0.75;
      }
      const tension = focusCount > 80 ? 0.3 : 0.4;

      const datasets = this.normalizedSeries.map((series) => {
        const focus = !!series.focus;

        // Index lookup: timestamp → entry for this series.
        const byTs = new Map<string, EloHistoryEntry>();
        for (const entry of series.history) {
          if (entry.match_created_at) byTs.set(entry.match_created_at, entry);
        }

        // Single-series chart: focus line is white; a pinned comparison series
        // keeps its explicit (sky-blue) color; extra non-focus series dim out.
        const lineColor = series.color
          ? series.color
          : focus
            ? "#fff"
            : "rgba(255,255,255,0.3)";
        const pointColor = series.color
          ? series.color
          : focus
            ? "#fff"
            : "rgba(255,255,255,0.4)";

        const data = labels.map((ts) => {
          const entry = byTs.get(ts);
          if (!entry) return null;
          return (entry.updated_elo ?? entry.current_elo ?? null) as
            | number
            | null;
        });

        const eloChanges = labels.map((ts) => {
          const entry = byTs.get(ts);
          return typeof entry?.elo_change === "number" ? entry.elo_change : 0;
        });

        const radius = focus ? focusRadius : dimRadius;
        return {
          label: series.label,
          fill: false,
          borderColor: lineColor,
          borderWidth: focus ? 2.5 : 1.5,
          borderDash: focus ? [] : [4, 4],
          pointBackgroundColor: pointColor,
          pointBorderColor: focus ? "#fff" : "rgba(255,255,255,0.4)",
          pointBorderWidth: Math.max(1, radius * 0.5),
          pointRadius: radius,
          pointHoverRadius: Math.max(focus ? 6 : 5, radius + 2),
          pointHoverBorderWidth: focus ? 3 : 1.5,
          tension: this.skillGroupKind ? 0 : tension,
          stepped: this.skillGroupKind ? ("after" as const) : false,
          spanGaps: true,
          data,
          eloChanges,
          focus,
        };
      });

      return {
        labels,
        datasets,
      };
    },
  },
  mounted() {
    this.$nextTick(() => {
      const chartElement = this.$el?.querySelector("canvas");
      if (chartElement) {
        const chart = (chartElement as any).__chartjs__;
        if (chart) {
          (chart as any).$vueComponent = this;
        }
      }
    });
  },
  methods: {
    hasIncomingData(): boolean {
      return Boolean(
        this.series?.some((s) => s.history && s.history.length > 0) ||
          (this.eloHistory && this.eloHistory.length > 0),
      );
    },
    hasDisplayedData(): boolean {
      return Boolean(
        this.displayedSeries?.some((s) => s.history && s.history.length > 0) ||
          (this.displayedEloHistory && this.displayedEloHistory.length > 0),
      );
    },
    commit() {
      this.displayedSeries = this.series;
      this.displayedEloHistory = this.eloHistory;
    },
    maybeSwap() {
      // First population (or recovering from empty): no wink, just animate in.
      if (!this.hasDisplayedData()) {
        this.commit();
        return;
      }
      // Transient empty while a refetch is in flight (e.g. a source flip):
      // keep showing the old data — the `loading` watcher commits the result.
      if (!this.hasIncomingData() && this.loading) {
        return;
      }
      // Already mid-wink; the pending swap will pick up the latest props.
      if (this.collapsed) {
        return;
      }
      this.wink();
    },
    // Wink the current chart out, swap in the new data while it's collapsed
    // (invisible + draw suppressed so it can't morph), then wink it back in.
    // `suppressDraw` stays on once a wink happens: from then on the scaleY wink
    // is the only transition, so re-enabling chart.js animation (which would
    // replay an "draw-in" after the wink and read as the line slowly rendering)
    // is never needed.
    wink() {
      this.collapsed = true;
      this.suppressDraw = true;
      window.setTimeout(() => {
        this.commit();
        window.setTimeout(() => {
          this.collapsed = false;
        }, 40);
      }, 240);
    },
    onChartRender(chart: any) {
      if (chart) {
        (chart as any).$vueComponent = this;
      }
    },
  },
};
</script>
