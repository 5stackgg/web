<script setup lang="ts">
import { computed } from "vue";
import type { Cs2BuildTone } from "~/types/cs2Build";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle: string;
    tone: Cs2BuildTone;
    status: string;
    running?: boolean;
    stats?: Array<{ label: string; value: number | string; tone?: Cs2BuildTone }>;
    listClass?: string;
  }>(),
  {
    running: false,
    stats: () => [],
    listClass: "h-[200px]",
  },
);

const TONES: Record<Cs2BuildTone, { text: string; pill: string; rail: string }> =
  {
    success: {
      text: "text-success",
      pill: "border-success/30 bg-success/10 text-success",
      rail: "bg-success",
    },
    warning: {
      text: "text-[hsl(var(--tac-amber))]",
      pill: "border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]",
      rail: "bg-[hsl(var(--tac-amber))]",
    },
    destructive: {
      text: "text-destructive",
      pill: "border-destructive/30 bg-destructive/10 text-destructive",
      rail: "bg-destructive",
    },
    running: {
      text: "text-info",
      pill: "border-info/30 bg-info/10 text-info",
      rail: "bg-info",
    },
    idle: {
      text: "text-muted-foreground",
      pill: "border-border bg-muted/30 text-muted-foreground",
      rail: "bg-muted-foreground/30",
    },
  };

const tone = computed(() => TONES[props.tone]);

const statTone = (value?: Cs2BuildTone) =>
  value ? TONES[value].text : "text-foreground";
</script>

<template>
  <section class="relative flex min-w-0 flex-col gap-4 p-4 sm:p-5">
    <span
      class="absolute inset-y-0 left-0 w-[3px]"
      :class="tone.rail"
      aria-hidden="true"
    />

    <div class="flex items-center gap-3">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-[hsl(var(--tac-amber))] [&_svg]:h-[18px] [&_svg]:w-[18px]"
      >
        <slot name="icon" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="text-sm font-semibold">{{ title }}</span>
        <span class="truncate text-xs text-muted-foreground">{{ subtitle }}</span>
      </div>
      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
        :class="tone.pill"
      >
        <slot name="status-icon" />
        {{ status }}
      </span>
    </div>

    <div
      class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[0.68rem] text-muted-foreground"
    >
      <slot name="meta" />
    </div>

    <div
      v-if="running"
      class="h-[3px] overflow-hidden rounded bg-muted"
      :class="tone.text"
    >
      <div class="tac-scan-sweep h-full" />
    </div>

    <div
      v-if="stats.length"
      class="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      <div
        v-for="stat of stats"
        :key="stat.label"
        class="flex flex-col rounded-md border border-border px-3 py-2"
      >
        <span
          class="text-lg font-semibold tabular-nums"
          :class="statTone(stat.tone)"
        >
          {{ stat.value }}
        </span>
        <span
          class="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{ stat.label }}
        </span>
      </div>
    </div>

    <div
      class="flex flex-col overflow-hidden rounded-md border border-border bg-background/40"
      :class="listClass"
    >
      <div
        class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2"
      >
        <slot name="list-header" />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <slot name="list" />
      </div>
    </div>

    <slot name="details" />

    <div class="mt-auto flex flex-wrap items-start justify-between gap-3">
      <slot name="footer" />
    </div>
  </section>
</template>
