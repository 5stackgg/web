// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DAY,
  HOUR,
  MINUTE,
  alertLabel,
  alertState,
  barsOf,
  chipMatches,
  defaultRange,
  endOf,
  inWindow,
  reuseEnd,
  showingSummary,
  sortAlerts,
  startOf,
  ticksOf,
  windowOf,
  type TimelineAlert,
} from "~/utilities/alertTimeline";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const at = (offset: number) => new Date(NOW + offset).toISOString();

const alert = (o: Partial<TimelineAlert> = {}): TimelineAlert => ({
  id: "a1",
  type: "info",
  title: null,
  message: "Matchmaking is down",
  is_active: true,
  dismissible: true,
  expires_at: null,
  created_at: at(-2 * DAY),
  updated_at: null,
  ...o,
});

describe("alertState", () => {
  it("is live, expired or off", () => {
    expect(alertState(alert(), NOW)).toBe("live");
    expect(alertState(alert({ expires_at: at(HOUR) }), NOW)).toBe("live");
    expect(alertState(alert({ expires_at: at(-HOUR) }), NOW)).toBe("expired");
    expect(alertState(alert({ is_active: false }), NOW)).toBe("off");
  });
});

describe("startOf / endOf", () => {
  it("starts a showing alert when it last went up", () => {
    const a = alert({ updated_at: at(-3 * HOUR) });
    expect(startOf(a)).toBe(NOW - 3 * HOUR);
    expect(endOf(a)).toBe(Infinity);
  });

  it("falls back to created_at", () => {
    expect(startOf(alert())).toBe(NOW - 2 * DAY);
  });

  it("draws an off alert from created to turned off", () => {
    const a = alert({ is_active: false, updated_at: at(-DAY) });
    expect(startOf(a)).toBe(NOW - 2 * DAY);
    expect(endOf(a)).toBe(NOW - DAY);
  });

  it("ends an off alert at its expiry when that came first", () => {
    const a = alert({
      is_active: false,
      expires_at: at(-36 * HOUR),
      updated_at: at(-DAY),
    });
    expect(endOf(a)).toBe(NOW - 36 * HOUR);
  });
});

describe("reuseEnd", () => {
  it("reuses the last length from now", () => {
    const a = alert({ updated_at: at(-5 * HOUR), expires_at: at(-3 * HOUR) });
    expect(reuseEnd(a, NOW)).toBe(NOW + 2 * HOUR);
  });

  it("keeps no end when there was none", () => {
    expect(reuseEnd(alert({ is_active: false }), NOW)).toBeNull();
  });

  it("rounds to the minute", () => {
    const a = alert({
      updated_at: at(-HOUR),
      expires_at: at(-HOUR + 90 * MINUTE + 20_000),
    });
    expect((reuseEnd(a, NOW)! - NOW) % MINUTE).toBe(0);
  });
});

describe("alertLabel", () => {
  it("uses the title, else the message without link markup", () => {
    expect(alertLabel({ title: "Maintenance", message: "x" })).toBe(
      "Maintenance",
    );
    expect(
      alertLabel({ title: null, message: "See [the post](/news/1) now" }),
    ).toBe("See the post now");
  });
});

describe("defaultRange", () => {
  it("picks the tightest range reaching the oldest alert", () => {
    expect(defaultRange([alert()], NOW)).toBe("week");
    expect(defaultRange([alert({ created_at: at(-14 * DAY) })], NOW)).toBe(
      "month",
    );
    expect(defaultRange([alert({ created_at: at(-92 * DAY) })], NOW)).toBe(
      "quarter",
    );
    expect(defaultRange([], NOW)).toBe("week");
  });
});

describe("ticksOf", () => {
  it("keeps clear of the left edge and the Now line", () => {
    const [t0, t1] = windowOf("week", NOW);
    const ticks = ticksOf("week", t0, t1, NOW);
    expect(ticks.length).toBeGreaterThan(4);
    for (const t of ticks) {
      expect(t).toBeGreaterThan(t0);
      expect(Math.abs(t - NOW)).toBeGreaterThan((t1 - t0) * 0.04);
    }
  });
});

describe("barsOf", () => {
  const win = windowOf("week", NOW);

  it("splits a showing alert at Now", () => {
    const { segments, end } = barsOf(alert({ updated_at: at(-DAY) }), win, NOW);
    expect(segments[0].tone).toBe("past");
    expect(segments[1].tone).toBe("future");
    expect(segments[1].open).toBe(true);
    expect(segments[0].x + segments[0].w).toBeCloseTo(segments[1].x, 5);
    expect(end).toBeNull();
  });

  it("turns the part ahead amber while editing, with an end marker", () => {
    const { segments, end } = barsOf(alert({ expires_at: at(DAY) }), win, NOW, {
      editing: true,
    });
    expect(segments[1].tone).toBe("ghost");
    expect(end).toEqual({ x: expect.any(Number), open: false });
  });

  it("draws an off alert as one grey bar with nothing ahead", () => {
    const { segments } = barsOf(
      alert({ is_active: false, updated_at: at(-DAY) }),
      win,
      NOW,
    );
    expect(segments[0].tone).toBe("off");
    expect(segments[1].w).toBe(0);
  });

  it("draws a draft from Now", () => {
    const { segments, end } = barsOf(
      alert({ expires_at: at(6 * HOUR) }),
      win,
      NOW,
      { draft: true },
    );
    expect(segments[0].w).toBe(0);
    expect(segments[1].tone).toBe("ghost");
    expect(end?.open).toBe(false);
  });
});

describe("sortAlerts / inWindow / showingSummary", () => {
  const live = alert({ id: "live", dismissible: false });
  const off = alert({ id: "off", is_active: false });
  const expired = alert({ id: "expired", expires_at: at(-HOUR) });

  it("orders showing, off, expired", () => {
    expect(sortAlerts([expired, off, live], NOW).map((a) => a.id)).toEqual([
      "live",
      "off",
      "expired",
    ]);
  });

  it("leaves out alerts that ended before the window", () => {
    const old = alert({ expires_at: at(-20 * DAY), created_at: at(-30 * DAY) });
    expect(inWindow(old, windowOf("week", NOW)[0])).toBe(false);
    expect(inWindow(live, windowOf("week", NOW)[0])).toBe(true);
  });

  it("counts showing banners and the ones that can't be closed", () => {
    expect(showingSummary([live, off, expired], NOW)).toEqual({
      showing: 1,
      locked: 1,
    });
  });
});

describe("chipMatches", () => {
  it("matches within five minutes, and no end only to no end", () => {
    expect(chipMatches(HOUR, NOW + HOUR + 2 * MINUTE, NOW)).toBe(true);
    expect(chipMatches(HOUR, NOW + 2 * HOUR, NOW)).toBe(false);
    expect(chipMatches(null, null, NOW)).toBe(true);
    expect(chipMatches(null, NOW, NOW)).toBe(false);
  });
});
