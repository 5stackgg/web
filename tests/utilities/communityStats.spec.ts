import { describe, expect, it } from "vitest";
import {
  activeSanctions,
  dailyActivity,
  ipPeers,
  killDeathRatio,
  niceScale,
} from "~/utilities/communityStats";

describe("activeSanctions", () => {
  it("lists what is in force worst first", () => {
    expect(
      activeSanctions({ is_gagged: true, is_muted: true, is_banned: false }),
    ).toEqual(["mute", "gag"]);
    expect(activeSanctions({ is_gagged: true, is_banned: true })).toEqual([
      "ban",
      "gag",
    ]);
    expect(activeSanctions(null)).toEqual([]);
  });
});

describe("dailyActivity", () => {
  it("regroups UTC hours into the viewer's last seven local days, today last", () => {
    const now = new Date(2026, 9, 1, 15, 30);
    const hour = (month: number, day: number, h: number) =>
      new Date(2026, month, day, h).toISOString();

    const days = dailyActivity(
      [
        { hour: hour(9, 1, 9), seconds: 3600, players: 4 },
        { hour: hour(9, 1, 10), seconds: 1800, players: 6 },
        { hour: hour(8, 30, 23), seconds: 600, players: 2 },
        { hour: hour(8, 20, 12), seconds: 999, players: 9 },
      ],
      now,
    );

    expect(days).toHaveLength(7);
    expect(days[6].today).toBe(true);
    expect(days[6].seconds).toBe(5400);
    expect(days[6].peakPlayers).toBe(6);
    expect(days[5].seconds).toBe(600);
    expect(days.reduce((sum, day) => sum + day.seconds, 0)).toBe(6000);
    expect(days[0].date.getDate()).toBe(25);
  });
});

describe("niceScale", () => {
  it("rounds the axis up to a readable step", () => {
    expect(niceScale(72)).toEqual({ max: 80, ticks: [0, 20, 40, 60, 80] });
    expect(niceScale(0).max).toBe(1);
    expect(niceScale(3.2).ticks.at(-1)).toBeGreaterThanOrEqual(3.2);
  });
});

describe("ipPeers", () => {
  it("names everyone else behind the same IP", () => {
    const rows = [
      { id: "a", ip: "203.0.113.24" },
      { id: "b", ip: "203.0.113.24" },
      { id: "c", ip: "198.51.100.7" },
      { id: "d", ip: null },
    ];

    const peers = ipPeers(
      rows,
      (row) => row.id,
      (row) => row.ip,
    );

    expect(peers.get("a")?.map((row) => row.id)).toEqual(["b"]);
    expect(peers.get("b")?.map((row) => row.id)).toEqual(["a"]);
    expect(peers.get("c")).toEqual([]);
    expect(peers.get("d")).toEqual([]);
  });
});

describe("killDeathRatio", () => {
  it("never divides by zero", () => {
    expect(killDeathRatio(412, 340)).toBe("1.21");
    expect(killDeathRatio(5, 0)).toBe("5.00");
  });
});
