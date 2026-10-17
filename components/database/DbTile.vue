<script setup lang="ts">
import type { Sev } from "./dbHealth";

defineProps<{ label?: string; sev?: Sev }>();
</script>

<template>
  <div
    class="grid min-w-0 content-start gap-1 rounded-[10px] border bg-[hsl(240_6%_6%/0.7)] px-3.5 py-3"
    :class="
      sev === 'bad'
        ? 'border-destructive/40'
        : sev === 'warn'
          ? 'border-amber-500/35'
          : 'border-border'
    "
  >
    <span class="text-xs text-muted-foreground">
      <slot name="label">{{ label }}</slot>
    </span>
    <span class="text-[21px] font-bold leading-tight tabular-nums">
      <slot />
    </span>
    <span v-if="$slots.sub" class="text-[11.5px] text-muted-foreground/70">
      <slot name="sub" />
    </span>
  </div>
</template>
