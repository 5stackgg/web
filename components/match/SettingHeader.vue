<script lang="ts" setup></script>

<!-- Tactical section header: amber dash + mono uppercase label (site style). -->
<template>
  <div class="flex items-center gap-[0.6rem] min-w-0">
    <span class="w-[10px] h-[2px] shrink-0 bg-[hsl(var(--tac-amber))]"></span>
    <span
      class="font-mono text-[0.7rem] tracking-[0.22em] uppercase text-muted-foreground leading-tight"
    >
      <slot />
    </span>
  </div>
</template>
