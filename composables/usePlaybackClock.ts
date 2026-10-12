import { computed, getCurrentScope, onScopeDispose, ref } from "vue";
import type { ComputedRef, Ref } from "vue";

export type PlaybackClock = {
  /** Seconds into the run, every frame while it runs; null before it starts. */
  position: Readonly<Ref<number | null>>;
  /**
   * The same in tenths while it runs, for labels and whatever is not worth
   * redrawing every frame; exact while paused.
   */
  tenths: ComputedRef<number | null>;
  running: Readonly<Ref<boolean>>;
  /** Seconds the run lasts. */
  length: ComputedRef<number>;
  play(from?: number): void;
  pause(): void;
  seek(seconds: number): void;
  stop(): void;
};

/**
 * A run that plays like a video: play, pause, scrub, and hold on its last
 * moment. One animation frame loop drives it, and everything drawn from the
 * run reads `position` rather than keeping a clock of its own.
 */
export function usePlaybackClock(options: {
  length: () => number;
  /** The run reached its end and is holding on its last moment. */
  onEnd?: () => void;
}): PlaybackClock {
  const position = ref<number | null>(null);
  const running = ref(false);
  const length = computed(() => Math.max(0, options.length()));
  // The `performance.now()` the run would have started at to be where it is.
  let startedAt = 0;
  let frame: number | null = null;

  function cancel() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function tick(now: number) {
    // A frame's timestamp can predate the play() that scheduled it.
    const at = Math.max(0, (now - startedAt) / 1000);
    if (at < length.value) {
      position.value = at;
      frame = requestAnimationFrame(tick);
      return;
    }
    frame = null;
    running.value = false;
    position.value = length.value;
    options.onEnd?.();
  }

  function play(from = 0) {
    cancel();
    position.value = from;
    startedAt = performance.now() - from * 1000;
    running.value = true;
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    if (running.value) {
      position.value = Math.min(
        length.value,
        (performance.now() - startedAt) / 1000,
      );
    }
    cancel();
    running.value = false;
  }

  function seek(seconds: number) {
    const at = Math.min(length.value, Math.max(0, seconds));
    position.value = at;
    if (running.value) {
      startedAt = performance.now() - at * 1000;
    }
  }

  function stop() {
    cancel();
    running.value = false;
    position.value = null;
  }

  const tenths = computed(() =>
    position.value !== null && running.value
      ? Math.round(position.value * 10) / 10
      : position.value,
  );

  if (getCurrentScope()) {
    onScopeDispose(cancel);
  }

  return {
    position,
    tenths,
    running,
    length,
    play,
    pause,
    seek,
    stop,
  };
}
