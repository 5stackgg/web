<script setup lang="ts">
import { watch } from "vue";
import { X } from "lucide-vue-next";
import CameraSetup from "~/components/match/CameraSetup.vue";
import { useCameraSetup } from "~/composables/useCameraSetup";

const props = withDefaults(
  defineProps<{
    matchId: string;
    // Visibility only. This component stays mounted while dismissed so its
    // status poll keeps running: unmounting would reset `checked` (re-opening
    // would then sit blank for a poll) and would stop noticing the camera going
    // live, leaving the page's banner up forever.
    open?: boolean;
    // Changes who is being told they can watch. Nobody should point a camera at
    // themselves on the strength of a sentence that names the wrong audience.
    allowTeammates?: boolean;
  }>(),
  { open: true, allowTeammates: false },
);

const emit = defineEmits<{
  (e: "update:ready", value: boolean): void;
  (e: "dismiss"): void;
}>();

const { qrDataUrl, ready, checked, openOnThisComputer } = useCameraSetup(
  () => props.matchId,
);

// Reported both ways. It used to fire only on going live, which made the
// parent's flag a one-way latch: a player who closed their camera mid match
// kept a page that believed they still had one.
watch(ready, (isReady) => {
  emit("update:ready", isReady);
});
</script>

<template>
  <!-- Held back until the first status check lands, so someone who connected
       earlier and reloaded never sees a flash of the blocking overlay. -->
  <div
    v-if="open && checked && !ready"
    class="gate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
  >
    <div
      class="gate-panel relative w-full max-w-md overflow-hidden rounded-xl border bg-card p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
    >
      <!-- Dismissable so a player can still reach the rest of the match page.
           The banner the match page raises in its place is what keeps this
           findable -- nothing here is remembered across a reload. -->
      <button
        type="button"
        class="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-label="$t('camera.dismiss')"
        :title="$t('camera.dismiss')"
        @click="emit('dismiss')"
      >
        <X class="size-4" />
      </button>

      <h2 class="text-center text-lg font-semibold">
        {{ $t("camera.title") }}
      </h2>

      <div class="mt-6">
        <CameraSetup
          :qr-data-url="qrDataUrl"
          :ready="ready"
          @open-on-this-computer="openOnThisComputer"
        />
      </div>

      <p
        class="mt-5 border-t pt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70"
      >
        {{
          allowTeammates ? $t("camera.reason_teammates") : $t("camera.reason")
        }}
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
