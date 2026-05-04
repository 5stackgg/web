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
      // "ct" / "t" / undefined — recorded at kill time so half-time
      // side-swaps don't need to be replayed in the UI.
      killer_team?: "ct" | "t";
      victim_team?: "ct" | "t";
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

  // Match shape — mirrors what the live stream-deck reads off
  // match_streams.match. Drives the slot-grid layout (5v5/2v2/1v1)
  // and the team labels in the player-switcher row.
  const matchType = ref<string | null>(null);
  const lineup1Name = ref<string | null>(null);
  const lineup2Name = ref<string | null>(null);
  // steam_id → display name. Built from match.lineup_*.lineup_players
  // at session start. Used to resolve killer/victim in kill tooltips.
  const playerNames = ref<Record<string, string>>({});
  // Roster info for the player filter — preserves lineup grouping +
  // team color hint so the dropdown can render team-grouped sections.
  const rosters = ref<{
    lineup1: Array<{ steam_id: string; name: string }>;
    lineup2: Array<{ steam_id: string; name: string }>;
  }>({ lineup1: [], lineup2: [] });
  // Active player filter for the kill nav. When set, jumpToNextKill /
  // jumpToPrevKill + the skull markers scope to kills *by* this steam
  // id only. null = show all kills.
  const killFilterSteamId = ref<string | null>(null);
  // "killer" = filter to kills BY this player (highlight reel mode).
  // "victim" = filter to deaths OF this player (mistakes review mode).
  const killFilterMode = ref<"killer" | "victim">("killer");
  // Toggled UI state for quick actions. Local-only — the api fires
  // the corresponding console command immediately, no subscription
  // round-trip required.
  const xrayEnabled = ref<boolean>(false);
  const hudVisible = ref<boolean>(true);

  // Live slot → player snapshot from the pod's GSI feed. Updated
  // ~1Hz by useDemoPlayback's poll loop — cs2 only changes
  // observer_slot at round transitions, but `alive` flips on every
  // death. Empty until the first /demo/state poll lands.
  const specSlots = ref<
    Array<{
      slot: number;
      steam_id: string;
      name: string | null;
      team: "T" | "CT" | null;
      alive: boolean;
      health: number;
    }>
  >([]);
  // Steamid of the player cs2 is currently centered on. Drives the
  // "active slot" highlight in the slot grid — when the spec target
  // dies and cs2 auto-switches, this changes but the slot of the new
  // target stays the same, so the highlight follows the death-switch
  // without us having to track it separately.
  const spectatedSteamId = ref<string | null>(null);
  // Team names from cs2 GSI (the demo file's mp_teamname_1/2). The
  // api's lineup.name can drift from the actual demo when a different
  // demo file got attached to a match_map row, so for the player UI
  // we prefer GSI here. Null until the first GSI tick lands.
  const gsiTeamCtName = ref<string | null>(null);
  const gsiTeamTName = ref<string | null>(null);
  const gsiTeamCtScore = ref<number>(0);
  const gsiTeamTScore = ref<number>(0);

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

  // Reactive wall-clock ref the live-tick computed depends on.
  // `Date.now()` itself isn't a reactive dep, so without this the
  // currentTick computed cached the moment of the last control event
  // and the seek bar froze between user actions. The interval ticks
  // at 50ms (~20Hz) which is plenty smooth for a tick estimator —
  // visualTick smoothing in DemoPlaybackControls reads currentTick
  // every rAF frame and snaps when the diff is tiny, so the
  // ~50ms freshness floor is invisible to the user.
  const nowMs = ref<number>(Date.now());
  if (typeof window !== "undefined") {
    setInterval(() => {
      nowMs.value = Date.now();
    }, 50);
  }

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
  // `playing` is reported by spec-server's GSI handler on the first
  // game-state event from cs2 — the moment the demo is genuinely
  // rendering frames. The WHEP player gates on this so we never show
  // a menu/loading frame; the timeline gates on this so it doesn't
  // estimate ticks against a not-yet-playing demo.
  const isPlaying = computed(() => status.value === "playing");
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
    const elapsedSec = (nowMs.value - lastSyncRealMs.value) / 1000;
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
    matchType.value = null;
    lineup1Name.value = null;
    lineup2Name.value = null;
    playerNames.value = {};
    rosters.value = { lineup1: [], lineup2: [] };
    killFilterSteamId.value = null;
    killFilterMode.value = "killer";
    xrayEnabled.value = false;
    hudVisible.value = true;
    specSlots.value = [];
    spectatedSteamId.value = null;
    gsiTeamCtName.value = null;
    gsiTeamTName.value = null;
    gsiTeamCtScore.value = 0;
    gsiTeamTScore.value = 0;
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
    matchType,
    lineup1Name,
    lineup2Name,
    playerNames,
    rosters,
    killFilterSteamId,
    killFilterMode,
    xrayEnabled,
    hudVisible,
    specSlots,
    spectatedSteamId,
    gsiTeamCtName,
    gsiTeamTName,
    gsiTeamCtScore,
    gsiTeamTScore,
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
    isPlaying,
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
