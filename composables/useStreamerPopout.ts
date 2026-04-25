import { reactive, computed } from "vue";

// Module-level singleton: shared across every component that imports
// the composable so the deck UI knows when a focus window is owned by
// this tab — avoids running two WebRTC players against the same WHEP
// path simultaneously (mediamtx tolerates it but it doubles upstream
// bandwidth for no UX gain).

type State = {
  // Window handles we own (this tab opened them). Cleared when the
  // window is closed locally — required to call `.focus()` later.
  windows: Record<string, Window>;
  // Source of truth for "is some focus window broadcasting it owns
  // matchId X". Driven by both window.closed polling AND by
  // BroadcastChannel heartbeats so we also detect popouts opened from
  // a previous index-page session (orphans after a reload).
  open: Set<string>;
};

const state = reactive<State>({ windows: {}, open: new Set<string>() });

const CHANNEL_NAME = "streamer-focus";
let channel: BroadcastChannel | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

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
    }
    // "ping" messages are intended for focus windows to respond to —
    // we ignore them on the deck side.
  };
  // Probe for orphans on first mount: any focus page already open
  // will reply with an "alive" message.
  channel.postMessage({ type: "ping" });
}

function ensurePoll() {
  if (pollTimer || typeof window === "undefined") return;
  pollTimer = setInterval(() => {
    for (const [id, w] of Object.entries(state.windows)) {
      if (w.closed) {
        state.open.delete(id);
        delete state.windows[id];
      }
    }
  }, 1000);
}

export function useStreamerPopout() {
  ensureChannel();
  ensurePoll();

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
    // Open at the full available screen size so casters get a
    // maximized broadcast deck out of the gate. `screen.availWidth/
    // Height` excludes the OS dock/taskbar so the window doesn't
    // overflow off-screen. `popup=yes` keeps it chrome-light (no
    // tabs/toolbar) — combined with `layout: false` on the focus
    // page this approximates a real fullscreen experience without
    // needing the Fullscreen API (which requires a per-window user
    // gesture and can't be triggered from the opener).
    const w = screen.availWidth;
    const h = screen.availHeight;
    const features = [
      "popup=yes",
      `width=${w}`,
      `height=${h}`,
      "left=0",
      "top=0",
      "menubar=no",
      "toolbar=no",
      "location=no",
      "status=no",
      "resizable=yes",
    ].join(",");
    const win = window.open(
      `/stream-deck/${matchId}`,
      `stream-deck-${matchId}`,
      features,
    );
    if (win) {
      state.windows[matchId] = win;
      state.open.add(matchId);
      // Some browsers (Firefox, certain Chromium versions) ignore the
      // size hints when the requested dimensions match an existing
      // window of the same name — call moveTo/resizeTo as a belt-and-
      // suspenders so the deck always lands maximized on first open.
      try {
        win.moveTo(0, 0);
        win.resizeTo(w, h);
      } catch {
        /* ignore — some browsers refuse these in cross-origin or
           permission-restricted contexts */
      }
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
  }

  return {
    isOpen,
    openPopout,
    focusPopout,
    closePopout,
    openCount: computed(() => state.open.size),
  };
}

// Helper used by the focus page itself to advertise its lifecycle.
// Kept here so the channel name lives in one place.
export function announceFocusWindow(matchId: string) {
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
