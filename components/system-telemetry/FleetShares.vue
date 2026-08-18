<template>
  <ol class="space-y-3">
    <li v-for="row of drawn" :key="row.label">
      <div class="flex items-baseline justify-between gap-3">
        <span class="flex items-center gap-1.5 text-sm">
          {{ row.label }}
          <FiveStackToolTip v-if="row.hint">{{ row.hint }}</FiveStackToolTip>
        </span>
        <span class="flex items-baseline gap-2">
          <span class="font-mono text-sm tabular-nums">
            {{ format(row.value) }}
          </span>
          <span
            v-if="row.share !== null"
            class="w-11 text-right font-mono text-[0.7rem] tabular-nums text-muted-foreground"
          >
            {{ row.share }}%
          </span>
          <span v-else class="w-11" />
        </span>
      </div>
      <span class="mt-1.5 block h-2 w-full rounded-full bg-border/50">
        <span
          class="block h-full rounded-full"
          :style="{
            width: `${row.width}%`,
            background: `hsl(var(--tac-step-${row.tone}))`,
          }"
        />
      </span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<script lang="ts">
export default {
  props: {
    // The first row is the population every row below is a slice of. Those
    // slices are NOT nested in each other -- most steam ids a panel has stats
    // for never signed in -- so nothing here chains one row to the next, and
    // the percentages are all against the first row rather than the previous.
    rows: {
      type: Array,
      required: true,
    },
  },
  methods: {
    format(value: number) {
      return (value ?? 0).toLocaleString();
    },
  },
  computed: {
    drawn() {
      const base = this.rows.at(0)?.value ?? 0;

      return this.rows.map((row, index) => {
        const value = row.value ?? 0;

        return {
          ...row,
          value,
          width: base ? Math.min(Math.max((value / base) * 100, 1), 100) : 0,
          // The ramp has four steps; anything past them reuses the last.
          tone: Math.min(index + 1, 4),
          share: index === 0 || !base ? null : Math.round((value / base) * 100),
        };
      });
    },
  },
};
</script>
