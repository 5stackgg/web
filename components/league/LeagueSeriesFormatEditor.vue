<script setup lang="ts">
import { computed } from "vue";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  calculateRounds,
  type RoundInfo,
} from "~/utilities/tournamentRoundCalculator";

// Per-week best-of (keyed by week number) and per-playoff-round best-of
// (native stage keys: "WB:1", "LB:2", "GF") plus the playoff bracket format,
// reusing the tournament stage configuration components.
const props = defineProps<{
  weeksCount: number;
  playoffSeats: number;
  defaultBestOf: number;
  playoffBestOf: number;
  weekBestOf: Record<string, number>;
  playoffRoundBestOf: Record<string, number>;
  playoffStageType: string;
  playoffThirdPlaceMatch: boolean;
  structureLocked?: boolean;
  // Playoff seats lock later than the bracket structure (only at Playoffs).
  seatsLocked?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:weekBestOf", value: Record<string, number>): void;
  (e: "update:playoffRoundBestOf", value: Record<string, number>): void;
  (e: "update:playoffStageType", value: string): void;
  (e: "update:playoffThirdPlaceMatch", value: boolean): void;
  (e: "update:playoffSeats", value: number): void;
}>();

const BEST_OF_OPTIONS = ["1", "3", "5"];
const STAGE_TYPES = ["SingleElimination", "DoubleElimination"];
// Bracket-friendly seat counts; always include the current value.
const SEAT_OPTIONS = [2, 4, 8, 16];
const seatOptions = computed(() =>
  [...new Set([...SEAT_OPTIONS, props.playoffSeats])].sort((a, b) => a - b),
);

const weeks = computed(() =>
  Array.from({ length: props.weeksCount }, (_, i) => i + 1),
);

function weekValue(week: number): string {
  return String(props.weekBestOf[String(week)] ?? props.defaultBestOf);
}

function updateWeek(week: number, value: string) {
  const updated = { ...props.weekBestOf };
  if (Number(value) === props.defaultBestOf) {
    delete updated[String(week)];
  } else {
    updated[String(week)] = Number(value);
  }
  emit("update:weekBestOf", updated);
}

// Playoff rounds are derived from the bracket type + seat count (same keys as
// get_bracket_best_of), rendered inline so they share the editor's row style.
const playoffRounds = computed<RoundInfo[]>(() => {
  if (!props.playoffStageType || props.playoffSeats < 2) {
    return [];
  }
  return calculateRounds(props.playoffStageType, props.playoffSeats, 1);
});

function roundValue(key: string): string {
  return String(props.playoffRoundBestOf[key] ?? props.playoffBestOf);
}

function updateRound(key: string, value: string) {
  const updated = { ...props.playoffRoundBestOf };
  if (Number(value) === props.playoffBestOf) {
    delete updated[key];
  } else {
    updated[key] = Number(value);
  }
  emit("update:playoffRoundBestOf", updated);
}

function setStageType(type: string) {
  if (props.structureLocked || type === props.playoffStageType) {
    return;
  }
  emit("update:playoffStageType", type);
  // Round keys differ between bracket types; stale overrides would dangle.
  emit("update:playoffRoundBestOf", {});
}
</script>

<template>
  <div class="grid items-start gap-5 lg:grid-cols-2">
    <!-- Regular season (per-week best-of; format is chosen automatically) -->
    <section class="overflow-hidden rounded-lg border border-border/60 bg-[hsl(var(--card)/0.5)]">
      <header
        class="flex items-center gap-2 border-b border-border/50 px-4 py-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("league.series.week_title") }}
      </header>
      <div class="divide-y divide-border/40">
        <div
          v-for="week in weeks"
          :key="week"
          class="flex items-center justify-between gap-4 px-4 py-2.5"
        >
          <span class="text-sm">{{ $t("league.schedule.week", { week }) }}</span>
          <Select
            :model-value="weekValue(week)"
            @update:model-value="(val) => updateWeek(week, val as string)"
          >
            <SelectTrigger class="h-8 w-[92px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="option in BEST_OF_OPTIONS"
                  :key="option"
                  :value="option"
                >
                  BO{{ option }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>

    <!-- Playoffs -->
    <section
      v-if="playoffSeats >= 2"
      class="overflow-hidden rounded-lg border border-border/60 bg-[hsl(var(--card)/0.5)]"
    >
      <header
        class="flex items-center gap-2 border-b border-border/50 px-4 py-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("league.series.playoff_title") }}
      </header>
      <div class="divide-y divide-border/40">
        <!-- Teams that advance -->
        <div
          class="flex items-center justify-between gap-4 px-4 py-3"
          :class="{ 'opacity-60': seatsLocked }"
        >
          <span class="min-w-0">
            <span class="block text-sm">{{
              $t("league.series.advance_count")
            }}</span>
            <span class="block text-[0.7rem] text-muted-foreground">
              {{ $t("league.series.advance_hint") }}
            </span>
          </span>
          <Select
            :model-value="String(playoffSeats)"
            :disabled="seatsLocked"
            @update:model-value="(val) => emit('update:playoffSeats', Number(val))"
          >
            <SelectTrigger class="h-8 w-[84px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="n in seatOptions" :key="n" :value="String(n)">
                  {{ n }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <!-- Bracket type (segmented) -->
        <div class="space-y-2 px-4 py-3">
          <span class="block text-sm">{{ $t("league.series.bracket_type") }}</span>
          <div class="grid grid-cols-2 gap-1 rounded-md border border-border/60 bg-muted/20 p-1">
            <button
              v-for="type in STAGE_TYPES"
              :key="type"
              type="button"
              class="rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed"
              :class="
                playoffStageType === type
                  ? 'bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))] shadow-[inset_0_0_0_1px_hsl(var(--tac-amber)/0.35)]'
                  : 'text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground'
              "
              :disabled="structureLocked"
              @click="setStageType(type)"
            >
              {{ $t(`league.series.stage_types.${type}`) }}
            </button>
          </div>
          <p v-if="structureLocked" class="text-[0.7rem] text-muted-foreground">
            {{ $t("league.series.structure_locked") }}
          </p>
        </div>

        <!-- Third-place decider (single-elim only) -->
        <label
          v-if="playoffStageType === 'SingleElimination'"
          class="flex items-center justify-between gap-4 px-4 py-3"
          :class="{ 'opacity-60': structureLocked }"
        >
          <span class="text-sm">{{ $t("league.series.third_place_match") }}</span>
          <Switch
            :model-value="playoffThirdPlaceMatch"
            :disabled="structureLocked"
            @update:model-value="emit('update:playoffThirdPlaceMatch', $event)"
          />
        </label>

        <!-- Per-round best-of -->
        <div
          v-if="playoffRounds.length"
          class="bg-muted/[0.04] px-4 pb-1 pt-2.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("tournament.stage.per_round_best_of") }}
        </div>
        <div
          v-for="round in playoffRounds"
          :key="round.key"
          class="flex items-center justify-between gap-4 bg-muted/[0.04] px-4 py-2.5"
        >
          <span class="text-sm">{{
            $t(round.label.key, round.label.params)
          }}</span>
          <Select
            :model-value="roundValue(round.key)"
            @update:model-value="(val) => updateRound(round.key, val as string)"
          >
            <SelectTrigger class="h-8 w-[92px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="option in BEST_OF_OPTIONS"
                  :key="option"
                  :value="option"
                >
                  BO{{ option }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  </div>
</template>
