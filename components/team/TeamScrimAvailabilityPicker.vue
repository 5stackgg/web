<script lang="ts">
import {
  SLOTS,
  SLOTS_PER_HOUR,
  buildAvailableSet,
  buildPlaytimeSet,
  buildFreeSet,
  durationSlots,
  slotFits,
} from "~/utilities/scrimAvailability";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => ({
  slot: hour * SLOTS_PER_HOUR,
  label:
    hour === 0
      ? "12a"
      : hour < 12
        ? `${hour}a`
        : hour === 12
          ? "12p"
          : `${hour - 12}p`,
}));

export default {
  props: {
    availability: {
      type: Array as () => Array<any>,
      default: () => [],
    },
    modelValue: {
      type: Object as () => { day: number; slot: number } | null,
      default: null,
    },
    bestOf: {
      type: Number,
      default: 1,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      DAYS,
      SLOTS,
      HOUR_LABELS,
    };
  },
  computed: {
    activeDays(): Array<number> {
      const days = new Set<number>();
      for (const key of this.availableSet) {
        days.add(Number(key.split("-")[0]));
      }
      for (const key of this.playtimeSet) {
        days.add(Number(key.split("-")[0]));
      }
      return Array.from(days).sort((a, b) => a - b);
    },
    displaySlots(): Array<number> {
      const slots = new Set<number>();
      for (const key of this.availableSet) {
        slots.add(Number(key.split("-")[1]));
      }
      for (const key of this.playtimeSet) {
        slots.add(Number(key.split("-")[1]));
      }
      if (slots.size === 0) {
        return [];
      }
      const sorted = Array.from(slots).sort((a, b) => a - b);
      let maxGap = -1;
      let gapIdx = 0;
      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        const next = sorted[(i + 1) % sorted.length];
        const gap = (next - cur + SLOTS) % SLOTS;
        if (gap > maxGap) {
          maxGap = gap;
          gapIdx = i;
        }
      }
      const start = (sorted[(gapIdx + 1) % sorted.length] - 2 + SLOTS) % SLOTS;
      const end = (sorted[gapIdx] + 2) % SLOTS;
      const len = ((end - start + SLOTS) % SLOTS) + 1;
      const out: Array<number> = [];
      for (let i = 0; i < len; i++) {
        out.push((start + i) % SLOTS);
      }
      return out;
    },
    hourLabels(): Array<{ col: number; label: string }> {
      const out: Array<{ col: number; label: string }> = [];
      this.displaySlots.forEach((slot, idx) => {
        if (slot % SLOTS_PER_HOUR === 0) {
          out.push({
            col: idx + 2,
            label: HOUR_LABELS[slot / SLOTS_PER_HOUR].label,
          });
        }
      });
      return out;
    },
    gridStyle() {
      return {
        gridTemplateColumns: `2.75rem repeat(${this.displaySlots.length}, minmax(0, 1fr))`,
      };
    },
    durationSlots(): number {
      return durationSlots(this.bestOf);
    },
    availableSet(): Set<string> {
      return buildAvailableSet(this.availability);
    },
    playtimeSet(): Set<string> {
      return buildPlaytimeSet(this.availableSet);
    },
    freeSet(): Set<string> {
      return buildFreeSet(this.availableSet);
    },
    reservedSet(): Set<string> {
      const set = new Set<string>();
      if (this.modelValue) {
        for (let i = 1; i < this.durationSlots; i++) {
          const abs = this.modelValue.slot + i;
          const day = (this.modelValue.day + Math.floor(abs / SLOTS)) % 7;
          set.add(`${day}-${abs % SLOTS}`);
        }
      }
      return set;
    },
  },
  methods: {
    isHourMark(slot: number): boolean {
      return slot % SLOTS_PER_HOUR === 0;
    },
    isAvailable(day: number, slot: number): boolean {
      return this.availableSet.has(`${day}-${slot}`);
    },
    isSelectable(day: number, slot: number): boolean {
      return slotFits(this.freeSet, day, slot, this.durationSlots);
    },
    isReserved(day: number, slot: number): boolean {
      return this.reservedSet.has(`${day}-${slot}`);
    },
    isStart(day: number, slot: number): boolean {
      return this.modelValue?.day === day && this.modelValue?.slot === slot;
    },
    pick(day: number, slot: number) {
      if (!this.isSelectable(day, slot)) {
        return;
      }
      this.$emit("update:modelValue", { day, slot });
    },
  },
};
</script>

<template>
  <div>
    <p
      v-if="displaySlots.length === 0"
      class="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
    >
      {{ $t("scrim.no_availability_set") }}
    </p>

    <div v-else class="overflow-x-auto">
      <div class="min-w-[280px] select-none">
        <div class="grid" :style="gridStyle">
          <div></div>
          <div
            v-for="hour in hourLabels"
            :key="hour.col"
            class="pb-1 text-[0.6rem] text-muted-foreground"
            :style="{ gridColumn: `${hour.col} / span 4` }"
          >
            {{ hour.label }}
          </div>
        </div>

        <div class="grid gap-y-1" :style="gridStyle">
          <template v-for="dayIndex in activeDays" :key="dayIndex">
            <div
              class="flex items-center justify-end pr-2 text-xs text-muted-foreground"
            >
              {{ DAYS[dayIndex] }}
            </div>
            <button
              v-for="(slot, sIdx) in displaySlots"
              :key="`${dayIndex}-${slot}`"
              type="button"
              :disabled="!isSelectable(dayIndex, slot)"
              class="relative h-6 border-b border-t border-border/40 transition-colors"
              :class="[
                isStart(dayIndex, slot)
                  ? 'z-10 bg-[hsl(var(--tac-amber))] ring-2 ring-inset ring-white/80'
                  : isReserved(dayIndex, slot)
                    ? 'bg-[hsl(var(--tac-amber)/0.32)]'
                    : isSelectable(dayIndex, slot)
                      ? 'cursor-pointer bg-[hsl(var(--tac-amber)/0.75)] hover:bg-[hsl(var(--tac-amber)/0.95)]'
                      : 'cursor-not-allowed bg-card/30',
                isHourMark(slot)
                  ? 'border-l border-l-border'
                  : 'border-l border-l-border/20',
                sIdx === displaySlots.length - 1 ? 'border-r border-r-border' : '',
              ]"
              @click="pick(dayIndex, slot)"
            />
          </template>
        </div>
      </div>
    </div>

    <div
      class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground"
    >
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm bg-[hsl(var(--tac-amber)/0.75)]" />
        {{ $t("scrim.available_start") }}
      </span>
      <span class="flex items-center gap-1.5">
        <span
          class="h-3 w-3 rounded-sm bg-[hsl(var(--tac-amber))] ring-2 ring-inset ring-white/80"
        />
        {{ $t("scrim.selected_start") }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm bg-[hsl(var(--tac-amber)/0.32)]" />
        {{ $t("scrim.match_window", { hours: bestOf }) }}
      </span>
    </div>
  </div>
</template>
