<script setup lang="ts">
interface StatItem {
  key: string;
  value: string | number;
  label: string;
  colorClass?: string;
}

interface Props {
  stats: StatItem[];
  cols?: 2 | 3 | 4;
}

const props = withDefaults(defineProps<Props>(), { cols: 4 });
</script>

<template>
  <div class="grid gap-3 w-full" :class="`grid-cols-${cols}`">
    <div
      v-for="(stat, index) in stats"
      :key="stat.key"
      :style="{ animationDelay: `${index * 50}ms` }"
      class="flex flex-col items-center p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:shadow-lg hover:scale-105 transition-all duration-300 group/card animate-in fade-in slide-in-from-bottom-2"
    >
      <span
        class="text-xl font-bold group-hover/card:text-primary transition-colors"
        :class="stat.colorClass"
      >
        {{ stat.value }}
      </span>
      <span class="text-[10px] text-muted-foreground uppercase tracking-wide">
        {{ stat.label }}
      </span>
    </div>
  </div>
</template>
