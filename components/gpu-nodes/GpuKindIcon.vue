<script setup lang="ts">
import { Film, Flame, PlayCircle, Radio } from "lucide-vue-next";
import type { GpuSessionKind } from "~/components/gpu-nodes/gpuSessions";

defineProps<{ kind: GpuSessionKind }>();
</script>

<template>
  <span
    class="inline-grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md"
    :class="{
      'bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]':
        kind === 'live',
      'bg-[hsl(var(--tac-blue)/0.12)] text-[hsl(var(--tac-blue))]':
        kind === 'demo',
      'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]':
        kind === 'highlights',
      'bg-muted text-foreground': kind === 'bake',
    }"
    aria-hidden="true"
  >
    <Radio v-if="kind === 'live'" class="h-3.5 w-3.5" />
    <PlayCircle v-else-if="kind === 'demo'" class="h-3.5 w-3.5" />
    <Film v-else-if="kind === 'highlights'" class="h-3.5 w-3.5" />
    <Flame v-else class="h-3.5 w-3.5" />
  </span>
</template>
