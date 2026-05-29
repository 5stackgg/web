<script lang="ts" setup>
import { ArrowUpToLine, ArrowDownToLine } from "lucide-vue-next";

defineProps<{
  tournamentName: string;
  stageNumber: number;
  stageType?: string | null;
  groupLabel?: string | null;
  bracketScope?: "upper" | "lower" | null;
}>();
</script>

<template>
  <div
    class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-6 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-md"
  >
    <div class="flex min-w-0 items-center gap-2">
      <span class="text-[hsl(var(--tac-amber))]">◢</span>
      <span class="truncate font-bold text-foreground">{{
        tournamentName
      }}</span>
      <span class="opacity-50">·</span>
      <span class="shrink-0 text-foreground">
        {{ $t("tournament.stage.stage_tab", { stage: stageNumber }) }}
      </span>
      <template v-if="stageType">
        <span class="opacity-50">·</span>
        <span class="truncate">{{ stageType }}</span>
      </template>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <span
        v-if="groupLabel"
        class="rounded border border-border bg-muted/40 px-2 py-0.5"
      >
        {{ $t("tournament.stage.group", { group: groupLabel }) }}
      </span>
      <span
        v-if="bracketScope === 'upper'"
        class="inline-flex items-center gap-1.5 rounded border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-0.5 text-[hsl(var(--tac-amber))]"
      >
        <ArrowUpToLine class="h-3 w-3" />
        {{ $t("tournament.match.upper_bracket") }}
      </span>
      <span
        v-else-if="bracketScope === 'lower'"
        class="inline-flex items-center gap-1.5 rounded border border-destructive/55 bg-destructive/15 px-2 py-0.5 text-destructive"
      >
        <ArrowDownToLine class="h-3 w-3" />
        {{ $t("tournament.match.lower_bracket") }}
      </span>
    </div>
  </div>
</template>
