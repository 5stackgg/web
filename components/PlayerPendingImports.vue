<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Spinner } from "~/components/ui/spinner";
import FiveStackToolTip from "./FiveStackToolTip.vue";

const { t } = useI18n();

function formatDate(date: string): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const props = defineProps<{
  imports: Array<{
    valve_match_id: string | number;
    status: string;
    error?: string | null;
    map_name?: string | null;
    match_start_time?: string | null;
  }>;
}>();

// Failed imports are dropped silently — we assume they can't be retrieved.
const visibleImports = computed(() =>
  props.imports.filter((entry) => entry.status !== "Failed"),
);

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
    v-if="visibleImports.length > 0"
    :as-child="true"
    side="bottom"
    align="end"
  >
    <template #trigger>
      <span :class="badgeClasses">{{ visibleImports.length }}</span>
    </template>
    <div class="text-xs space-y-1 max-w-[260px]">
      <div class="font-semibold uppercase tracking-[0.12em]">
        {{ t("player.pending_imports.title") }}
      </div>
      <ul class="space-y-0.5">
        <li
          v-for="entry in visibleImports"
          :key="entry.valve_match_id"
          class="flex items-center justify-between gap-3 font-mono"
        >
          <span v-if="entry.map_name" class="truncate">{{
            entry.map_name
          }}</span>
          <span
            v-if="entry.match_start_time"
            class="text-muted-foreground"
            :class="{ 'ml-auto': entry.map_name }"
          >
            {{ formatDate(entry.match_start_time) }}
          </span>
          <span
            v-else-if="!entry.map_name"
            class="flex items-center gap-1.5 text-muted-foreground"
          >
            <Spinner class="w-3 h-3" />
            {{ t("player.pending_imports.importing") }}
          </span>
        </li>
      </ul>
    </div>
  </FiveStackToolTip>
</template>
