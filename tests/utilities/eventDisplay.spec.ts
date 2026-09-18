// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventPhase, eventPhaseWhere } from "~/utilities/eventDisplay";
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
