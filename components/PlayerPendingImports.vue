<script lang="ts" setup>
import FiveStackToolTip from "./FiveStackToolTip.vue";

defineProps<{
  imports: Array<{
    valve_match_id: string | number;
    status: string;
    error?: string | null;
  }>;
}>();

const badgeClasses = [
  "inline-flex items-center justify-center min-w-[1.25rem] h-[1.25rem] px-[0.35rem] rounded-full",
  "font-mono text-[0.65rem] font-bold tabular-nums leading-none",
  "border border-[hsl(45_95%_55%/0.55)] bg-[hsl(45_95%_55%/0.18)] text-[hsl(45_95%_70%)]",
  "[text-shadow:0_0_8px_hsl(45_95%_55%/0.4)]",
  "cursor-help select-none",
].join(" ");
</script>

<template>
  <FiveStackToolTip
    v-if="imports.length > 0"
    :as-child="true"
    :delay-duration="100"
    side="bottom"
    align="end"
  >
    <template #trigger>
      <span :class="badgeClasses">{{ imports.length }}</span>
    </template>
    <div class="text-xs space-y-1 max-w-[260px]">
      <div class="font-semibold uppercase tracking-[0.12em]">
        Pending CS2 imports
      </div>
      <ul class="space-y-0.5">
        <li
          v-for="entry in imports"
          :key="entry.valve_match_id"
          class="flex items-center justify-between gap-3 font-mono"
        >
          <span class="truncate text-muted-foreground">
            {{ entry.valve_match_id }}
          </span>
          <span
            :class="{
              'text-muted-foreground': entry.status === 'Queued',
              'text-[hsl(45_95%_60%)]': entry.status === 'Parsing',
              'text-destructive': entry.status === 'Failed',
            }"
          >
            {{ entry.status }}
          </span>
        </li>
      </ul>
    </div>
  </FiveStackToolTip>
</template>
