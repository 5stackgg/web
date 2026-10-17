// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  activeSeason,
  formatCountdown,
  mustPlanNext,
  nextSeasonHint,
  openEndedBlocker,
  overlapsSeason,
  pastSeasons,
  previewNumber,
  seasonDay,
  seasonProgress,
  seasonStatus,
  upcomingSeasons,
  type SeasonRow,
} from "~/components/seasons/seasonPhase";

const NOW = Date.UTC(2026, 9, 16, 15, 42, 7);
const s = (
  id: string,
  number: number,
  starts: string,
  ends: string | null,
): SeasonRow => ({ id, number, starts_at: starts, ends_at: ends });

const s5 = s("s5", 5, "2026-07-01T00:00:00Z", "2026-10-01T00:00:00Z");
const s6 = s("s6", 6, "2026-10-01T00:00:00Z", "2027-01-01T00:00:00Z");
const s7 = s("s7", 7, "2027-01-01T00:00:00Z", null);

describe("season status", () => {
  it("splits seasons into active, upcoming and past", () => {
    const all = [s5, s6, s7];
    expect(seasonStatus(s6, NOW)).toBe("active");
    expect(activeSeason(all, NOW)?.id).toBe("s6");
    expect(upcomingSeasons(all, NOW).map((x) => x.id)).toEqual(["s7"]);
    expect(pastSeasons(all, NOW).map((x) => x.id)).toEqual(["s5"]);
  });

  it("treats a season without an end date as running", () => {
    const open = s("o", 1, "2026-01-01T00:00:00Z", null);
    expect(seasonStatus(open, NOW)).toBe("active");
    expect(seasonProgress(open, NOW)).toBeNull();
  });
});

describe("mustPlanNext (does the create form start open)", () => {
  it("opens with no seasons at all", () => {
    expect(mustPlanNext([], NOW)).toBe(true);
  });

  it("stays folded while a season runs", () => {
    expect(mustPlanNext([s5, s6], NOW)).toBe(false);
  });

  it("stays folded in an off-season with one scheduled", () => {
    const later = s("l", 6, "2026-11-01T00:00:00Z", "2027-02-01T00:00:00Z");
    expect(mustPlanNext([s5, later], NOW)).toBe(false);
  });

  it("opens in an off-season with nothing scheduled", () => {
    expect(mustPlanNext([s5], NOW)).toBe(true);
  });
});

describe("nextSeasonHint", () => {
  it("names the scheduled season first", () => {
    expect(nextSeasonHint([s5, s6, s7], NOW)).toEqual({
      kind: "scheduled",
      season: s7,
    });
  });

  it("says when the running season ends and nothing follows", () => {
    expect(nextSeasonHint([s5, s6], NOW)).toEqual({
      kind: "after",
      season: s6,
    });
  });

  it("flags a running season with no end date", () => {
    const open = s("o", 6, "2026-10-01T00:00:00Z", null);
    expect(nextSeasonHint([s5, open], NOW)?.kind).toBe("open_ended");
    expect(openEndedBlocker([s5, open], NOW)?.id).toBe("o");
    expect(openEndedBlocker([s5, s6], NOW)).toBeNull();
  });
});

describe("numbers and ranges", () => {
  it("previews the number a new season takes by its start", () => {
    expect(previewNumber([s5, s6], null)).toBe(3);
    expect(previewNumber([s5, s6], Date.UTC(2026, 8, 1))).toBe(2);
  });

  it("detects overlaps, ignoring the season being edited", () => {
    const start = Date.UTC(2026, 11, 1);
    const end = Date.UTC(2027, 1, 1);
    expect(overlapsSeason([s6], start, end)).toBe(true);
    expect(overlapsSeason([s6], start, end, "s6")).toBe(false);
    expect(overlapsSeason([s6], Date.UTC(2027, 0, 1), end)).toBe(false);
  });

  it("counts the day and the share of the season gone", () => {
    expect(seasonDay(s6, NOW)).toBe(16);
    expect(Math.round(seasonProgress(s6, NOW) as number)).toBe(17);
  });
});

describe("formatCountdown", () => {
  it("pads hours, minutes and seconds and prefixes whole days", () => {
    expect(formatCountdown(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000)).toBe(
      "2d 03:04:05",
    );
    expect(formatCountdown(59_000)).toBe("00:00:59");
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });
});
