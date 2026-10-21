// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  covers,
  earliestStart,
  firstStart,
  openIntervals,
  scrimFit,
  sharedRegions,
  startsOn,
  weeklyRanges,
  windowsFromRanges,
  withinRange,
  type ScrimSide,
} from "~/utilities/scrimSchedule";

// Wed Oct 21 2026, 7:40 PM local.
const now = new Date(2026, 9, 21, 19, 40);
const at = (day: number, h: number, m = 0) =>
  new Date(2026, 9, 21 + day, h, m).getTime();
const weekly = (dow: number, from: number, to: number) => ({
  starts_at: new Date(1970, 0, 4 + dow, 0, from).toISOString(),
  ends_at: new Date(1970, 0, 4 + dow, 0, to).toISOString(),
  recurring_weekly: true,
});
const side = (over: Partial<ScrimSide>): ScrimSide => ({
  elo: 5000,
  eloMin: null,
  eloMax: null,
  regions: [],
  mapIds: [],
  intervals: [],
  ...over,
});

describe("openIntervals", () => {
  it("repeats weekly windows on their weekday and drops ended ones", () => {
    expect(openIntervals([weekly(3, 18 * 60, 19 * 60)], now)).toEqual([]);
    const later = openIntervals([weekly(3, 20 * 60, 23 * 60)], now);
    expect(later.map((i) => i.start)).toEqual([at(0, 20)]);
  });

  it("keeps a window that crossed midnight from yesterday while it is open", () => {
    const early = new Date(2026, 9, 21, 0, 20);
    const intervals = openIntervals([weekly(2, 22 * 60, 25 * 60)], early);
    expect(intervals[0]).toEqual({ start: at(-1, 22), end: at(0, 1) });
  });

  it("merges a one-off window into an overlapping weekly one", () => {
    const intervals = openIntervals(
      [
        weekly(3, 20 * 60, 23 * 60),
        {
          starts_at: new Date(at(0, 19, 30)).toISOString(),
          ends_at: new Date(at(0, 21, 30)).toISOString(),
          recurring_weekly: false,
        },
      ],
      now,
    );
    expect(intervals[0]).toEqual({ start: at(0, 19, 30), end: at(0, 23) });
  });
});

describe("starts", () => {
  const theirs = openIntervals([weekly(3, 20 * 60, 23 * 60)], now);

  it("rounds the earliest start up past the lead time", () => {
    expect(earliestStart(now)).toBe(at(0, 20));
  });

  it("lets a series run an hour past the window", () => {
    expect(covers(theirs, at(0, 23), 60)).toBe(true);
    expect(covers(theirs, at(0, 23, 30), 60)).toBe(false);
    expect(covers(theirs, at(0, 21), 180)).toBe(true);
  });

  it("lists half-hour starts that fit the series", () => {
    const starts = startsOn(theirs, new Date(at(0, 0)), 180, now);
    expect(starts).toEqual([at(0, 20), at(0, 20, 30), at(0, 21)]);
  });

  it("prefers the first start both teams cover", () => {
    const mine = openIntervals([weekly(4, 21 * 60, 23 * 60)], now);
    const both = openIntervals([weekly(3, 20 * 60, 23 * 60), weekly(4, 20 * 60, 23 * 60)], now);
    expect(firstStart(both, 60, now, mine)).toBe(at(1, 21));
    expect(firstStart(both, 60, now)).toBe(at(0, 20));
  });
});

describe("scrimFit", () => {
  it("blocks when you are outside their range, then when they are outside yours", () => {
    expect(scrimFit(side({ elo: 5240 }), side({ elo: 7480, eloMin: 6500 }), now).block).toBe("their_range");
    expect(scrimFit(side({ elo: 5240, eloMax: 6500 }), side({ elo: 6950 }), now).block).toBe("our_range");
    expect(scrimFit(side({ elo: 5240 }), side({ elo: 5400 }), now, { booked: true }).block).toBe("booked");
  });

  it("treats a team with no ELO as outside any bounded range", () => {
    expect(withinRange(null, 4000, null)).toBe(false);
    expect(withinRange(null, null, null)).toBe(true);
  });

  it("treats an empty region list as any region", () => {
    expect(sharedRegions([], ["Europe"])).toEqual(["Europe"]);
    expect(sharedRegions(["US East"], ["Europe"])).toEqual([]);
    expect(scrimFit(side({ regions: ["US East"] }), side({ regions: [] }), now).regionShared).toBe(true);
  });

  it("counts every one of your maps when they take any map", () => {
    expect(scrimFit(side({ mapIds: ["a", "b"] }), side({ mapIds: [] }), now).mapsShared).toEqual(["a", "b"]);
    expect(scrimFit(side({ mapIds: ["a", "b"] }), side({ mapIds: ["b", "c"] }), now).mapsShared).toEqual(["b"]);
  });
});

describe("weekly ranges", () => {
  it("round-trips ranges through availability rows", () => {
    const ranges = [[], [[1200, 1410]], [], [], [], [[1260, 1500]], []] as any;
    expect(weeklyRanges(windowsFromRanges(ranges))).toEqual(ranges);
  });

  it("joins a stretch the old grid split at midnight", () => {
    const ranges = weeklyRanges([weekly(5, 21 * 60, 1440), weekly(6, 0, 60)]);
    expect(ranges[5]).toEqual([[1260, 1500]]);
    expect(ranges[6]).toEqual([]);
  });
});
