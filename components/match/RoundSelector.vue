<script lang="ts" setup>
import { computed, ref, watch, nextTick } from "vue";

type RoundEntry = {
  round: number;
  winnerSide?: "CT" | "T" | null;
  label?: string;
};

const props = withDefaults(
  defineProps<{
    rounds: RoundEntry[];
    modelValue?: number | null;
    allowAll?: boolean;
    allLabel?: string;
    halftimeIndex?: number | null;
  }>(),
  {
    modelValue: null,
    allowAll: false,
    allLabel: "ALL",
    halftimeIndex: null,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: number | null): void;
}>();

const scroller = ref<HTMLElement | null>(null);

function select(round: number | null) {
  emit("update:modelValue", round);
}

function isActive(round: number): boolean {
  return props.modelValue === round;
}

function underlineClass(side?: "CT" | "T" | null): string {
  if (side === "CT") {
    return "bg-sky-400 shadow-[0_0_6px_theme(colors.sky.400)]";
  }
  if (side === "T") {
    return "bg-amber-400 shadow-[0_0_6px_theme(colors.amber.400)]";
  }
  return "bg-muted-foreground/25";
}

watch(
  () => props.modelValue,
  async (round) => {
    if (round == null) {
      return;
    }
    await nextTick();
    const el = scroller.value?.querySelector(
      `[data-round="${round}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  },
);
</script>

<template>
  <div class="flex items-stretch gap-1.5 select-none">
    <button
      v-if="allowAll"
      type="button"
      data-round="all"
      class="group shrink-0 self-start py-1 cursor-pointer"
      @click="select(null)"
    >
      <span
        :class="[
          'flex items-center justify-center h-7 px-2.5 whitespace-nowrap rounded-sm font-mono text-[12px] font-bold uppercase tracking-[0.14em] tabular-nums leading-none transition-colors border',
          modelValue == null
            ? 'bg-[hsl(var(--tac-amber)/0.18)] border-[hsl(var(--tac-amber)/0.7)] text-[hsl(var(--tac-amber))]'
            : 'bg-card/60 border-border/60 text-muted-foreground group-hover:text-foreground group-hover:border-border',
        ]"
      >
        {{ allLabel }}
      </span>
    </button>

    <div
      ref="scroller"
      class="round-selector__scroll relative min-w-0 flex-1 overflow-x-auto pb-2.5 -mb-2.5"
    >
      <div class="flex items-end gap-1 w-max px-0.5 py-1">
        <template v-for="(entry, index) in rounds" :key="entry.round">
          <span
            v-if="halftimeIndex != null && index === halftimeIndex"
            class="shrink-0 self-stretch mx-1 my-0.5 w-px border-l border-dashed border-border/70"
            aria-hidden="true"
          />

          <button
            type="button"
            :data-round="entry.round"
            class="group flex shrink-0 flex-col items-center gap-1.5 cursor-pointer"
            @click="select(entry.round)"
          >
            <span
              :class="[
                'flex items-center justify-center h-7 min-w-7 px-1.5 rounded-sm font-mono text-[12px] font-bold tabular-nums leading-none transition-colors border',
                isActive(entry.round)
                  ? 'bg-[hsl(var(--tac-amber)/0.18)] border-[hsl(var(--tac-amber)/0.7)] text-[hsl(var(--tac-amber))]'
                  : 'bg-transparent border-transparent text-muted-foreground group-hover:text-foreground',
              ]"
            >
              {{ entry.label ?? entry.round }}
            </span>
            <span
              :class="[
                'h-[3px] w-full rounded-full transition-all',
                underlineClass(entry.winnerSide),
                isActive(entry.round) ? 'opacity-100' : 'opacity-80',
              ]"
            />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.round-selector__scroll {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;
}
.round-selector__scroll::-webkit-scrollbar {
  height: 4px;
}
.round-selector__scroll::-webkit-scrollbar-track {
  background: transparent;
}
.round-selector__scroll::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 2px;
}
.round-selector__scroll::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--muted-foreground));
}
</style>
