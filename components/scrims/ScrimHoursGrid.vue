<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { Button } from "~/components/ui/button";
import { dateLocale } from "~/utilities/dateLocale";
import { weekdayName } from "~/utilities/scrimFormat";
import {
  GRACE_MINUTES,
  joinMidnight,
  type DayRanges,
} from "~/utilities/scrimSchedule";

const SLOT_MINUTES = 15;
const SLOTS = 1440 / SLOT_MINUTES;
const PER_HOUR = 60 / SLOT_MINUTES;
const WEEK = 7 * SLOTS;
const PLAYTIME_SLOTS = GRACE_MINUTES / SLOT_MINUTES;
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SERIES = [1, 3, 5];

const props = defineProps<{ modelValue: DayRanges }>();
const emit = defineEmits<{ "update:modelValue": [ranges: DayRanges] }>();

const gridStyle = {
  gridTemplateColumns: `3.5rem repeat(${SLOTS}, minmax(0, 1fr))`,
};
const hours = Array.from({ length: 12 }, (_, index) => {
  const hour = index * 2;
  return {
    column: `${hour * PER_HOUR + 2} / span ${PER_HOUR * 2}`,
    label: new Date(1970, 0, 4, hour).toLocaleTimeString(dateLocale(), {
      hour: "numeric",
    }),
  };
});

const painted = computed(() => {
  const cells = new Array<boolean>(WEEK).fill(false);
  props.modelValue.forEach((day, dow) => {
    for (const [start, end] of day) {
      for (let minute = start; minute < end; minute += SLOT_MINUTES) {
        cells[(dow * SLOTS + Math.floor(minute / SLOT_MINUTES)) % WEEK] = true;
      }
    }
  });
  return cells;
});

// A scrim started in the last painted slot still runs for the grace hour.
const playtime = computed(() => {
  const on = painted.value;
  const cells = new Array<boolean>(WEEK).fill(false);
  for (let i = 0; i < WEEK; i++) {
    if (!on[i] || on[(i + 1) % WEEK]) continue;
    for (let k = 1; k <= PLAYTIME_SLOTS && !on[(i + k) % WEEK]; k++) {
      cells[(i + k) % WEEK] = true;
    }
  }
  return cells;
});

