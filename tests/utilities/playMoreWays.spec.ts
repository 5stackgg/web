import { describe, expect, it } from "vitest";
import {
  countScrimTeamsToday,
  dropInColumns,
  pickServerTiles,
  wayCardColumns,
} from "~/utilities/playMoreWays";

describe("wayCardColumns", () => {
  it("splits two cards evenly and keeps a lone card at a third", () => {
    expect(wayCardColumns(3)).toBe(3);
    expect(wayCardColumns(2)).toBe(2);
    expect(wayCardColumns(1)).toBe(3);
  });
});

describe("dropInColumns", () => {
  it("keeps a lone tile card-width and spreads the rest evenly", () => {
    expect(dropInColumns(1)).toBe(3);
    expect(dropInColumns(2)).toBe(2);
    expect(dropInColumns(3)).toBe(3);
    expect(dropInColumns(4)).toBe(4);
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
