<script setup lang="ts">
import TimezoneFlag from "~/components/TimezoneFlag.vue";
</script>

<template>
  <div :class="bare ? '' : 'rounded-lg border border-border/60 bg-card/40 p-3'">
    <ul v-if="rows.length" class="space-y-2.5">
      <li v-for="row of rows" :key="row.label">
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="flex min-w-0 items-center gap-1.5">
            <TimezoneFlag v-if="flags" :country="row.label" class="shrink-0" />
            <span class="truncate">{{ row.label }}</span>
          </span>
          <span class="shrink-0 font-mono tabular-nums">
            {{ format(row.value) }}
            <span
              v-if="scale === 'total'"
              class="ml-1 text-xs text-muted-foreground"
            >
              {{ row.share }}%
            </span>
          </span>
        </div>
        <span
          class="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-border/60"
        >
          <span
            class="block h-full rounded-full"
            :style="{ width: `${row.share}%`, backgroundColor: color }"
          />
        </span>
      </li>
    </ul>

    <div
      v-else
      class="flex h-20 items-center justify-center text-sm text-muted-foreground"
    >
      {{ $t("pages.system_telemetry.no_data") }}
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    items: {
      type: Array,
      required: true,
    },
    labelField: {
      type: String,
      required: true,
    },
    valueField: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: "hsl(var(--tac-amber))",
    },
    flags: {
      type: Boolean,
      default: false,
    },
    limit: {
      type: Number,
      default: 8,
    },
    // Drops the card frame when the caller already supplies one, so the page
    // never draws a box inside a box.
    bare: {
      type: Boolean,
      default: false,
    },
    // "total" for a part-to-whole list, "max" for a set of overlapping
    // measures -- nested time windows do not add up to anything, so a share of
    // their sum would be a number with no meaning.
    scale: {
      type: String,
      default: "total",
    },
  },
  methods: {
    format(value: number) {
      return (value ?? 0).toLocaleString();
    },
  },
  computed: {
    // Share of the whole rather than of the largest bar: the list is a top-N
    // slice, so scaling to the leader would make a 2% sliver look dominant the
    // moment the real leader drops out of the window.
    total() {
      if (this.scale === "max") {
        return Math.max(
          ...this.items.map((item) => item[this.valueField] ?? 0),
          0,
        );
      }

      return this.items.reduce(
        (sum, item) => sum + (item[this.valueField] ?? 0),
        0,
      );
    },
    rows() {
      return this.items.slice(0, this.limit).map((item) => {
        const value = item[this.valueField] ?? 0;

        return {
          label: item[this.labelField],
          value,
          share: this.total ? Math.round((value / this.total) * 100) : 0,
        };
      });
    },
  },
};
</script>
