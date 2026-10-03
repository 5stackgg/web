// Dead-reckoned demo tick. The pod can't stream its live tick, so the
// client anchors on the last known (tick, wall-clock) pair and advances
// it at rate × tickRate. Pure so the seek bar's rAF loop and the store's
// one-off reads share one formula.
export type DemoTickAnchors = {
  lastTickAtSync: number;
  lastSyncRealMs: number;
  rate: number;
  tickRate: number;
  paused: boolean;
  seeking: boolean;
  seekingSinceMs: number;
};

// A demo_gototick that never confirms un-freezes after this long; the
// pod's own ceiling matches.
export const SEEK_FREEZE_CEILING_MS = 20_000;

export function estimateDemoTick(a: DemoTickAnchors, now: number): number {
  if (a.paused) return a.lastTickAtSync;
  // Park at the seek target while cs2 catches up.
  if (a.seeking && now - a.seekingSinceMs < SEEK_FREEZE_CEILING_MS) {
    return a.lastTickAtSync;
  }
  const elapsedSec = (now - a.lastSyncRealMs) / 1000;
  return Math.max(
    0,
    Math.round(a.lastTickAtSync + elapsedSec * a.rate * a.tickRate),
  );
}

// Index of the round containing `tick`, or -1. Rounds are sorted by
// start_tick; binary search because the seek bar asks every frame.
export function roundIndexAt(
  rounds: ReadonlyArray<{ start_tick: number; end_tick: number }>,
  tick: number,
): number {
  let lo = 0;
  let hi = rounds.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rounds[mid].start_tick <= tick) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0 || tick > rounds[found].end_tick) return -1;
  return found;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
