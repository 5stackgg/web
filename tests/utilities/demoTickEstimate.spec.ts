import { describe, expect, it } from "vitest";
import {
  estimateDemoTick,
  formatClock,
  roundIndexAt,
  SEEK_FREEZE_CEILING_MS,
  type DemoTickAnchors,
} from "~/utilities/demoTickEstimate";

const anchors = (
  overrides: Partial<DemoTickAnchors> = {},
): DemoTickAnchors => ({
  lastTickAtSync: 1_000,
  lastSyncRealMs: 10_000,
  rate: 1,
  tickRate: 64,
  paused: false,
  seeking: false,
  seekingSinceMs: 0,
  ...overrides,
});

describe("estimateDemoTick", () => {
  it("advances at rate × tickRate from the last sync", () => {
    expect(estimateDemoTick(anchors(), 11_000)).toBe(1_064);
    expect(estimateDemoTick(anchors({ rate: 2 }), 11_000)).toBe(1_128);
    expect(estimateDemoTick(anchors({ rate: 0.5 }), 11_000)).toBe(1_032);
  });

  it("holds while paused", () => {
    expect(estimateDemoTick(anchors({ paused: true }), 60_000)).toBe(1_000);
  });

  it("parks on the seek target until cs2 confirms, up to the ceiling", () => {
    const seeking = anchors({ seeking: true, seekingSinceMs: 10_000 });

    expect(estimateDemoTick(seeking, 15_000)).toBe(1_000);
    expect(
      estimateDemoTick(seeking, 10_000 + SEEK_FREEZE_CEILING_MS + 1_000),
    ).toBeGreaterThan(1_000);
  });

  it("never goes below zero", () => {
    expect(estimateDemoTick(anchors({ lastTickAtSync: 0 }), 9_000)).toBe(0);
  });
});

describe("roundIndexAt", () => {
  const rounds = [
    { start_tick: 0, end_tick: 900 },
    { start_tick: 1_000, end_tick: 1_900 },
    { start_tick: 2_000, end_tick: 2_900 },
  ];

  it("finds the round containing the tick", () => {
    expect(roundIndexAt(rounds, 0)).toBe(0);
    expect(roundIndexAt(rounds, 1_500)).toBe(1);
    expect(roundIndexAt(rounds, 2_900)).toBe(2);
  });

  it("is -1 between rounds and past the end", () => {
    expect(roundIndexAt(rounds, 950)).toBe(-1);
    expect(roundIndexAt(rounds, 3_000)).toBe(-1);
    expect(roundIndexAt([], 10)).toBe(-1);
  });
});

describe("formatClock", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65.9)).toBe("1:05");
    expect(formatClock(3_599)).toBe("59:59");
  });

  it("falls back to 0:00 for nonsense", () => {
    expect(formatClock(-1)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});
