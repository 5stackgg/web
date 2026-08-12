<script setup lang="ts">
defineProps<{
  active: boolean;
  label: string;
}>();

defineEmits<{
  (e: "toggle"): void;
}>();
</script>

<template>
  <button
    type="button"
    :aria-pressed="active"
    class="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border px-2 font-mono text-[0.6rem] font-bold uppercase leading-none tracking-[0.14em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
    :class="
      active
        ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
        : 'border-border/70 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
    "
    @click="$emit('toggle')"
  >
    <!-- Same tick as the section labels below the rail, so an active filter
         reads as belonging to the list it is filtering. -->
    <span
      class="h-[2px] w-2 shrink-0 transition-colors duration-150"
      :class="active ? 'bg-[hsl(var(--tac-amber))]' : 'bg-border'"
    />
    {{ label }}
  </button>
</template>
