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
  <div class="flex flex-col bg-black h-full min-h-0">
    <!-- Video area fills the remaining height; aspect ratio is preserved
         by `object-contain` on the inner <video>, with letterboxing on
         either axis. The previous `aspect-video w-full` forced a 16:9
         box that pushed the controls strip off-screen on wide popups. -->
    <div class="relative flex-1 min-h-0 w-full">
      <!-- Boot panel ↔ live video swap is a high-impact transition —
           crossfade so the moment cs2 starts publishing doesn't feel
           like a hard cut. mode="out-in" so the boot panel finishes
           fading before the WHEP player mounts (avoids two stacked
           absolute layers fighting over the same space). -->
      <Transition name="boot-live" mode="out-in">
        <WhepPlayer
          v-if="store.isLive && whepUrl"
          key="live"
          :whep-url="whepUrl"
          class="absolute inset-0"
        />

        <div
          v-else
          key="boot"
          class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6 py-8"
        >
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

          <template v-else-if="store.localStatus === 'starting'">
            <StreamSessionProgress
              status="booting"
              :stages="DEMO_STAGES"
              header-label="Demo session boot"
            />
          </template>

          <template
            v-else-if="store.isErrored || store.localStatus === 'error'"
          >
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
      </Transition>
    </div>

    <Transition name="controls-slide">
      <DemoPlaybackControls v-if="store.isLive" class="shrink-0" />
    </Transition>
  </div>
</template>

<style scoped>
.boot-live-enter-active,
.boot-live-leave-active {
  transition:
    opacity 350ms ease,
    transform 350ms ease;
}
.boot-live-enter-from {
  opacity: 0;
  transform: scale(1.02);
}
.boot-live-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* Controls strip slides up from below when the session goes live. */
.controls-slide-enter-active {
  transition:
    opacity 300ms ease,
    transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.controls-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
</style>
