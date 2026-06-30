import { reactive, computed } from "vue";

// Module-level singleton: shared across every component that imports
// the composable so the inline match player knows when the same stream
// is already playing in a popped-out window — avoids running two WebRTC
// players against the same WHEP path simultaneously (doubles upstream
// bandwidth for no UX gain). Kept separate from useStreamerPopout: that
// tracker is keyed to stream-deck windows on its own channel, and
// sharing the matchId Set would cross-talk (opening a stream-deck would
// falsely suppress the inline match player).

type State = {
  // Window handles we own (this tab opened them). Cleared when the
  // window is closed locally — required to call `.focus()` later.
  windows: Record<string, Window>;
  // Source of truth for "is some popout window broadcasting it owns
  // matchId X". Driven by both window.closed polling AND by
  // BroadcastChannel heartbeats so we also detect popouts opened from a
  // previous page session (orphans after a reload).
  open: Set<string>;
};

const state = reactive<State>({ windows: {}, open: new Set<string>() });

const CHANNEL_NAME = "match-popout-window";
let channel: BroadcastChannel | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let visibilityListenerInstalled = false;

function ensureChannel() {
  if (
    channel ||
    typeof window === "undefined" ||
    !("BroadcastChannel" in window)
  ) {
    return;
  }
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (e: MessageEvent) => {
    const data = e.data ?? {};
    if (data.type === "alive" && typeof data.matchId === "string") {
      state.open.add(data.matchId);
    } else if (data.type === "closed" && typeof data.matchId === "string") {
      state.open.delete(data.matchId);
      delete state.windows[data.matchId];
      syncPollTimer();
    }
    // "ping" messages are intended for popout windows to respond to —
    // we ignore them on the opener side.
  };
  // Probe for orphans on first mount: any popout page already open will
  // reply with an "alive" message.
  channel.postMessage({ type: "ping" });
}

// Only spin the 1Hz `window.closed` poll while we actually own a popout
// AND the opener tab is foregrounded.
function syncPollTimer() {
  if (typeof window === "undefined") return;
  const wantsPoll =
    Object.keys(state.windows).length > 0 &&
    (typeof document === "undefined" || !document.hidden);
  if (wantsPoll && !pollTimer) {
    pollTimer = setInterval(() => {
      let changed = false;
      for (const [id, w] of Object.entries(state.windows)) {
        if (w.closed) {
          state.open.delete(id);
          delete state.windows[id];
          changed = true;
        }
      }
      if (changed) syncPollTimer();
    }, 1000);
  } else if (!wantsPoll && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function installVisibilityListener() {
  if (visibilityListenerInstalled || typeof document === "undefined") return;
  visibilityListenerInstalled = true;
  document.addEventListener("visibilitychange", () => syncPollTimer());
}

export function useMatchPopout() {
  ensureChannel();
  installVisibilityListener();
  syncPollTimer();

  function isOpen(matchId: string) {
    return state.open.has(matchId);
  }

  function openPopout(matchId: string) {
    if (typeof window === "undefined") return;
    const existing = state.windows[matchId];
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }
    const win = window.open(
      `/match-popout/${matchId}`,
      `match-popout-${matchId}`,
      "popup=yes,width=960,height=640,resizable=yes,scrollbars=no",
    );
    if (win) {
      state.windows[matchId] = win;
      state.open.add(matchId);
      syncPollTimer();
      win.focus();
    }
  }

  function focusPopout(matchId: string) {
    const w = state.windows[matchId];
    if (w && !w.closed) {
      w.focus();
    }
  }

  function closePopout(matchId: string) {
    const w = state.windows[matchId];
    if (w && !w.closed) {
      w.close();
    }
    state.open.delete(matchId);
    delete state.windows[matchId];
    syncPollTimer();
  }

  return {
    isOpen,
    openPopout,
    focusPopout,
    closePopout,
    openCount: computed(() => state.open.size),
  };
}

// Helper used by the popout page itself to advertise its lifecycle.
// Kept here so the channel name lives in one place.
export function announceMatchPopout(matchId: string) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return () => {};
  }
  const ch = new BroadcastChannel(CHANNEL_NAME);
  const announce = () => ch.postMessage({ type: "alive", matchId });
  announce();
  ch.onmessage = (e: MessageEvent) => {
    if (e.data?.type === "ping") announce();
  };
  const onUnload = () => {
    ch.postMessage({ type: "closed", matchId });
  };
  window.addEventListener("pagehide", onUnload);
  window.addEventListener("beforeunload", onUnload);

  return () => {
    onUnload();
    window.removeEventListener("pagehide", onUnload);
    window.removeEventListener("beforeunload", onUnload);
    ch.close();
  };
}
