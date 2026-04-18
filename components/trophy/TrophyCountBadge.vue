<script setup lang="ts">
import { computed } from "vue";

interface TrophySummary {
  placement_tier?: string | null;
}

interface Props {
  trophies?: TrophySummary[] | null;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  trophies: null,
  compact: false,
});

const counts = computed(() => {
  const result = { mvp: 0, gold: 0, silver: 0, bronze: 0 };
  if (!props.trophies) return result;
  for (const t of props.trophies) {
    if (t.placement_tier === "mvp") result.mvp++;
    else if (t.placement_tier === "gold") result.gold++;
    else if (t.placement_tier === "silver") result.silver++;
    else if (t.placement_tier === "bronze") result.bronze++;
  }
  return result;
});

const visible = computed(() => {
  const tiers = [
    {
      tier: "mvp",
      color: "hsl(195 85% 60%)",
      count: counts.value.mvp,
      label: "MVP",
      full: "Most Valuable Player",
    },
    {
      tier: "gold",
      color: "hsl(45 95% 60%)",
      count: counts.value.gold,
      label: "1st",
      full: "1st Place",
    },
    {
      tier: "silver",
      color: "hsl(0 0% 78%)",
      count: counts.value.silver,
      label: "2nd",
      full: "2nd Place",
    },
    {
      tier: "bronze",
      color: "hsl(28 70% 52%)",
      count: counts.value.bronze,
      label: "3rd",
      full: "3rd Place",
    },
  ];
  return tiers.filter((t) => t.count > 0);
});

const hasAny = computed(() => visible.value.length > 0);
</script>

<template>
  <div
    v-if="hasAny"
    class="inline-flex items-stretch divide-x divide-border/60 overflow-hidden rounded-sm border border-border/70 bg-background/70"
    :class="compact ? 'text-[9px]' : 'text-[10px]'"
    role="group"
    aria-label="Trophy rack"
  >
    <div
      v-for="item in visible"
      :key="item.tier"
      class="flex items-center gap-1 px-1.5 py-[1px] font-mono font-bold leading-none tabular-nums"
      :style="{ color: item.color }"
      :title="`${item.count} × ${item.full}`"
    >
      <span
        class="inline-block rounded-full"
        :class="compact ? 'h-[4px] w-[4px]' : 'h-[5px] w-[5px]'"
        :style="{
          background: item.color,
          boxShadow: `0 0 3px ${item.color}`,
        }"
      ></span>
      <span class="tracking-[0.06em] text-muted-foreground">{{
        item.label
      }}</span>
      <span>{{ item.count }}</span>
    </div>
  </div>
</template>
