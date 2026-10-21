<script setup lang="ts">
import { computed } from "vue";
import type { DemoStep } from "~/composables/useDemoMatch";
import { DEMO_LINEUPS } from "~/utilities/demoMatch";

const props = defineProps<{
  step: DemoStep;
  paused?: boolean;
  liveScore: [number, number];
}>();

const status = computed(() => {
  if (props.step === "veto") {
    return {
      label: "match.admin_bar.steps.veto",
      tone: "text-[hsl(var(--tac-amber))]",
      ping: false,
    };
  }
  if (props.step === "finished") {
    return {
      label: "match.admin_bar.steps.finished",
      tone: "text-success",
      ping: false,
    };
  }
  if (props.paused) {
    return {
      label: "match.admin_bar.steps.paused",
      tone: "text-[hsl(var(--tac-amber))]",
      ping: false,
    };
  }
  return {
    label: "match.admin_bar.steps.live",
    tone: "text-destructive",
    ping: true,
  };
});

const series = computed<[number, number]>(() =>
  props.step === "veto" ? [0, 0] : props.step === "finished" ? [2, 0] : [1, 0],
);

const maps = computed(() => {
  if (props.step === "veto") {
    return [];
  }
  return [
    { id: "mirage", label: "Mirage", score: "13–9", live: false },
    {
      id: "ancient",
      label: "Ancient",
      score:
        props.step === "finished"
          ? "13–10"
          : `${props.liveScore[0]}–${props.liveScore[1]}`,
      live: props.step === "live",
    },
  ];
});
</script>

<template>
  <section
    class="relative isolate overflow-hidden rounded-2xl bg-muted/20 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-white/[0.07]"
  >
    <div
      class="grid gap-4 bg-[linear-gradient(180deg,rgb(255_255_255/0.035),transparent_70%)] px-4 pb-5 pt-4 md:px-6"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          class="inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold"
          :class="status.tone"
        >
          <span class="relative flex size-2 shrink-0">
            <span
              v-if="status.ping"
              class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75 motion-reduce:animate-none"
            />
            <span class="relative inline-flex size-2 rounded-full bg-current" />
          </span>
          <span class="text-foreground">{{ $t(status.label) }}</span>
        </span>
        <span class="text-[13px] text-muted-foreground">
          {{ $t("faq.demo.series_label") }}
        </span>
      </div>

      <div class="flex items-center justify-center gap-4 sm:gap-8">
        <div class="flex min-w-0 flex-1 items-center justify-end gap-3">
          <span class="truncate text-xl font-bold sm:text-2xl">{{
            DEMO_LINEUPS[1].name
          }}</span>
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-lg font-extrabold text-[hsl(var(--tac-amber))]"
          >
            {{ DEMO_LINEUPS[1].tag }}
          </span>
        </div>
        <span class="shrink-0 text-3xl font-extrabold tabular-nums sm:text-4xl">
          {{ series[0] }}<span class="px-3 text-muted-foreground/40">:</span
          >{{ series[1] }}
        </span>
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg border border-[hsl(var(--tac-blue)/0.45)] bg-[hsl(var(--tac-blue)/0.12)] text-lg font-extrabold text-[hsl(var(--tac-blue))]"
          >
            {{ DEMO_LINEUPS[2].tag }}
          </span>
          <span class="truncate text-xl font-bold sm:text-2xl">{{
            DEMO_LINEUPS[2].name
          }}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2">
        <span
          v-for="map in maps"
          :key="map.id"
          class="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs"
          :class="
            map.live
              ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
              : 'border-border bg-background/40'
          "
        >
          <span class="font-semibold">{{ map.label }}</span>
          <span
            class="tabular-nums text-muted-foreground"
            :class="map.live && 'text-[hsl(var(--tac-amber))]'"
          >
            {{ map.score }}
          </span>
        </span>
        <span
          v-if="step !== 'veto'"
          class="inline-flex items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground"
        >
          {{
            step === "finished"
              ? $t("faq.demo.not_needed")
              : $t("match.veto_rewind.decider")
          }}
        </span>
      </div>
    </div>
  </section>
</template>
