import { describe, expect, it } from "vitest";
import {
  seasonAt,
  seasonBefore,
  seasonRecap,
  seasonPace,
  withSeasonBreaks,
  type Season,
  type SeasonEloEntry,
} from "~/utilities/seasonPace";

const s1: Season = {
  id: "s1",
  number: 1,
  starts_at: "2024-10-01T00:00:00Z",
  ends_at: "2026-09-30T00:00:00Z",
};
const s2: Season = {
  id: "s2",
  number: 2,
  starts_at: "2026-09-30T00:00:00Z",
  ends_at: null,
};
const seasons = [s2, s1];

function ladder(
  seasonId: string,
  type: string,
  start: number,
  ratings: number[],
  day: string,
): SeasonEloEntry[] {
  return ratings.map((updated, i) => {
    const before = i === 0 ? start : ratings[i - 1];
    return {
      season_id: seasonId,
      type,
      current_elo: before,
      updated_elo: updated,
      match_created_at: `${day}T${String(i).padStart(2, "0")}:00:00Z`,
      match_id: `${seasonId}-${type}-${i}`,
      match_result: updated > before ? "win" : "loss",
    };
  });
}

const history = [
  ...ladder("s1", "Competitive", 5000, [4876, 4769, 5037, 6520, 6078], "2025-11-09"),
  ...ladder("s1", "Duel", 5000, [5270], "2026-07-27"),
  ...ladder("s2", "Competitive", 5000, [4887, 4777, 5040], "2026-10-02"),
];

describe("seasonAt", () => {
  it("finds the season whose range holds the timestamp", () => {
    expect(seasonAt(seasons, "2026-09-29T23:59:00Z")?.id).toBe("s1");
    expect(seasonAt(seasons, "2026-09-30T00:00:00Z")?.id).toBe("s2");
    expect(seasonAt(seasons, "2024-01-01T00:00:00Z")).toBeNull();
  });
});

describe("seasonBefore", () => {
  it("returns the latest season that started earlier", () => {
    expect(seasonBefore(seasons, s2)?.id).toBe("s1");
    expect(seasonBefore(seasons, s1)).toBeNull();
  });
});

describe("seasonPace", () => {
  it("compares against the previous season after the same number of matches", () => {
    const pace = seasonPace(history, s2, s1)!;
    expect(pace.type).toBe("Competitive");
    expect(pace.played).toBe(3);
    expect(pace.against).toBe(5037);
    expect(pace.delta).toBe(3);
    expect(pace.previous.peak).toBe(6520);
    expect(pace.previous.peakIndex).toBe(4);
    expect(pace.current?.ratings).toEqual([5000, 4887, 4777, 5040]);
  });

  it("falls back to the previous final once this season has run longer", () => {
    const long = [
      ...history,
      ...ladder("s2", "Competitive", 5040, [5100, 5200, 5300], "2026-10-03"),
    ];
    const pace = seasonPace(long, s2, s1)!;
    expect(pace.pastPrevious).toBe(true);
    expect(pace.against).toBe(6078);
  });

  it("still shows the previous season before this one has a match", () => {
    const pace = seasonPace(
      history.filter((e) => e.season_id === "s1"),
      s2,
      s1,
    )!;
    expect(pace.current).toBeNull();
    expect(pace.delta).toBeNull();
  });

  it("needs the previous season on the same ladder", () => {
    const duelOnly = history.filter((e) => e.type === "Duel");
    expect(seasonPace(duelOnly, s2, s1)?.type).toBe("Duel");
    expect(seasonPace(history.filter((e) => e.season_id === "s2"), s2, s1)).toBeNull();
  });
});

describe("seasonRecap", () => {
  it("reads the lead ladder and counts the record across ladders", () => {
    expect(seasonRecap(history, "s1")).toEqual({
      start: 5000,
      final: 6078,
      peak: 6520,
      peakMatchId: "s1-Competitive-3",
      wins: 3,
      losses: 3,
    });
    expect(seasonRecap(history, "s3")).toBeNull();
  });
});

describe("withSeasonBreaks", () => {
  const at = (m: { at: string }) => m.at;

  it("puts one break between matches from different seasons", () => {
    const rows = withSeasonBreaks(
      [
        { at: "2026-10-02T04:00:00Z" },
        { at: "2026-10-01T04:00:00Z" },
        { at: "2026-07-27T16:00:00Z" },
        { at: "2026-05-30T05:00:00Z" },
      ],
      seasons,
      at,
    );
    expect(rows.map((r) => r.kind)).toEqual([
      "match",
      "match",
      "season",
      "match",
      "match",
    ]);
    const brk = rows[2] as Extract<(typeof rows)[number], { kind: "season" }>;
    expect(brk.began?.id).toBe("s2");
    expect(brk.ended?.id).toBe("s1");
  });

  it("marks a season edge next to matches outside every season", () => {
    const rows = withSeasonBreaks(
      [{ at: "2024-11-01T00:00:00Z" }, { at: "2024-09-01T00:00:00Z" }],
      seasons,
      at,
    );
    const brk = rows[1] as Extract<(typeof rows)[number], { kind: "season" }>;
    expect(brk.began?.id).toBe("s1");
    expect(brk.ended).toBeNull();
  });

  it("adds nothing without seasons", () => {
    const rows = withSeasonBreaks([{ at: "2026-10-02T04:00:00Z" }, { at: "2025-01-01T00:00:00Z" }], [], at);
    expect(rows.every((r) => r.kind === "match")).toBe(true);
  });
});
