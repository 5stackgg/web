<script setup lang="ts">
import { AlertTriangle } from "lucide-vue-next";

// A nav row's count, or the warning that outranks it. The row's link reads
// them out, so this is for the eye only.
defineProps<{
  badge?: number;
  tone?: "amber" | "live";
  warning?: string | null;
}>();
</script>

<template>
  <AlertTriangle
    v-if="warning"
    aria-hidden="true"
    class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
  />
  <span
    v-else-if="badge"
    aria-hidden="true"
    class="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center gap-1 rounded-[3px] border px-[5px] text-[11px] font-bold leading-none tabular-nums"
    :class="
      tone === 'live'
        ? 'border-destructive/50 bg-destructive/15 text-destructive'
        : 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]'
    "
  >
    <span
      v-if="tone === 'live'"
      class="h-[5px] w-[5px] rounded-full bg-current"
    ></span>
    {{ badge }}
  </span>
</template>
