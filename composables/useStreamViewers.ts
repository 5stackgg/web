import { ref, computed, onScopeDispose } from "vue";

const POLL_INTERVAL_MS = 30_000;

const viewers = ref<Record<string, number>>({});
let consumers = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

async function fetchOnce() {
  if (inFlight) return inFlight;
  const config = useRuntimeConfig();
  inFlight = (async () => {
    try {
      const response = await fetch(
        `https://${config.public.apiDomain}/matches/stream-viewers`,
        { credentials: "include" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as Record<string, number>;
      viewers.value = data ?? {};
    } catch {
      // transient — keep previous map
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function startPolling() {
  if (pollTimer) return;
  void fetchOnce();
  pollTimer = setInterval(() => {
    void fetchOnce();
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function useStreamViewers() {
  consumers += 1;
  if (consumers === 1) {
    startPolling();
  }

  onScopeDispose(() => {
    consumers -= 1;
    if (consumers <= 0) {
      consumers = 0;
      stopPolling();
    }
  });

  function getCount(matchId: string) {
    return computed<number | null>(() => {
      const v = viewers.value[matchId];
      return typeof v === "number" ? v : null;
    });
  }

  return { viewers, getCount, refresh: fetchOnce };
}
