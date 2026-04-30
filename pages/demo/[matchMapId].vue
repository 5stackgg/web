<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";
import DemoPlayer from "~/components/match/DemoPlayer.vue";
import { useDemoPlayback } from "~/composables/useDemoPlayback";
import { useAuthStore } from "~/stores/AuthStore";
import socket from "~/web-sockets/Socket";

// Dedicated popup window for demo playback. Owns the session
// lifecycle end-to-end:
//   - mount        → start the session
//   - watch event  → tell our WS "this client is watching map X"
//                    (re-fired every 10s as a backstop)
//   - close window → WS connection drops → server's close handler tears
//                    the session down within milliseconds (DB-driven
//                    reaper is the cross-process backstop with a 60s
//                    threshold for any close events the server misses).

definePageMeta({
  // Chrome-less — the popup is a focused tool, not part of the app shell.
  layout: false,
});

const route = useRoute();
const matchMapId = computed(() => String(route.params.matchMapId));
const authStore = useAuthStore();
const { store, start, stop } = useDemoPlayback();

// Re-fire the watch event periodically as a defense in depth: if the
// initial event landed before the session row existed (race), or if
// the api restarted and lost the in-memory clientId map, the next
// watch event re-registers AND bumps last_activity_at on the row so
// the reaper doesn't fire prematurely.
const WATCH_INTERVAL_MS = 10_000;
let watchHandle: ReturnType<typeof setInterval> | null = null;

function announceWatch() {
  socket.event("demo-session:watch", { match_map_id: matchMapId.value });
}

onMounted(async () => {
  if (!authStore.me) {
    window.location.href = `/login?next=${encodeURIComponent(route.fullPath)}`;
    return;
  }

  try {
    await start(matchMapId.value);
  } catch {
    // store.errorMessage is populated; UI renders the error state.
    return;
  }

  // First watch event right after the row exists, then every 10s. We
  // don't wait on the initial event — Socket queues offline events and
  // flushes on reconnect, so even if the WS is mid-connect this lands.
  announceWatch();
  watchHandle = setInterval(announceWatch, WATCH_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (watchHandle) clearInterval(watchHandle);
  // Polite "I'm leaving" — gives the server a head start on cleanup
  // before the WS itself drops a moment later. The close handler is
  // the source of truth either way.
  if (store.matchMapId) {
    socket.event("demo-session:unwatch", { match_map_id: store.matchMapId });
  }
  // SPA-internal navigation away from the popup (rare — the URL bar
  // case) still needs the explicit stop. The WS close handler covers
  // window-close.
  void stop();
});

// `is_organizer` from the parent route isn't available here. The
// action's auth check is the final word (organizer OR streamer+).
const isOrganizer = false;
</script>

<template>
  <div class="h-screen w-screen bg-black flex flex-col">
    <DemoPlayer
      :match-map-id="matchMapId"
      :is-organizer="isOrganizer"
      class="flex-1"
    />
  </div>
</template>
