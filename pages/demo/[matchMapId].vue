<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import DemoPlayer from "~/components/match/DemoPlayer.vue";
import ShortcutOverlay from "~/components/match/ShortcutOverlay.vue";
import { Kbd } from "~/components/ui/kbd";
import { specSlotsForMatchType } from "~/utilities/streamerSpecSlots";
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
const {
  store,
  start,
  stop,
  togglePause,
  skip,
  jumpToNextKill,
  jumpToPrevKill,
  jumpToNextRound,
  jumpToPrevRound,
  reloadDemo,
  toggleXray,
  toggleHud,
  switchToSlot,
} = useDemoPlayback();

const shortcutsOpen = ref(false);
const slotKeys = computed(() => specSlotsForMatchType(store.matchType));

const SHORTCUT_GROUPS = computed(() => [
  {
    title: "Playback",
    items: [
      { keys: ["Space"], label: "Play / pause" },
      { keys: ["←"], label: "Skip back 15s" },
      { keys: ["→"], label: "Skip forward 15s" },
      { keys: ["["], label: "Previous round" },
      { keys: ["]"], label: "Next round" },
    ],
  },
  {
    title: "Kills",
    items: [
      { keys: ["P"], label: "Previous kill" },
      { keys: ["N"], label: "Next kill" },
    ],
  },
  {
    title: "Spectate",
    items: [
      {
        keys: ["1", "—", "0"],
        label: `Switch player (slot 1–${slotKeys.value.length})`,
      },
    ],
  },
  {
    title: "Quick actions",
    items: [
      { keys: ["X"], label: "Toggle x-ray" },
      { keys: ["H"], label: "Hide / show OpenHud" },
      { keys: ["R"], label: "Reload demo" },
      { keys: ["?"], label: "Show this help" },
    ],
  },
]);

function isTypingInForm(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  return target.isContentEditable === true;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTypingInForm(e.target)) return;

  // ? + Esc handle the overlay regardless of session state.
  if (e.key === "?" || (e.shiftKey && e.key === "/")) {
    e.preventDefault();
    shortcutsOpen.value = !shortcutsOpen.value;
    return;
  }
  if (e.key === "Escape" && shortcutsOpen.value) {
    e.preventDefault();
    shortcutsOpen.value = false;
    return;
  }

  // Everything else only fires while a session is live.
  if (!store.isLive) return;
  if (e.repeat) return;

  // Slot digits 1..9 / 0 → spec slot.
  const slot = slotKeys.value.find((s) => s.key === e.key);
  if (slot) {
    e.preventDefault();
    switchToSlot(slot.slot);
    return;
  }

  switch (e.key) {
    case " ":
      e.preventDefault();
      togglePause();
      break;
    case "ArrowLeft":
      e.preventDefault();
      void skip(-15);
      break;
    case "ArrowRight":
      e.preventDefault();
      void skip(15);
      break;
    case "[":
      e.preventDefault();
      jumpToPrevRound();
      break;
    case "]":
      e.preventDefault();
      jumpToNextRound();
      break;
    case "n":
    case "N":
      e.preventDefault();
      jumpToNextKill();
      break;
    case "p":
    case "P":
      e.preventDefault();
      jumpToPrevKill();
      break;
    case "x":
    case "X":
      e.preventDefault();
      toggleXray();
      break;
    case "h":
    case "H":
      e.preventDefault();
      toggleHud();
      break;
    case "r":
    case "R":
      e.preventDefault();
      reloadDemo();
      break;
  }
}

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
  window.addEventListener("keydown", onKeyDown);
});

onBeforeUnmount(() => {
  if (watchHandle) clearInterval(watchHandle);
  window.removeEventListener("keydown", onKeyDown);
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
  <div class="relative h-screen w-screen bg-black flex flex-col">
    <DemoPlayer
      :match-map-id="matchMapId"
      :is-organizer="isOrganizer"
      class="flex-1"
    />
    <!-- Floating "?" hint — sits above the controls strip in the
         lower-right corner. Discoverability anchor for the keyboard
         shortcut overlay; if the operator doesn't know to press ?,
         this surfaces it. -->
    <button
      type="button"
      class="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground/80 backdrop-blur-md cursor-pointer transition-all duration-150 hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground hover:scale-105 active:scale-95"
      title="Show keyboard shortcuts"
      @click="shortcutsOpen = true"
    >
      Shortcuts
      <Kbd>?</Kbd>
    </button>
    <ShortcutOverlay
      :open="shortcutsOpen"
      :groups="SHORTCUT_GROUPS"
      @close="shortcutsOpen = false"
    />
  </div>
</template>
