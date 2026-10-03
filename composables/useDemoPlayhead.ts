import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";

// Drives a per-frame playhead without going through Vue reactivity.
// `onFrame` gets the estimated tick on the first frame and then only when
// it changes; callers write it straight to the DOM (a transform, a
// textContent) so a playing demo costs a compositor update per frame
// instead of a component re-render.
//
// The loop only runs while the demo is moving. Anything that moves the
// playhead while it's parked (a seek while paused, a pod resync) changes a
// sync anchor, which schedules a single frame.
export function useDemoPlayhead(onFrame: (tick: number) => void) {
  const store = useDemoPlaybackStore();

  let raf: number | null = null;
  let lastTick = Number.NaN;
  let alive = false;

  const moving = computed(() => store.isPlaying && !store.paused);

  function frame() {
    raf = null;
    if (!alive) return;
    const tick = store.tickNow();
    if (tick !== lastTick) {
      lastTick = tick;
      onFrame(tick);
    }
    if (moving.value) raf = requestAnimationFrame(frame);
  }

  function schedule() {
    if (!alive || raf !== null) return;
    raf = requestAnimationFrame(frame);
  }

  // Re-emit on the next frame even if the tick is unchanged — for callers
  // whose own geometry changed (a resize, a drag ending).
  function refresh() {
    lastTick = Number.NaN;
    schedule();
  }

  watch(
    () => [
      moving.value,
      store.lastTickAtSync,
      store.lastSyncRealMs,
      store.rate,
      store.seeking,
      store.totalTicks,
      store.tickRate,
    ],
    refresh,
  );

  onMounted(() => {
    alive = true;
    refresh();
  });

  onBeforeUnmount(() => {
    alive = false;
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  });

  return { refresh };
}