const longestHours = computed(() => {
  let best = 0;
  let run = 0;
  for (let i = 0; i < 2 * WEEK; i++) {
    run = painted.value[i % WEEK] || playtime.value[i % WEEK] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return Math.min(best, WEEK) / PER_HOUR;
});
const series = computed(() =>
  SERIES.map((n) => ({ n, fits: longestHours.value >= n })),
);
const locked = computed(() => series.value.find((option) => !option.fits));

function cellClass(dow: number, slot: number) {
  const index = dow * SLOTS + slot;
  return [
    painted.value[index]
      ? "bg-[hsl(var(--tac-amber)/0.85)] [@media(hover:hover)]:hover:bg-[hsl(var(--tac-amber))]"
      : playtime.value[index]
        ? "bg-[hsl(var(--tac-amber)/0.28)] [@media(hover:hover)]:hover:bg-[hsl(var(--tac-amber)/0.4)]"
        : "bg-card/40 [@media(hover:hover)]:hover:bg-muted/60",
    slot % PER_HOUR === 0
      ? "border-l border-l-border"
      : "border-l border-l-border/30",
    slot === SLOTS - 1 ? "border-r border-r-border" : "",
  ];
}

function rangesFrom(cells: boolean[]): DayRanges {
  const ranges: DayRanges = Array.from({ length: 7 }, () => []);
  for (let dow = 0; dow < 7; dow++) {
    for (let slot = 0; slot < SLOTS; slot++) {
      if (!cells[dow * SLOTS + slot]) continue;
      const start = slot;
      while (slot + 1 < SLOTS && cells[dow * SLOTS + slot + 1]) slot++;
      ranges[dow].push([start * SLOT_MINUTES, (slot + 1) * SLOT_MINUTES]);
    }
  }
  return joinMidnight(ranges);
}

let drag: {
  row: number;
  slot: number;
  add: boolean;
  base: boolean[];
  last: string;
} | null = null;

function cellAt(event: PointerEvent) {
  const data = (event.target as HTMLElement).dataset;
  return data?.slot == null
    ? null
    : { row: Number(data.row), slot: Number(data.slot) };
}

function paint(row: number, slot: number) {
  const from = drag;
  if (!from || from.last === `${row}-${slot}`) return;
  from.last = `${row}-${slot}`;
  const next = from.base.slice();
  for (let r = Math.min(from.row, row); r <= Math.max(from.row, row); r++) {
    for (let s = Math.min(from.slot, slot); s <= Math.max(from.slot, slot); s++) {
      next[DAY_ORDER[r] * SLOTS + s] = from.add;
    }
  }
  emit("update:modelValue", rangesFrom(next));
}

function onDown(event: PointerEvent) {
  const cell = cellAt(event);
  if (!cell || event.button !== 0) return;
  event.preventDefault();
  // Touch captures the pointer to the first cell; release it so the
  // cells under the finger receive the move.
  (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  drag = {
    ...cell,
    add: !painted.value[DAY_ORDER[cell.row] * SLOTS + cell.slot],
    base: painted.value.slice(),
    last: "",
  };
  paint(cell.row, cell.slot);
}

function onMove(event: PointerEvent) {
  const cell = drag && cellAt(event);
  if (cell) paint(cell.row, cell.slot);
}

function onUp() {
  drag = null;
}

onMounted(() => {
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
});
onBeforeUnmount(() => {
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointercancel", onUp);
});
</script>

<template>
  <div class="space-y-3">
    <div class="relative overflow-hidden rounded-md">
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(135deg,hsl(var(--tac-amber))_0,hsl(var(--tac-amber))_1px,transparent_1px,transparent_9px)]"
      />
      <div class="relative overflow-x-auto">
        <div class="min-w-[40rem] select-none">
          <div class="grid" :style="gridStyle">
            <div />
            <div
              v-for="hour in hours"
              :key="hour.column"
              class="pb-1 text-xs text-muted-foreground"
              :style="{ gridColumn: hour.column }"
            >
              {{ hour.label }}
            </div>
          </div>
          <div
            class="grid touch-none gap-y-1"
            :style="gridStyle"
            @pointerdown="onDown"
            @pointermove="onMove"
          >
            <template v-for="(dow, row) in DAY_ORDER" :key="dow">
              <div
                class="flex items-center justify-end pr-3 text-sm text-muted-foreground"
              >
                {{ weekdayName(dow) }}
              </div>
              <div
                v-for="slot in SLOTS"
                :key="slot"
                :data-row="row"
                :data-slot="slot - 1"
                class="h-6 border-y border-border/50 transition-colors"
                :class="cellClass(dow, slot - 1)"
              />
            </template>
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground"
    >
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm bg-[hsl(var(--tac-amber)/0.85)]" />
        {{ $t("scrim.available_start") }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm bg-[hsl(var(--tac-amber)/0.28)]" />
        {{ $t("scrim.playtime_legend") }}
      </span>
    </div>

    <div
      v-if="longestHours"
      class="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-xs"
    >
      <span class="font-medium text-foreground">
        {{
          $t("scrim.longest_block", {
            hours: longestHours.toLocaleString(dateLocale(), {
              maximumFractionDigits: 2,
            }),
          })
        }}
      </span>
      <span class="text-muted-foreground">{{ $t("scrim.opponents_can_request") }}</span>
      <span
        v-for="option in series"
        :key="option.n"
        class="rounded border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em]"
        :class="
          option.fits
            ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
            : 'border-border text-muted-foreground/50 line-through'
        "
      >
        Bo{{ option.n }}
      </span>
      <span v-if="locked" class="text-muted-foreground">
        {{ $t("scrim.paint_to_unlock", { hours: locked.n, format: `Bo${locked.n}` }) }}
      </span>
    </div>

    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-muted-foreground">
        {{ $t("scrim.availability_grid_help") }}
      </p>
      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground hover:text-destructive"
        :disabled="!longestHours"
        @click="emit('update:modelValue', Array.from({ length: 7 }, () => []))"
      >
        {{ $t("common.clear") }}
      </Button>
    </div>
  </div>
</template>
