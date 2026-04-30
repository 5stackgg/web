import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";

// Demo-playback session state, scoped to the current viewer's tab.
// One pod per viewer per match_map (api enforces that), so a single
// active session at a time is the right model.
//
// Status / stream_url come from a Hasura subscription on the
// match_demo_sessions row — the streamer pod's status-reporter
// daemon writes there as it boots, becomes live, errors, etc.
// No API polling.
//
// Tick-based throughout: the seek bar binds to `currentTick` against
// `totalTicks`, not to seconds against duration. Keeping ticks as the
// primary axis makes round-jump trivial (round_ticks gives us start
// ticks directly) and avoids drift between client and CS2 when the
// playback rate changes.
export const useDemoPlaybackStore = defineStore("demoPlayback", () => {
  const matchMapId = ref<string | null>(null);

  // The match_demo_sessions row, populated from the Hasura
  // subscription. UI surfaces .status / .stream_url / .error_message
  // from this — local `localStatus` only covers the brief window
  // before the subscription delivers its first row.
  const sessionRow = ref<{
    id: string;
    status: string;
    stream_url: string | null;
    error_message: string | null;
    last_status_at: string;
    last_activity_at: string;
    // jsonb array of {status, at} appended on every reportDemoStatus
    // call. Drives the stepper's done/skipped distinction.
    status_history: Array<{ status: string; at: string }>;
  } | null>(null);

  // Local status used while we're still waiting on the subscription
  // to deliver — covers the pre-insert + insert-but-not-yet-fanout
  // windows. Once sessionRow is populated, surfaceStatus uses the
  // row's status instead.
  const localStatus = ref<"idle" | "starting" | "stopping" | "error">("idle");
  const errorMessage = ref<string | null>(null);

  // Demo metadata (extracted by demo-parser, cached on
  // match_map_demos). Populated from a Hasura query at start.
  const totalTicks = ref<number>(0);
  const tickRate = ref<number>(64);
  const roundTicks = ref<
    Array<{
      round: number;
      start_tick: number;
      end_tick: number;
      winner?: string;
      reason?: number;
    }>
  >([]);
  // Demo-event timeline. Sorted by tick (parser emits in order).
  // Used for jump-to-next-* buttons + seek-bar markers.
  const kills = ref<
    Array<{
      tick: number;
      killer?: string;
      victim?: string;
      assist?: string;
      weapon?: string;
      headshot?: boolean;
    }>
  >([]);
  const bombs = ref<
    Array<{
      tick: number;
      type: "planted" | "defused" | "exploded";
      player?: string;
      site?: "A" | "B";
    }>
  >([]);

  // Tick estimator state. Real tick =
  //   lastTickAtSync + (now - lastSyncRealMs) / 1000 * rate * tickRate
  // unless paused. Updated on every user-initiated control (seek,
  // pause, speed change). The api can't tell us the live tick — CS2's
  // demo command surface doesn't expose it cleanly — so we estimate
  // and resync on every action.
  const lastTickAtSync = ref<number>(0);
  const lastSyncRealMs = ref<number>(Date.now());
  const rate = ref<number>(1);
  const paused = ref<boolean>(false);

  // Surface a single status string to the UI. Subscription-driven
  // status (booting / launching_steam / live / errored) wins; local
  // ("starting" / "stopping" / "error") fills the pre-subscription gap.
  const status = computed<string>(() => {
    if (sessionRow.value?.status) return sessionRow.value.status;
    return localStatus.value;
  });
  const streamUrl = computed<string | null>(
    () => sessionRow.value?.stream_url ?? null,
  );
  // The streamer pod's status reporter sets status='live' the moment
  // GStreamer starts publishing to mediamtx — that's when the WHEP
  // egress on mediamtx will actually return a stream.
  const isLive = computed(() => status.value === "live");
  const isErrored = computed(
    () => status.value === "errored" || status.value === "error",
  );

  function syncFromControl(snapshot: {
    tick?: number;
    rate?: number;
    paused?: boolean;
  }) {
    if (typeof snapshot.tick === "number") lastTickAtSync.value = snapshot.tick;
    if (typeof snapshot.rate === "number") rate.value = snapshot.rate;
    if (typeof snapshot.paused === "boolean") paused.value = snapshot.paused;
    lastSyncRealMs.value = Date.now();
  }

  // Computed live tick estimate — animates the scrubber without
  // forcing an api round-trip every animation frame. Resyncs every
  // user-initiated control via syncFromControl.
  const currentTick = computed<number>(() => {
    if (paused.value) return lastTickAtSync.value;
    const elapsedSec = (Date.now() - lastSyncRealMs.value) / 1000;
    return Math.max(
      0,
      Math.round(
        lastTickAtSync.value + elapsedSec * rate.value * tickRate.value,
      ),
    );
  });

  const currentSeconds = computed(() =>
    tickRate.value > 0 ? currentTick.value / tickRate.value : 0,
  );
  const totalSeconds = computed(() =>
    tickRate.value > 0 ? totalTicks.value / tickRate.value : 0,
  );

  function reset() {
    matchMapId.value = null;
    sessionRow.value = null;
    localStatus.value = "idle";
    errorMessage.value = null;
    lastTickAtSync.value = 0;
    lastSyncRealMs.value = Date.now();
    rate.value = 1;
    paused.value = false;
  }

  return {
    matchMapId,
    sessionRow,
    localStatus,
    errorMessage,
    totalTicks,
    tickRate,
    roundTicks,
    kills,
    bombs,
    rate,
    paused,
    lastTickAtSync,
    lastSyncRealMs,
    currentTick,
    currentSeconds,
    totalSeconds,
    status,
    streamUrl,
    isLive,
    isErrored,
    syncFromControl,
    reset,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useDemoPlaybackStore, import.meta.hot),
  );
}
