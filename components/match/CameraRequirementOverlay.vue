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
    <div class="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
      <h2 class="text-center text-lg font-semibold">{{ $t("camera.title") }}</h2>
      <p class="mt-1 text-center text-sm text-muted-foreground">
        {{ $t("camera.subtitle") }}
      </p>

      <div class="mt-6">
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
