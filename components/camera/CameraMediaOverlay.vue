<script setup lang="ts">
import {
  LucideLoader2,
  LucideRefreshCw,
  LucideTriangleAlert,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import type { CameraErrorKind } from "~/composables/useCameraPipeline";

defineProps<{
  pending: boolean;
  errorKind: CameraErrorKind | null;
}>();

defineEmits<{ (e: "retry"): void }>();
</script>

<template>
  <div
    v-if="pending"
    class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center"
  >
    <LucideLoader2 class="h-5 w-5 animate-spin text-[hsl(var(--tac-amber))]" />
    <p class="max-w-xs text-[11px] leading-snug text-muted-foreground">
      {{ $t("camera.media_pending") }}
    </p>
  </div>

  <div
    v-else-if="errorKind"
    class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center"
  >
    <LucideTriangleAlert class="h-6 w-6 text-destructive" />
    <p
      class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-destructive"
    >
      {{ $t("camera.error") }}
    </p>
    <p class="max-w-xs text-[11px] leading-snug text-muted-foreground">
      {{ $t(`camera.media_error.${errorKind}`) }}
    </p>
    <Button variant="secondary" size="sm" @click="$emit('retry')">
      <LucideRefreshCw class="h-3.5 w-3.5" />
      {{ $t("camera.retry") }}
    </Button>
  </div>
</template>
