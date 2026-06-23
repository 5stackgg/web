<script setup lang="ts">
import { Film } from "lucide-vue-next";
</script>

<template>
  <div
    class="relative aspect-video w-full animate-pulse overflow-hidden rounded-lg border border-border/40 bg-card/40"
  >
    <div
      class="absolute inset-0 [background:radial-gradient(120%_120%_at_50%_0%,hsl(var(--muted)/0.35),transparent_60%)]"
    />
    <div class="absolute inset-0 flex items-center justify-center">
      <Film class="h-6 w-6 text-muted-foreground/25" />
    </div>
    <div class="absolute inset-x-3 bottom-3 space-y-1.5">
      <div class="h-2.5 w-2/3 rounded bg-muted/50" />
      <div class="h-2 w-1/3 rounded bg-muted/40" />
    </div>
  </div>
</template>
