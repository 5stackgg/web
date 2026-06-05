<script setup lang="ts">
import StatLabel from "~/components/common/StatLabel.vue";
import { kdColor } from "~/utils/statTiers";
defineProps<{
  stats: {
    name?: string;
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    kd: string;
    hsPct: number | null;
    adr: number | null;
  };
}>();
</script>

<template>
  <div
    class="relative overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.06)]"
  >
    <span
      aria-hidden="true"
      class="absolute inset-y-0 left-0 w-0.5 bg-[hsl(var(--tac-amber)/0.65)]"
    ></span>

    <div
      class="grid grid-cols-3 gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-6 sm:gap-x-4"
    >
      <div class="flex flex-col items-start">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("match.player_strip.kills") }}
        </span>
        <span
          class="text-xl font-bold leading-none tabular-nums text-foreground"
        >
          {{ stats.kills }}
        </span>
      </div>

      <div class="flex flex-col items-start">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("match.player_strip.deaths") }}
        </span>
        <span
          class="text-xl font-bold leading-none tabular-nums text-foreground"
        >
          {{ stats.deaths }}
        </span>
      </div>

      <div class="flex flex-col items-start">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("match.player_strip.assists") }}
        </span>
        <span
          class="text-xl font-bold leading-none tabular-nums text-foreground"
        >
          {{ stats.assists }}
        </span>
      </div>

      <div class="flex flex-col items-start">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          <StatLabel stat="adr">{{ $t("match.player_strip.adr") }}</StatLabel>
        </span>
        <span
          class="text-xl font-bold leading-none tabular-nums text-foreground"
        >
          <template v-if="stats.adr !== null">{{ stats.adr }}</template>
          <template v-else>—</template>
        </span>
      </div>

      <div class="flex flex-col items-start">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("match.player_strip.hs_pct") }}
        </span>
        <span
          class="text-xl font-bold leading-none tabular-nums text-foreground"
        >
          <template v-if="stats.hsPct !== null">{{ stats.hsPct }}%</template>
          <template v-else>—</template>
        </span>
      </div>

      <div class="flex flex-col items-start">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          <StatLabel stat="kd">{{ $t("match.player_strip.kd") }}</StatLabel>
        </span>
        <span
          class="text-xl font-bold leading-none tabular-nums text-[hsl(var(--tac-amber))]"
          :style="{ color: kdColor(Number(stats.kd)) }"
        >
          {{ stats.kd }}
        </span>
      </div>
    </div>
  </div>
</template>
