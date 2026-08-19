import { reactive, computed } from "vue";

// Game node files open in their own window rather than a route, for the same
// reason the match player does: an admin comparing what is actually on disk
// across three nodes wants three explorers side by side, and a route swap gives
// them one. A popup also has no address bar, so the window stays pointed at the
// node it was opened for.

type Target = {
  // "node" browses the node-wide volume, "server" a single server's directory.
  scope: "node" | "server";
  id: string;
  // Deep link, so a plugin can open straight to its config directory.
  path?: string;
  // Only used to name the window; the page loads its own label.
  label?: string;
};

type State = {
  windows: Record<string, Window>;
  open: Set<string>;
};

const state = reactive<State>({ windows: {}, open: new Set<string>() });

let pollTimer: ReturnType<typeof setInterval> | null = null;
let visibilityListenerInstalled = false;

function keyFor(target: Pick<Target, "scope" | "id">) {
  return `${target.scope}:${target.id}`;
}

// Only spin the poll while we actually own a window AND this tab is visible.
function syncPollTimer() {
  if (typeof window === "undefined") {
    return;
  }

  const wantsPoll =
    Object.keys(state.windows).length > 0 &&
    (typeof document === "undefined" || !document.hidden);

  if (wantsPoll && !pollTimer) {
    pollTimer = setInterval(() => {
      let changed = false;

      for (const [key, handle] of Object.entries(state.windows)) {
        if (handle.closed) {
          state.open.delete(key);
          delete state.windows[key];
          changed = true;
        }
      }

      if (changed) {
        syncPollTimer();
      }
    }, 1000);
  } else if (!wantsPoll && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function installVisibilityListener() {
  if (visibilityListenerInstalled || typeof document === "undefined") {
    return;
  }

  visibilityListenerInstalled = true;
  document.addEventListener("visibilitychange", () => syncPollTimer());
}

export function useFilePopout() {
  installVisibilityListener();
  syncPollTimer();

  function isOpen(target: Pick<Target, "scope" | "id">) {
    return state.open.has(keyFor(target));
  }

  function openFiles(target: Target) {
    if (typeof window === "undefined") {
      return;
    }

    const key = keyFor(target);
    const existing = state.windows[key];

    // Re-opening the same node focuses the window we already have rather than
    // stacking a second one on top of it.
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }

    const query = target.path
      ? `?path=${encodeURIComponent(target.path)}`
      : "";

    const handle = window.open(
      `/file-popout/${target.scope}/${target.id}${query}`,
      `file-popout-${key}`,
      "popup=yes,width=1180,height=760,resizable=yes,scrollbars=no",
    );

    // A blocked popup returns null. Leaving it at that gives a button that
    // does nothing, so fall back to the in-panel route the popup replaced.
    if (!handle) {
      window.location.href =
        target.scope === "server"
          ? `/dedicated-servers/${target.id}/files${query}`
          : `/game-server-nodes/${target.id}/files${query}`;
      return;
    }

    state.windows[key] = handle;
    state.open.add(key);
    syncPollTimer();
    handle.focus();
  }

  function closeFiles(target: Pick<Target, "scope" | "id">) {
    const key = keyFor(target);
    const handle = state.windows[key];

    if (handle && !handle.closed) {
      handle.close();
    }

    state.open.delete(key);
    delete state.windows[key];
    syncPollTimer();
  }

  return {
    isOpen,
    openFiles,
    closeFiles,
    openCount: computed(() => state.open.size),
  };
}
