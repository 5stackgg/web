<template>
  <div class="space-y-2.5">
    <div class="w-full">
      <!-- flex-grow proportional to the value with a fixed gap between
           segments: the gaps claim their pixels first and the segments split
           what is left, so the bar stays exactly full width at any segment
           count. -->
      <div class="flex h-2.5 w-full gap-[2px]">
        <span
          v-for="segment of drawn"
          :key="segment.label"
          class="h-full min-w-[3px]"
          :style="{ flex: `${segment.value} 0 0px`, background: segment.color }"
          :title="`${segment.label}: ${formatted(segment.value)}`"
        />
      </div>

      <!-- A slice that cuts across the bands rather than being one of them: a
           GPU node is already inside online or offline, so it cannot be a
           further segment without being counted twice. It runs flush along the
           foot of the same bar, off the same total -- flush because a gap here
           has to be painted in the surface colour, and a dark seam between two
           saturated fills reads as a crack rather than as separation. Its
           length is a magnitude, not a position: which of the bands the subset
           falls in is not something a panel reports. -->
      <div v-if="drawnSubset" class="h-[3px] w-full">
        <span
          class="block h-full min-w-[3px]"
          :style="{
            width: `${drawnSubset.width}%`,
            background: drawnSubset.color,
          }"
          :title="`${drawnSubset.label}: ${formatted(drawnSubset.value)}`"
        />
      </div>
    </div>

    <ul class="flex flex-wrap gap-x-4 gap-y-1">
      <li
        v-for="entry of legend"
        :key="entry.label"
        class="flex items-center gap-1.5 text-[0.72rem] leading-none"
      >
        <span
          class="shrink-0"
          :class="entry.subset ? 'h-[3px] w-2.5' : 'h-2 w-2'"
          :style="{ background: entry.color }"
        />
        <span class="text-muted-foreground">{{ entry.label }}</span>
        <span class="font-mono tabular-nums">{{ formatted(entry.value) }}</span>
        <span
          v-if="entry.subset"
          class="font-mono tabular-nums text-muted-foreground"
        >
          {{ entry.share }}%
        </span>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    segments: {
      type: Array,
      required: true,
    },
    // Drawn as a trailing segment in the track colour so the bar reads as a
    // share of something rather than as a whole that happens to be full.
    remainder: {
      type: Number,
      default: 0,
    },
    // One only. Two lanes stacked inside the same bar stop being readable, and
    // a second subset is nearly always better off as a plain readout.
    subset: {
      type: Object,
      default: null,
    },
  },
  methods: {
    formatted(value: number) {
      return (value ?? 0).toLocaleString();
    },
  },
  computed: {
    // The bar is the whole, so it is what the subset is a share of.
    total() {
      return (
        this.segments.reduce(
          (sum, segment) => sum + Math.max(segment.value ?? 0, 0),
          0,
        ) + Math.max(this.remainder, 0)
      );
    },
    drawnSubset() {
      if (!this.subset || !(this.subset.value > 0)) {
        return null;
      }

      const value = Math.max(this.subset.value ?? 0, 0);
      const share = this.total ? (value / this.total) * 100 : 0;

      // Clamped: the subset and the bands are summed from independently
      // reported payloads and can disagree at the edge.
      const width = Math.min(share, 100);

      return { ...this.subset, value, width, share: Math.round(width) };
    },
    legend() {
      const entries = this.segments.map((segment) => ({ ...segment }));

      if (this.drawnSubset) {
        entries.push({ ...this.drawnSubset, subset: true });
      }

      return entries;
    },
    drawn() {
      const segments = this.segments.filter((segment) => segment.value > 0);

      if (this.remainder > 0) {
        segments.push({
          label: this.$t("pages.system_telemetry.meter.remainder"),
          value: this.remainder,
          color: "hsl(var(--muted-foreground) / 0.25)",
        });
      }

      // An all-zero meter would collapse to nothing; show an empty track.
      if (!segments.length) {
        return [
          {
            label: this.$t("pages.system_telemetry.meter.remainder"),
            value: 1,
            color: "hsl(var(--muted-foreground) / 0.2)",
          },
        ];
      }

      return segments;
    },
  },
};
</script>
