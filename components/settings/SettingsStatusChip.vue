<script setup lang="ts">
import { Loader2, TriangleAlert } from "lucide-vue-next";
import type { SettingsStatusChip } from "~/composables/useSettingsStatus";

defineProps<{ chip: SettingsStatusChip }>();
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-medium tabular-nums"
    :class="{
      'text-[hsl(var(--tac-amber))]': chip.tone === 'job',
      'text-yellow-500': chip.tone === 'attention',
    }"
  >
    <template v-if="chip.tone === 'job'">
      <Loader2 class="!h-3 !w-3 animate-spin motion-reduce:animate-none" />
      {{
        $t(`layouts.application_settings.status.job_${chip.job}`, {
          pct: chip.pct,
        })
      }}
    </template>
    <template v-else>
      <TriangleAlert class="!h-3 !w-3" />
      {{ $t("layouts.application_settings.status.not_set_up") }}
    </template>
  </span>
</template>
