import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { useNuxtApp } from "#app";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import socket from "~/web-sockets/Socket";

// Wrapper around the watchDemo / stopWatchDemo / demoControl actions
// plus the Hasura subscription on match_demo_sessions. The store
// holds reactive state; this composable is the side-effect bridge.
//
// Status / stream_url come from the subscription, not API polling.
// The streamer pod's status-reporter writes status updates to its
// match_demo_sessions row → the subscription fires → store updates →
// UI renders. This matches the live-streams flow.
export function useDemoPlayback() {
  const store = useDemoPlaybackStore();
  const { $apollo } = useNuxtApp();
  const { subscribe, unsubscribe } = useSubscriptionManager();

  function subscriptionKey(sessionId: string) {
    return `demo-session:${sessionId}`;
  }

  function subscribeToSession(sessionId: string) {
    const sub = getGraphqlClient().subscribe({
      query: generateSubscription({
        match_demo_sessions: [
          {
            where: { id: { _eq: sessionId } },
            limit: 1,
          } as any,
          {
            id: true,
            status: true,
            stream_url: true,
            error_message: true,
            last_status_at: true,
            last_activity_at: true,
            // jsonb of fired statuses; drives the stepper's
            // skipped-vs-done distinction. On refresh it's already
            // populated so the stepper renders correct cumulative
            // state without replay.
            status_history: true as any,
          },
        ],
      } as any),
    });
    subscribe(
      subscriptionKey(sessionId),
      sub.subscribe({
        next: ({ data }: any) => {
          const row = data?.match_demo_sessions?.[0];
          if (!row) {
            // Row deleted — server-side stop or reaper. Reflect that
            // by clearing our local state so the UI returns to the
            // "Watch demo" call-to-action.
            unsubscribe(subscriptionKey(sessionId));
            store.reset();
            return;
          }
          store.sessionRow = row;
        },
        error: (error: any) => {
          console.error("[demo-session] subscription error:", error);
        },
      }),
    );
  }

  async function loadMetadata(matchMapId: string) {
    const { data } = await $apollo.defaultClient.query({
      fetchPolicy: "network-only",
      query: generateQuery({
        match_map_demos: [
          {
            where: { match_map_id: { _eq: matchMapId } },
            limit: 1,
          },
          {
            id: true,
            // Generated Zeus types lag the metadata migration until
            // codegen runs — these are typed loosely until then.
            total_ticks: true as any,
            tick_rate: true as any,
            round_ticks: true as any,
            kills: true as any,
            bombs: true as any,
            metadata_parsed_at: true as any,
          },
        ],
      }),
    });

    const demo = data?.match_map_demos?.[0] as any;
    if (!demo) return null;
    if (demo.total_ticks) store.totalTicks = demo.total_ticks;
    if (demo.tick_rate) store.tickRate = demo.tick_rate;
    if (Array.isArray(demo.round_ticks)) store.roundTicks = demo.round_ticks;
    if (Array.isArray(demo.kills)) store.kills = demo.kills;
    if (Array.isArray(demo.bombs)) store.bombs = demo.bombs;
    return demo;
  }

  async function start(matchMapId: string) {
    store.reset();
    store.matchMapId = matchMapId;
    store.localStatus = "starting";
    try {
      // Order matters: watchDemo's first call kicks off the parse
      // (DemoMetadataService.ensureParsed) and waits for it. Loading
      // metadata BEFORE watchDemo fetches the row from BEFORE the
      // parse, so we'd see total_ticks=0 / tick_rate=0 forever.
      // After watchDemo returns, the row has the freshly-written
      // event data — that's when we read it.
      const { data } = await $apollo.defaultClient.mutate({
        // Generated Zeus types lag the new Hasura actions until codegen
        // runs — cast the operation map until the types catch up.
        mutation: generateMutation({
          watchDemo: [
            { match_map_id: matchMapId },
            { success: true, session_id: true, stream_url: true },
          ],
        } as any),
      });
      const out = (data as any)?.watchDemo;
      if (!out?.success || !out.session_id) {
        throw new Error("watchDemo returned no session");
      }

      // Now-fresh row: parser has written back total_ticks /
      // tick_rate / kills / bombs / round_ticks. Populate the store
      // so the seek bar + event nav appear as soon as the popup
      // moves out of the booting state.
      await loadMetadata(matchMapId);

      // Subscription will populate store.sessionRow with the latest
      // status (booting → launching_steam → live, or errored).
      subscribeToSession(out.session_id);
    } catch (error) {
      store.localStatus = "error";
      store.errorMessage = (error as Error)?.message ?? String(error);
      throw error;
    }
  }

  async function stop() {
    if (!store.matchMapId) return;
    const sessionId = store.sessionRow?.id ?? null;
    store.localStatus = "stopping";
    try {
      await $apollo.defaultClient.mutate({
        mutation: generateMutation({
          stopWatchDemo: [
            { match_map_id: store.matchMapId },
            { success: true },
          ],
        } as any),
      });
    } finally {
      if (sessionId) unsubscribe(subscriptionKey(sessionId));
      store.reset();
    }
  }

  // Fire-and-forget over the existing WS. Lower latency than a Hasura
  // mutation round-trip, no extra HTTP per click. The api proxies to
  // the spec-server pod and the next subscription tick on
  // match_demo_sessions reflects the resulting state — so the UI
  // stays optimistic between click and confirm.
  function control(
    action:
      | "pause"
      | "resume"
      | "toggle"
      | "seek"
      | "skip"
      | "speed"
      | "round"
      | "state",
    payload: Record<string, unknown> = {},
  ) {
    if (!store.matchMapId) {
      throw new Error("no demo session active");
    }
    socket.event("demo-session:control", {
      match_map_id: store.matchMapId,
      action,
      payload,
    });
  }

  // Optimistic wrappers: update the store immediately so the UI feels
  // responsive, then fire the WS event. The next match_demo_sessions
  // subscription tick is the source of truth for status/activity; we
  // don't await a per-control response.
  function play() {
    store.syncFromControl({ paused: false });
    control("resume");
  }

  function pause() {
    // Snapshot the current estimate so the scrubber freezes at the
    // right tick before the WS round-trip.
    store.syncFromControl({ tick: store.currentTick, paused: true });
    control("pause");
  }

  function togglePause() {
    if (store.paused) return play();
    return pause();
  }

  function seek(tick: number) {
    const clamped = Math.max(
      0,
      Math.min(store.totalTicks || Number.MAX_SAFE_INTEGER, Math.round(tick)),
    );
    store.syncFromControl({ tick: clamped });
    control("seek", { tick: clamped });
  }

  function skip(secs: number) {
    const target = store.currentTick + Math.round(secs * store.tickRate);
    return seek(target);
  }

  function setSpeed(rate: number) {
    // Snapshot tick BEFORE rate changes so the estimator stays
    // continuous across the transition.
    store.syncFromControl({ tick: store.currentTick, rate });
    control("speed", { rate });
  }

  function jumpToRound(round: number) {
    const entry = store.roundTicks.find((r) => r.round === round);
    if (entry) {
      // Use the local tick value directly so we don't depend on the
      // sidecar map being in sync with the api.
      return seek(entry.start_tick);
    }
    // Fallback: trust the api (lookup happens server-side from the
    // streamer pod's $LOG_DIR/demo-round-ticks.json sidecar).
    control("round", { round });
  }

  // Step navigation across an event timeline. Generic over kills,
  // bombs, rounds — pass the array. Anchors a few ticks before the
  // event so the operator sees the lead-up rather than landing on
  // the kill itself with no context.
  const ANTICIPATION_TICKS = 64; // ~1s at 64-tick demos
  function jumpToNextEvent(events: Array<{ tick: number }>) {
    if (!events.length) return;
    const cur = store.currentTick;
    const next = events.find((e) => e.tick > cur);
    if (next) seek(Math.max(0, next.tick - ANTICIPATION_TICKS));
  }
  function jumpToPrevEvent(events: Array<{ tick: number }>) {
    if (!events.length) return;
    // "Prev" means the most recent event before (currentTick - small
    // grace). Without the grace, hammering "prev" right after a jump
    // re-targets the same event.
    const cur = store.currentTick - 5 * store.tickRate;
    let last = null as { tick: number } | null;
    for (const e of events) {
      if (e.tick < cur) last = e;
      else break;
    }
    if (last) seek(Math.max(0, last.tick - ANTICIPATION_TICKS));
  }
  function jumpToNextKill() {
    jumpToNextEvent(store.kills);
  }
  function jumpToPrevKill() {
    jumpToPrevEvent(store.kills);
  }
  function jumpToNextBomb() {
    jumpToNextEvent(store.bombs);
  }
  function jumpToPrevBomb() {
    jumpToPrevEvent(store.bombs);
  }
  function jumpToNextRound() {
    jumpToNextEvent(store.roundTicks.map((r) => ({ tick: r.start_tick })));
  }
  function jumpToPrevRound() {
    jumpToPrevEvent(store.roundTicks.map((r) => ({ tick: r.start_tick })));
  }

  return {
    store,
    start,
    stop,
    play,
    pause,
    togglePause,
    seek,
    skip,
    setSpeed,
    jumpToRound,
    jumpToNextKill,
    jumpToPrevKill,
    jumpToNextBomb,
    jumpToPrevBomb,
    jumpToNextRound,
    jumpToPrevRound,
  };
}
