// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  daysUntil,
  eventDay,
  eventPhase,
  eventPhaseWhere,
  formatEventRange,
} from "~/utilities/eventDisplay";
import type { EventPhase } from "~/utilities/eventDisplay";
import { matchesWhere } from "../helpers/fakeHasura";

const NOW = "2026-06-15T12:00:00.000Z";
const HOUR = 3_600_000;

function shift(offsetMs: number) {
  return new Date(Date.parse(NOW) + offsetMs).toISOString();
}

const events = [
  {
    name: "ended yesterday",
    starts_at: shift(-48 * HOUR),
    ends_at: shift(-24 * HOUR),
  },
  { name: "ends this instant", starts_at: shift(-HOUR), ends_at: NOW },
  { name: "running", starts_at: shift(-HOUR), ends_at: shift(HOUR) },
  { name: "open-ended", starts_at: shift(-24 * HOUR), ends_at: null },
  { name: "starts this instant", starts_at: NOW, ends_at: null },
  { name: "starts tomorrow", starts_at: shift(24 * HOUR), ends_at: null },
  {
    name: "scheduled window",
    starts_at: shift(24 * HOUR),
    ends_at: shift(48 * HOUR),
  },
  {
    name: "ends before it starts",
    starts_at: shift(24 * HOUR),
    ends_at: shift(-HOUR),
  },
];

describe("eventPhaseWhere", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each<EventPhase>(["live", "upcoming", "finished"])(
    "selects exactly the events eventPhase calls %s",
    (phase) => {
      const where = eventPhaseWhere(phase, NOW);

      const selected = events
        .filter((e) => matchesWhere(e, where))
        .map((e) => e.name);
      const expected = events
        .filter((e) => eventPhase(e) === phase)
        .map((e) => e.name);

      expect(expected.length).toBeGreaterThan(0);
      expect(selected).toEqual(expected);
    },
  );
});

describe("eventDay", () => {
  it("counts calendar days from the start, capped at the last day", () => {
    const now = new Date(2025, 10, 8, 21, 40);
    const event = {
      starts_at: new Date(2025, 10, 7, 0, 0).toISOString(),
      ends_at: new Date(2025, 10, 10, 12, 0).toISOString(),
    };
    expect(eventDay(event, now)).toEqual({ day: 2, total: 4 });
    expect(eventDay(event, new Date(2025, 10, 12))).toEqual({
      day: 4,
      total: 4,
    });
  });

  it("has no total for an open-ended event and nothing without a start", () => {
    const now = new Date(2025, 10, 9, 1, 0);
    expect(
      eventDay({ starts_at: new Date(2025, 10, 7).toISOString() }, now),
    ).toEqual({ day: 3, total: null });
    expect(eventDay({ starts_at: null }, now)).toBeNull();
  });
});

describe("daysUntil", () => {
  it("counts calendar days, never below zero", () => {
    const now = new Date(2026, 9, 4, 19, 30);
    expect(daysUntil(new Date(2026, 10, 6, 18, 0).toISOString(), now)).toBe(33);
    expect(daysUntil(new Date(2026, 9, 5, 0, 30).toISOString(), now)).toBe(1);
    expect(daysUntil(new Date(2026, 9, 1).toISOString(), now)).toBe(0);
    expect(daysUntil(null, now)).toBeNull();
  });
});

describe("formatEventRange", () => {
  it("writes the shared parts of a range once", () => {
    const range = formatEventRange(
      new Date(2025, 10, 7).toISOString(),
      new Date(2025, 10, 10).toISOString(),
    );
    expect(range).toMatch(/7/);
    expect(range).toMatch(/10/);
    expect(range?.match(/2025/g)).toHaveLength(1);
  });

  it("falls back to whichever date exists", () => {
    expect(formatEventRange(null, null)).toBeNull();
    expect(formatEventRange(new Date(2025, 10, 7).toISOString(), null)).toMatch(
      /2025/,
    );
  });
});
