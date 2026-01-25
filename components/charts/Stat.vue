<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <span class="text-xs text-muted-foreground uppercase tracking-wide">
      {{ label }}
    </span>
    <span class="text-lg font-semibold">
      {{ value }}
    </span>
  </div>
</template>
