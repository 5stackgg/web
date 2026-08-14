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
    class="gate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
  >
    <div
      class="gate-panel relative w-full max-w-md overflow-hidden rounded-xl border bg-card p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
    >
      <h2 class="text-center text-lg font-semibold">
        {{ $t("camera.title") }}
      </h2>

      <div class="mt-6">
        <CameraSetup
          :token="token"
          :qr-data-url="qrDataUrl"
          :ready="ready"
          @open-on-this-computer="openOnThisComputer"
        />
      </div>

      <p
        class="mt-5 border-t pt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70"
      >
        {{ $t("camera.reason") }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Opacity and transform only: the panel reserves its footprint and must never
   be animated through a resize. */
.gate-backdrop {
  animation: gate-backdrop-in 180ms ease-out both;
}

.gate-panel {
  animation: gate-panel-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes gate-backdrop-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes gate-panel-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gate-panel {
    animation: gate-backdrop-in 140ms ease-out both;
  }
}
</style>
