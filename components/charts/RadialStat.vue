<script setup lang="ts">
defineProps<{
  value: string | number;
  label: string;
  percentage: number; // 0–100
  strokeColor?: string;
}>();

const radius = 54;
const circumference = 2 * Math.PI * radius;
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div class="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32">
      <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <!-- background ring -->
        <circle
          cx="60"
          cy="60"
          :r="radius"
          stroke="hsl(var(--border))"
          stroke-width="10"
          fill="none"
        />

        <!-- progress ring -->
        <circle
          cx="60"
          cy="60"
          :r="radius"
          :stroke="strokeColor || 'hsl(var(--primary))'"
          stroke-width="10"
          fill="none"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="
            circumference -
            (Math.min(Math.max(percentage, 0), 100) / 100) * circumference
          "
          class="transition-all duration-500"
        />
      </svg>

      <!-- center content -->
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-lg sm:text-xl font-bold leading-none">
          {{ value }}
        </span>
        <span
          class="text-[8px] sm:text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {{ label }}
        </span>
      </div>
    </div>
  </div>
</template>
