// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaybackClock } from "~/composables/usePlaybackClock";

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePlaybackClock", () => {
  it("moves every frame while it runs, and holds where it was paused", () => {
    const run = usePlaybackClock({ length: () => 10 });
    expect(run.position.value).toBeNull();

    run.play();
    vi.advanceTimersByTime(1000);
    expect(run.running.value).toBe(true);
    expect(run.position.value).toBeGreaterThan(0.9);
    expect(run.position.value).toBeLessThanOrEqual(1);

    run.pause();
    const held = run.position.value;
    vi.advanceTimersByTime(1000);
    expect(run.running.value).toBe(false);
    expect(run.position.value).toBe(held);

    run.play(held!);
    vi.advanceTimersByTime(500);
    expect(run.position.value).toBeGreaterThan(held! + 0.4);
  });

  it("scrubs within the run, running or not", () => {
    const run = usePlaybackClock({ length: () => 10 });
    run.seek(25);
    expect(run.position.value).toBe(10);
    run.seek(-3);
    expect(run.position.value).toBe(0);

    run.play();
    vi.advanceTimersByTime(200);
    run.seek(6);
    vi.advanceTimersByTime(500);
    expect(run.position.value).toBeGreaterThan(6.4);
    expect(run.position.value).toBeLessThan(6.6);
  });

  it("holds on its last moment when it reaches the end", () => {
    const onEnd = vi.fn();
    const run = usePlaybackClock({ length: () => 2, onEnd });

    run.play(1.5);
    vi.advanceTimersByTime(1000);

    expect(run.running.value).toBe(false);
    expect(run.position.value).toBe(2);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("gives labels tenths while it runs and the exact moment when paused", () => {
    const run = usePlaybackClock({ length: () => 10 });
    run.play(1.234);
    expect(run.tenths.value).toBe(1.2);

    run.pause();
    run.seek(1.234);
    expect(run.tenths.value).toBe(1.234);
  });

  it("goes back to before the run when stopped", () => {
    const run = usePlaybackClock({ length: () => 10 });
    run.play();
    vi.advanceTimersByTime(300);
    run.stop();
    vi.advanceTimersByTime(300);

    expect(run.running.value).toBe(false);
    expect(run.position.value).toBeNull();
    expect(run.tenths.value).toBeNull();
  });
});
