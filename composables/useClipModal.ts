import { computed } from "vue";
import { useRoute } from "vue-router";
import { useState } from "#app";

export type ClipQueueItem = {
  id: string;
  title: string | null;
  playerName: string | null;
  teamName: string | null;
  durationMs: number | null;
  thumbnailUrl: string | null;
  posterUrl: string | null;
};

// Modal driven by the `?clip=<id>` query param so deep links and
// back/forward navigate naturally.
export function useClipModal() {
  const route = useRoute();
  const activeClipIdState = useState<string | null>(
    "clip-modal-active-id",
    () => {
      const v = route.query.clip;
      return typeof v === "string" && v.length > 0 ? v : null;
    },
  );
  const popstateListenerInstalled = useState(
    "clip-modal-popstate-listener-installed",
    () => false,
  );
  const clipQueue = useState<ClipQueueItem[]>("clip-modal-queue", () => []);
  const clipQueueScope = useState<string | null>(
    "clip-modal-queue-scope",
    () => null,
  );

  const activeClipId = computed<string | null>(() => activeClipIdState.value);

  function clipIdFromLocation(): string | null {
    if (typeof window === "undefined") return activeClipIdState.value;
    const v = new URL(window.location.href).searchParams.get("clip");
    return v && v.length > 0 ? v : null;
  }

  function writeClipUrl(id: string | null, mode: "push" | "replace") {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("clip", id);
    else url.searchParams.delete("clip");
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (
      next ===
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    ) {
      return;
    }
    const state = { ...(window.history.state ?? {}), clipModal: id };
    if (mode === "push") window.history.pushState(state, "", next);
    else window.history.replaceState(state, "", next);
  }

  if (typeof window !== "undefined" && !popstateListenerInstalled.value) {
    popstateListenerInstalled.value = true;
    window.addEventListener("popstate", () => {
      activeClipIdState.value = clipIdFromLocation();
    });
    activeClipIdState.value = clipIdFromLocation();
  }

  function openClip(id: string) {
    if (activeClipId.value) {
      activeClipIdState.value = id;
      writeClipUrl(id, "replace");
      return;
    }
    activeClipIdState.value = id;
    writeClipUrl(id, "push");
  }

  // Open the modal without pushing a history entry. If the URL
  // already references a clip (e.g. a deep link landed the user
  // here), keep it in sync so the address bar never lies; otherwise
  // leave the URL alone — surfaces like the render queue explicitly
  // don't want navigation.
  function showClip(id: string) {
    activeClipIdState.value = id;
    if (typeof window === "undefined") return;
    const current = new URL(window.location.href).searchParams.get("clip");
    if (current && current !== id) writeClipUrl(id, "replace");
  }

  function closeClip() {
    if (!activeClipId.value) return;
    activeClipIdState.value = null;
    writeClipUrl(null, "replace");
  }

  const activeClipIndex = computed(() => {
    if (!activeClipId.value) return -1;
    return clipQueue.value.findIndex((item) => item.id === activeClipId.value);
  });

  const previousClip = computed<ClipQueueItem | null>(() => {
    const i = activeClipIndex.value;
    if (i <= 0) return null;
    return clipQueue.value[i - 1] ?? null;
  });

  const nextClip = computed<ClipQueueItem | null>(() => {
    const i = activeClipIndex.value;
    if (i < 0) return null;
    return clipQueue.value[i + 1] ?? null;
  });

  function openPreviousClip() {
    if (previousClip.value) openClip(previousClip.value.id);
  }

  function openNextClip() {
    if (nextClip.value) openClip(nextClip.value.id);
  }

  function setClipQueue(items: ClipQueueItem[], scope: string | null = null) {
    const seen = new Set<string>();
    clipQueue.value = items.filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    clipQueueScope.value = scope;
  }

  function clearClipQueue(scope: string | null = null) {
    if (scope && clipQueueScope.value !== scope) return;
    clipQueue.value = [];
    clipQueueScope.value = null;
  }

  return {
    activeClipId,
    activeClipIndex,
    clipQueue,
    nextClip,
    previousClip,
    setClipQueue,
    clearClipQueue,
    openClip,
    showClip,
    closeClip,
    openNextClip,
    openPreviousClip,
  };
}
