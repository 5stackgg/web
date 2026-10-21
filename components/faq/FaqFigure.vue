<script setup lang="ts">
defineProps<{ where: string; caption?: string }>();
</script>

<template>
  <figure class="flex min-w-0 flex-col gap-2">
    <div
      class="overflow-hidden rounded-lg border border-border/70 bg-background/70 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.9)]"
    >
      <div
        class="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        <span class="size-1.5 rounded-full bg-[hsl(var(--tac-amber)/0.8)]" />
        {{ where }}
      </div>
      <div class="pointer-events-none select-none overflow-x-auto p-3" inert>
        <slot />
      </div>
    </div>
    <figcaption
      v-if="caption"
      class="text-xs leading-snug text-muted-foreground"
    >
      {{ caption }}
    </figcaption>
  </figure>
</template>
