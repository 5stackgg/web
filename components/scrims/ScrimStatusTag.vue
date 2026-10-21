<script setup lang="ts">
import type { ScrimTone } from "~/utilities/scrimPosting";

defineProps<{ tone: ScrimTone }>();
</script>

<template>
  <span
    class="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded border px-1.5 text-[0.7rem] font-semibold"
    :class="{
      'border-green-500/35 bg-green-500/10 text-green-400': tone === 'ok',
      'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]':
        tone === 'amber',
      'border-red-500/40 bg-red-500/10 text-red-400': tone === 'bad',
      'border-border text-muted-foreground': tone === 'muted',
    }"
  >
    <slot />
  </span>
</template>
