<script setup lang="ts">
import { LucideEye, LucideEyeOff } from "lucide-vue-next";
import type { CameraPublishPhase } from "~/composables/useCameraPublisher";

defineProps<{
  phase: CameraPublishPhase;
  previewVisible: boolean;
}>();

defineEmits<{ (e: "toggle-preview"): void }>();
</script>

<template>
  <div
    class="flex min-h-[3.5rem] items-center gap-3 rounded-xl border px-3 py-2 transition-colors"
    :class="
      phase === 'connected'
        ? 'border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.06)]'
        : 'border-border bg-card/40'
    "
  >
    <span
      class="inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.22em]"
      :class="
        phase === 'connected'
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
          : phase === 'error'
            ? 'border-destructive/50 bg-destructive/10 text-destructive'
            : 'border-border bg-background/40 text-muted-foreground'
      "
    >
      <span class="relative flex h-1.5 w-1.5">
        <span
          v-if="phase === 'connected'"
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
        ></span>
        <span
          class="relative inline-flex h-1.5 w-1.5 rounded-full"
          :class="
            phase === 'connected'
              ? 'bg-emerald-400'
              : phase === 'error'
                ? 'bg-destructive'
                : 'bg-muted-foreground/60'
          "
        ></span>
      </span>
      {{ $t(`camera.phase.${phase}`) }}
    </span>

    <p class="min-w-0 flex-1 text-xs font-semibold leading-snug sm:text-sm">
      <template v-if="phase === 'connected'">
        {{ $t("camera.keep_open") }}
      </template>
      <template v-else-if="phase === 'connecting'">
        {{ $t("camera.connecting") }}
      </template>
      <template v-else-if="phase === 'error'">
        {{ $t("camera.error") }}
      </template>
      <template v-else>
        {{ $t("camera.headline_preview") }}
      </template>
    </p>

    <button
      v-if="phase === 'connected'"
      type="button"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] transition-colors"
      :class="
        previewVisible
          ? 'border-border bg-background/40 text-muted-foreground hover:text-foreground'
          : 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
      "
      :aria-label="
        previewVisible ? $t('camera.hide_preview') : $t('camera.show_preview')
      "
      :title="
        previewVisible ? $t('camera.hide_preview') : $t('camera.show_preview')
      "
      @click="$emit('toggle-preview')"
    >
      <component
        :is="previewVisible ? LucideEye : LucideEyeOff"
        class="h-2.5 w-2.5"
      />
      {{ $t("camera.preview") }}
    </button>
  </div>
</template>
