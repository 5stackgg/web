<script setup lang="ts">
import type { PingTier } from "~/utilities/publicServers";

// The tier is a small dot rather than a coloured pill: on a page of servers
// the number matters, and a column of green and amber pills drowns it.
// The colour still comes from the matchmaking readout's --latency-tier.
defineProps<{
  ping?: number;
  tier: PingTier;
}>();
</script>

<template>
  <span
    class="inline-flex items-center justify-end gap-1.5 font-mono text-[0.8rem] tabular-nums text-foreground/85"
  >
    <span
      :class="[
        `latency-tier-${tier}`,
        'h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--latency-tier)/0.8)]',
      ]"
      aria-hidden="true"
    />
    <template v-if="ping !== undefined">{{ ping }}ms</template>
    <span v-else class="text-muted-foreground">—</span>
  </span>
</template>
