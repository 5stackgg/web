<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { Button } from "@/components/ui/button";
import {
  SLOTS,
  SLOTS_PER_HOUR,
  buildAvailableSet,
  buildPlaytimeSet,
} from "~/utilities/scrimAvailability";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
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
  components: { Button },
  props: {
    teamId: {
      type: String,
      required: true,
    },
  },
  emits: ["change"],
  data() {
    return {
      DAYS,
      SLOTS,
      HOUR_LABELS,
      selected: new Set<string>(),
      dragging: false,
      dragMode: "add" as "add" | "remove",
      anchor: null as { day: number; slot: number } | null,
      base: new Set<string>(),
      lastRows: [] as Array<any>,
      dirty: false,
      saving: false,
    };
  },
  computed: {
    gridStyle() {
      return {
        gridTemplateColumns: `7rem repeat(${SLOTS}, minmax(0, 1fr))`,
      };
    },
    playtimeSet() {
      return buildPlaytimeSet(this.selected);
    },
    maxFreeHours(): number {
      const N = 7 * SLOTS;
      const free = new Array(N).fill(false);
      for (const key of this.selected) {
        const [day, slot] = key.split("-").map(Number);
        free[day * SLOTS + slot] = true;
      }
      for (const key of this.playtimeSet) {
        const [day, slot] = key.split("-").map(Number);
        free[day * SLOTS + slot] = true;
      }
      let best = 0;
      let run = 0;
      for (let i = 0; i < 2 * N; i++) {
        if (free[i % N]) {
          run += 1;
          best = Math.max(best, run);
        } else {
          run = 0;
        }
      }
      return Math.min(best, N) / SLOTS_PER_HOUR;
    },
    bestOfSupport(): { bo3: boolean; bo5: boolean } {
      return {
        bo3: this.maxFreeHours >= 3,
        bo5: this.maxFreeHours >= 5,
      };
    },
  },
  apollo: {
    $subscribe: {
      team_scrim_availability: {
        query: typedGql("subscription")({
          team_scrim_availability: [
            { where: { team_id: { _eq: $("teamId", "uuid!") } } },
            {
              id: true,
              starts_at: true,
              ends_at: true,
              recurring_weekly: true,
            },
          ],
        }),
        variables() {
          return { teamId: this.teamId };
        },
        result({ data }) {
          this.lastRows = data.team_scrim_availability ?? [];
          if (this.dragging || this.dirty || this.saving) {
            return;
          }
          this.hydrate(this.lastRows);
        },
      },
    },
  },
  mounted() {
    window.addEventListener("pointerup", this.onPointerUp);
  },
  beforeUnmount() {
    window.removeEventListener("pointerup", this.onPointerUp);
  },
  methods: {
    cellKey(day: number, slot: number): string {
      return `${day}-${slot}`;
    },
    isPlaytime(day: number, slot: number): boolean {
      return this.playtimeSet.has(`${day}-${slot}`);
    },
    isSelected(day: number, slot: number): boolean {
      return this.selected.has(this.cellKey(day, slot));
    },
    isHourMark(slot: number): boolean {
      return slot % SLOTS_PER_HOUR === 0;
    },
    applyRect(day: number, slot: number) {
      if (!this.anchor) {
        return;
      }
      const next = new Set(this.base);
      const dayMin = Math.min(this.anchor.day, day);
      const dayMax = Math.max(this.anchor.day, day);
      const slotMin = Math.min(this.anchor.slot, slot);
      const slotMax = Math.max(this.anchor.slot, slot);

      for (let d = dayMin; d <= dayMax; d++) {
        for (let s = slotMin; s <= slotMax; s++) {
          const key = this.cellKey(d, s);
          if (this.dragMode === "add") {
            next.add(key);
          } else {
            next.delete(key);
          }
        }
      }

      this.selected = next;
      this.markDirty();
    },
    markDirty() {
      this.dirty = true;
      this.$emit("change");
    },
    onCellDown(day: number, slot: number) {
      this.dragging = true;
      this.dragMode = this.isSelected(day, slot) ? "remove" : "add";
      this.anchor = { day, slot };
      this.base = new Set(this.selected);
      this.applyRect(day, slot);
    },
    onCellEnter(day: number, slot: number) {
      if (this.dragging) {
        this.applyRect(day, slot);
      }
    },
    onPointerUp() {
      this.dragging = false;
      this.anchor = null;
    },
    hydrate(rows: Array<any>) {
      this.selected = buildAvailableSet(
        rows.filter((row) => row.recurring_weekly),
      );
    },
    refDate(day: number, slot: number): Date {
      return new Date(
        1970,
        0,
        4 + day,
        Math.floor(slot / SLOTS_PER_HOUR),
        (slot % SLOTS_PER_HOUR) * 15,
        0,
        0,
      );
    },
    buildWindows() {
      const objects: Array<{
        team_id: string;
        starts_at: string;
        ends_at: string;
        recurring_weekly: boolean;
      }> = [];

      for (let day = 0; day < 7; day++) {
        const slots: Array<number> = [];
        for (let slot = 0; slot < SLOTS; slot++) {
          if (this.selected.has(this.cellKey(day, slot))) {
            slots.push(slot);
          }
        }

        let i = 0;
        while (i < slots.length) {
          let j = i;
          while (j + 1 < slots.length && slots[j + 1] === slots[j] + 1) {
            j++;
          }
          objects.push({
            team_id: this.teamId,
            starts_at: this.refDate(day, slots[i]).toISOString(),
            ends_at: this.refDate(day, slots[j] + 1).toISOString(),
            recurring_weekly: true,
          });
          i = j + 1;
        }
      }

      return objects;
    },
    async save() {
      if (!this.dirty) {
        return;
      }
      this.saving = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            delete_team_scrim_availability: [
              {
                where: {
                  team_id: { _eq: this.teamId },
                  recurring_weekly: { _eq: true },
                },
              },
              { affected_rows: true },
            ],
          }),
        });

        const objects = this.buildWindows();
        if (objects.length > 0) {
          await this.$apollo.mutate({
            mutation: generateMutation({
              insert_team_scrim_availability: [
                { objects },
                { affected_rows: true },
              ],
            }),
          });
        }
        this.dirty = false;
      } finally {
        this.saving = false;
      }
    },
    clearAll() {
      this.selected = new Set<string>();
      this.markDirty();
    },
    reset() {
      this.dirty = false;
      this.hydrate(this.lastRows);
    },
  },
};
</script>

