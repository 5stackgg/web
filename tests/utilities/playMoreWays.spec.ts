import { describe, expect, it } from "vitest";
import {
  countScrimTeamsToday,
  pickServerTiles,
  waysLayout,
} from "~/utilities/playMoreWays";

describe("waysLayout", () => {
  it("lays a tournament across two thirds when at most one tile joins it", () => {
    expect(waysLayout(true, 0)).toEqual({ kind: "wide" });
    expect(waysLayout(true, 1)).toEqual({ kind: "wide" });
  });

  it("stacks two tiles beside a tournament, then rails them in pairs", () => {
    expect(waysLayout(true, 2)).toEqual({ kind: "feature", railColumns: 1 });
    expect(waysLayout(true, 3)).toEqual({ kind: "feature", railColumns: 2 });
    expect(waysLayout(true, 6)).toEqual({ kind: "feature", railColumns: 2 });
  });

  it("keeps a lone tile at a third and spreads the rest evenly", () => {
    expect(waysLayout(false, 1)).toEqual({ kind: "tiles", columns: 3 });
    expect(waysLayout(false, 2)).toEqual({ kind: "tiles", columns: 2 });
    expect(waysLayout(false, 3)).toEqual({ kind: "tiles", columns: 3 });
    expect(waysLayout(false, 4)).toEqual({ kind: "tiles", columns: 4 });
    expect(waysLayout(false, 5)).toEqual({ kind: "tiles", columns: 3 });
  });
});

describe("pickServerTiles", () => {
  const servers = (players: number[]) =>
    players.map((count, index) => ({ id: `s${index}`, players: count }));

  it("returns nothing when there are no servers", () => {
    expect(pickServerTiles(servers([]))).toEqual([]);
  });

  it("keeps a single server", () => {
    expect(pickServerTiles(servers([4])).map((s) => s.id)).toEqual(["s0"]);
  });

  it("orders three servers busiest first", () => {
    expect(pickServerTiles(servers([2, 8, 5])).map((s) => s.id)).toEqual([
      "s1",
      "s2",
      "s0",
    ]);
  });

  it("caps six servers at the three busiest, ties keeping their order", () => {
    expect(
      pickServerTiles(servers([3, 9, 3, 0, 12, 9])).map((s) => s.id),
    ).toEqual(["s4", "s1", "s5"]);
  });
});

describe("countScrimTeamsToday", () => {
  // Friday Oct 2 2026, evening.
  const now = new Date(2026, 9, 2, 20, 40);

  it("counts one-off windows today and weekly windows on today's weekday", () => {
    const postings = [
      {
        team_id: "a",
        team: {
          scrim_availability: [
            { starts_at: new Date(2026, 9, 2, 21).toISOString() },
          ],
        },
      },
      {
        team_id: "b",
        team: {
          scrim_availability: [
            {
              // A Friday two weeks back, repeating.
              starts_at: new Date(2026, 8, 18, 19).toISOString(),
              recurring_weekly: true,
            },
          ],
        },
      },
      {
        team_id: "c",
        team: {
          scrim_availability: [
            { starts_at: new Date(2026, 9, 3, 19).toISOString() },
          ],
        },
      },
    ];

    expect(countScrimTeamsToday(postings, [], now)).toBe(2);
  });

  it("counts a team once and leaves out the viewer's own teams", () => {
    const today = new Date(2026, 9, 2, 18).toISOString();
    const postings = [
      {
        team_id: "a",
        team: {
          scrim_availability: [{ starts_at: today }, { starts_at: today }],
        },
      },
      { team_id: "mine", team: { scrim_availability: [{ starts_at: today }] } },
    ];

    expect(countScrimTeamsToday(postings, ["mine"], now)).toBe(1);
  });
});
