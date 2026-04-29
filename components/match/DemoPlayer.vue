<script setup lang="ts">
import { computed } from "vue";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import DemoPlaybackControls from "~/components/match/DemoPlaybackControls.vue";
import StreamSessionProgress from "~/components/match/StreamSessionProgress.vue";
import { Button } from "~/components/ui/button";
import { useDemoPlayback } from "~/composables/useDemoPlayback";

const DEMO_STAGES = [
  { key: "booting", label: "Allocating GPU" },
  { key: "downloading_cs2", label: "Downloading CS2" },
  { key: "launching_steam", label: "Launching Steam" },
  { key: "logging_in", label: "Logging in" },
  { key: "downloading_demo", label: "Downloading demo" },
  // Only fires for workshop-map demos; stock-map demos skip past this
  // stage and it stays "pending" in the UI.
  { key: "downloading_workshop_map", label: "Downloading workshop map" },
  { key: "launching_cs2", label: "Launching CS2" },
  { key: "connecting_to_game", label: "Loading demo into CS2" },
  { key: "live", label: "Capturing video" },
];

// Pure presentation: the parent page (pages/demo/[matchMapId].vue)
// owns the lifecycle — calls `start()` on mount, holds the WS heartbeat,
// and lets the WS-close-on-window-close handler stop the session
// server-side. This component just reacts to store state.
//
// "Cancel" closes the popup window. The api's WS close handler picks
// up the dropped connection and stops the session.

defineProps<{
  matchMapId: string;
  isOrganizer: boolean;
}>();

const { store } = useDemoPlayback();

const whepUrl = computed(() => {
  if (!store.streamUrl) return null;
  // The api stores the HLS base on the row at insert; translate to the
  // WHEP egress on the same mediamtx host. Same convention as
  // stream-deck pages.
  return store.streamUrl.replace(/\/?$/, "/whep");
});

function closeWindow() {
  // window.close only succeeds for windows opened via window.open
  // (which is exactly how the parent app launches us). If somehow we
  // were navigated to directly, fall back to navigating home.
  window.close();
  // If the close was rejected (still here after the call returned),
  // we'll know within a tick — bounce to home.
  setTimeout(() => {
    if (!window.closed) {
      window.location.href = "/";
    }
  }, 50);
}
</script>

<template>
  <div
    class="flex flex-col rounded-lg overflow-hidden border border-border/70 bg-black"
  >
    <div class="relative aspect-video w-full">
      <WhepPlayer v-if="store.isLive && whepUrl" :whep-url="whepUrl" />

      <div
        v-else
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6"
      >
        <!-- Active session, not yet live: full step-by-step progress
             with the current stage highlighted + an elapsed timer so
             stalls are visible. -->
        <template v-if="store.sessionRow && !store.isErrored">
          <StreamSessionProgress
            :status="store.status"
            :error-message="store.sessionRow?.error_message"
            :last-status-at="store.sessionRow?.last_status_at"
            :status-history="store.sessionRow?.status_history || []"
            :stages="DEMO_STAGES"
            header-label="Demo session boot"
          />
          <Button size="sm" variant="ghost" @click="closeWindow">
            Cancel
          </Button>
        </template>

        <!-- Optimistic local-only states (between mount and first
             subscription event). -->
        <template v-else-if="store.localStatus === 'starting'">
          <StreamSessionProgress
            status="booting"
            :stages="DEMO_STAGES"
            header-label="Demo session boot"
          />
        </template>

        <template v-else-if="store.isErrored || store.localStatus === 'error'">
          <StreamSessionProgress
            status="errored"
            :error-message="
              store.sessionRow?.error_message ?? store.errorMessage
            "
            :last-status-at="store.sessionRow?.last_status_at"
            :status-history="store.sessionRow?.status_history || []"
            :stages="DEMO_STAGES"
            header-label="Demo session boot"
          />
          <Button size="sm" variant="outline" @click="closeWindow">
            Close
          </Button>
        </template>
      </div>
    </div>

    <DemoPlaybackControls v-if="store.isLive" />
  </div>
</template>