<template>
  <div class="space-y-3">
    <div class="relative overflow-hidden rounded-md">
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(135deg,hsl(var(--tac-amber))_0,hsl(var(--tac-amber))_1px,transparent_1px,transparent_9px)]"
      />
      <div class="relative overflow-x-auto">
        <div class="min-w-[1100px] select-none">
        <div class="grid" :style="gridStyle">
          <div></div>
          <div
            v-for="hour in HOUR_LABELS"
            :key="hour.label"
            class="pb-1 text-xs text-muted-foreground"
            :style="{ gridColumn: `${hour.slot + 2} / span 4` }"
          >
            {{ hour.label }}
          </div>
        </div>

        <div class="grid gap-y-1" :style="gridStyle">
          <template v-for="(day, dayIndex) in DAYS" :key="day">
            <div
              class="flex items-center justify-end pr-3 text-sm text-muted-foreground"
            >
              {{ day }}
            </div>
            <button
              v-for="slot in SLOTS"
              :key="`${dayIndex}-${slot}`"
              type="button"
              class="h-6 border-b border-t border-border/50 transition-colors"
              :title="
                isPlaytime(dayIndex, slot - 1)
                  ? 'Playtime — a scrim started here would still be running'
                  : ''
              "
              :class="[
                isSelected(dayIndex, slot - 1)
                  ? 'bg-[hsl(var(--tac-amber)/0.85)] hover:bg-[hsl(var(--tac-amber))]'
                  : isPlaytime(dayIndex, slot - 1)
                    ? 'bg-[hsl(var(--tac-amber)/0.28)] hover:bg-[hsl(var(--tac-amber)/0.4)]'
                    : 'bg-card/40 hover:bg-muted/60',
                isHourMark(slot - 1)
                  ? 'border-l border-l-border'
                  : 'border-l border-l-border/30',
                slot === SLOTS ? 'border-r border-r-border' : '',
              ]"
              @pointerdown.prevent="onCellDown(dayIndex, slot - 1)"
              @pointerenter="onCellEnter(dayIndex, slot - 1)"
              @pointermove="onCellEnter(dayIndex, slot - 1)"
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
        Available start
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm bg-[hsl(var(--tac-amber)/0.28)]" />
        Playtime (~1 hour)
      </span>
    </div>

    <div
      class="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-xs"
    >
      <span class="font-medium text-foreground">
        Longest block ≈ {{ maxFreeHours.toFixed(maxFreeHours % 1 ? 2 : 0) }}h
      </span>
      <span class="text-muted-foreground">— opponents can request</span>
      <span
        class="rounded border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
      >
        Bo1
      </span>
      <span
        class="rounded border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em]"
        :class="
          bestOfSupport.bo3
            ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
            : 'border-border text-muted-foreground/50 line-through'
        "
      >
        Bo3
      </span>
      <span
        class="rounded border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em]"
        :class="
          bestOfSupport.bo5
            ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
            : 'border-border text-muted-foreground/50 line-through'
        "
      >
        Bo5
      </span>
      <span v-if="!bestOfSupport.bo5" class="text-muted-foreground">
        — paint a {{ bestOfSupport.bo3 ? "5" : "3" }}h+ block to unlock
        {{ bestOfSupport.bo3 ? "Bo5" : "Bo3" }}.
      </span>
    </div>

    <div class="flex items-center justify-between">
      <p class="text-xs text-muted-foreground">
        Drag to paint the <strong>start times</strong> your team is available
        (local time). A scrim runs about an hour, so the faded blocks show your
        real commitment.
      </p>
      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground hover:text-destructive"
        @click="clearAll"
      >
        Clear
      </Button>
    </div>
  </div>
</template>
