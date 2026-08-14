<script setup lang="ts">
import { watch } from "vue";
import CameraSetup from "~/components/match/CameraSetup.vue";
import { useCameraSetup } from "~/composables/useCameraSetup";

const props = defineProps<{
  matchId: string;
}>();

// The match page unmounts this component in response, which is what actually
// makes the overlay go away.
const emit = defineEmits<{ (e: "ready"): void }>();

const { token, qrDataUrl, ready, checked, openOnThisComputer } = useCameraSetup(
  () => props.matchId,
);

watch(ready, (isReady) => {
  if (isReady) {
    emit("ready");
  }
});
</script>

<template>
  <!-- Held back until the first status check lands, so someone who connected
       earlier and reloaded never sees a flash of the blocking overlay. -->
  <div
    v-if="checked && !ready"
    class="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
  >
    <div
      class="relative w-full max-w-md overflow-hidden rounded-xl border bg-card p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
    >
      <span
        class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--tac-amber)/0.7)] to-transparent"
      ></span>

      <div class="flex items-center gap-[0.6rem]">
        <span
          class="h-[2px] w-[10px] shrink-0 bg-[hsl(var(--tac-amber))]"
        ></span>
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
        >
          {{ $t("camera.gate_label") }}
        </span>
      </div>

      <h2 class="mt-3 text-lg font-semibold tracking-tight">
        {{ $t("camera.title") }}
      </h2>
      <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
        {{ $t("camera.subtitle") }}
      </p>
      <p class="mt-2 text-xs leading-relaxed text-muted-foreground/80">
        {{ $t("camera.reason") }}
      </p>

      <div class="mt-5">
        <CameraSetup
          :token="token"
          :qr-data-url="qrDataUrl"
          :ready="ready"
          @open-on-this-computer="openOnThisComputer"
        />
      </div>
    </div>
  </div>
</template>
