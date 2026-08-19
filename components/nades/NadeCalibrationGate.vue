<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import type { NadeCalibrationView } from "~/types/nade";

defineProps<{
  calibration: NadeCalibrationView | null;
  checking: boolean;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
}>();
</script>

<template>
  <div
    v-if="!calibration"
    class="flex items-center gap-3 rounded-md border border-border bg-foreground/5 p-4"
  >
    <Spinner class="shrink-0" />
    <span class="text-sm">{{ $t("pages.nades.solve.checking") }}</span>
  </div>

  <div
    v-else-if="!calibration.ready"
    class="space-y-2 rounded-md border p-4"
    :class="
      calibration.state === 'unsupported'
        ? 'border-destructive/40 bg-destructive/10'
        : 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)]'
    "
  >
    <div class="text-sm font-medium">
      {{ $t(`pages.nades.solve.state.${calibration.state}`) }}
    </div>
    <p class="text-xs leading-relaxed text-muted-foreground">
      {{ $t(`pages.nades.solve.state_note.${calibration.state}`) }}
    </p>
    <p
      v-if="calibration.detail"
      class="whitespace-pre-wrap break-words font-mono text-[0.62rem] text-muted-foreground"
    >
      {{ calibration.detail }}
    </p>
    <p
      v-else-if="calibration.state === 'unknown' && calibration.status"
      class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
    >
      {{ calibration.status }}
    </p>

    <div class="flex items-center gap-2 pt-1">
      <!-- NoSample clears itself on the next throw, so it waits rather than
           offering a button. Unsupported never clears, and a retry there is a
           promise the runtime cannot keep. -->
      <Spinner v-if="calibration.selfHealing" class="h-4 w-4 shrink-0" />
      <Button
        v-else-if="calibration.state !== 'unsupported'"
        size="sm"
        variant="outline"
        :loading="checking"
        @click="emit('refresh')"
      >
        <RefreshCw class="mr-1 h-4 w-4" />
        {{ $t("pages.nades.solve.check_again") }}
      </Button>
    </div>
  </div>
</template>
