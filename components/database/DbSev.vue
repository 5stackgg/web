<script setup lang="ts">
import { CircleAlert, TriangleAlert } from "lucide-vue-next";
import type { Sev } from "./dbHealth";

// A value that crossed a line: colour plus an icon, never colour alone.
defineProps<{ sev?: Sev }>();
</script>

<template>
  <span
    v-if="sev"
    class="inline-flex items-center gap-1 font-semibold"
    :class="sev === 'bad' ? 'text-destructive' : 'text-amber-400'"
  >
    <CircleAlert v-if="sev === 'bad'" class="h-3 w-3 shrink-0" />
    <TriangleAlert v-else class="h-3 w-3 shrink-0" />
    <slot />
  </span>
  <span v-else><slot /></span>
</template>
