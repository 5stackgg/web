// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  busiestServer,
  playWays,
  scrimTeamsToday,
} from "~/utilities/playMoreWays";

describe("playWays", () => {
  it("features a public server people are on, ahead of everything", () => {
    expect(
      playWays({ serverPlayers: 7, scrimsToday: 2, practice: true }),
    ).toEqual({ featured: "server", others: ["scrims", "practice"] });
  });

  it("features scrims next when teams are looking today", () => {
    expect(
      playWays({ serverPlayers: 0, scrimsToday: 2, practice: true }),
    ).toEqual({ featured: "scrims", others: ["server", "practice"] });
  });

  it("features practice when nobody is playing or looking", () => {
    expect(
      playWays({ serverPlayers: 0, scrimsToday: 0, practice: true }),
    ).toEqual({ featured: "practice", others: ["scrims", "server"] });
  });

  it("falls back to the first way on offer without practice", () => {
    expect(
      playWays({ serverPlayers: 0, scrimsToday: 0, practice: false }),
    ).toEqual({ featured: "scrims", others: ["server"] });
    expect(
      playWays({ serverPlayers: 0, scrimsToday: null, practice: false }),
    ).toEqual({ featured: "server", others: [] });
  });

  it("offers nothing when no way is on", () => {
    expect(
      playWays({ serverPlayers: null, scrimsToday: null, practice: false }),
    ).toEqual({ featured: null, others: [] });
  });
});

describe("busiestServer", () => {
  const servers = (players: number[]) =>
    players.map((count, index) => ({ id: `s${index}`, players: count }));

  it("returns nothing when there are no servers", () => {
    expect(busiestServer(servers([]))).toBeNull();
  });

  it("picks the busiest, ties keeping their order", () => {
    expect(busiestServer(servers([3, 9, 3, 0, 12, 12]))?.id).toBe("s4");
    expect(busiestServer(servers([0, 0]))?.id).toBe("s0");
  });
});

describe("scrimTeamsToday", () => {
  // Friday Oct 2 2026, evening.
  const now = new Date(2026, 9, 2, 20, 40);
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 9, day, hour, minute).toISOString();

  it("finds one-off windows today and weekly windows on today's weekday", () => {
    const postings = [
      {
        team_id: "a",
        team: {
          name: "Team A",
          scrim_availability: [{ starts_at: at(2, 21), ends_at: at(2, 23) }],
        },
      },
      {
        team_id: "b",
        team: {
          name: "Team B",
          avatar_url: "b.png",
          scrim_availability: [
            {
              // A Friday two weeks back, repeating.
              starts_at: new Date(2026, 8, 18, 19).toISOString(),
              ends_at: new Date(2026, 8, 18, 22).toISOString(),
              recurring_weekly: true,
            },
          ],
        },
      },
      {
        team_id: "c",
        team: { scrim_availability: [{ starts_at: at(3, 19) }] },
      },
    ];

    const teams = scrimTeamsToday(postings, [], now);
    expect(teams.map((team) => team.id)).toEqual(["b", "a"]);
    expect(teams[0]).toMatchObject({ name: "Team B", avatarUrl: "b.png" });
    expect(teams[0].from.getHours()).toBe(19);
    expect(teams[0].to?.getHours()).toBe(22);
  });

  it("lists a team once, from its first start to its last end, and leaves out the viewer's own", () => {
    const postings = [
      {
        team_id: "a",
        team: {
          name: "Team A",
          scrim_availability: [
            { starts_at: at(2, 21), ends_at: at(2, 23) },
            { starts_at: at(2, 18, 30), ends_at: at(2, 20) },
          ],
        },
      },
      {
        team_id: "mine",
        team: { scrim_availability: [{ starts_at: at(2, 18) }] },
      },
    ];

    const teams = scrimTeamsToday(postings, ["mine"], now);
    expect(teams).toHaveLength(1);
    expect(teams[0].from.getHours()).toBe(18);
    expect(teams[0].from.getMinutes()).toBe(30);
    expect(teams[0].to?.getHours()).toBe(23);
  });
});
