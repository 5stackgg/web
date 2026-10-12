// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  TRADE_WINDOW_SEC,
  findTrades,
  tradeCounts,
  tradeStateAt,
  type TradeKill,
} from "~/utilities/replayAnalysis/trades";

const RATE = 64;
const kill = (
  tick: number,
  killer: string,
  victim: string,
  killerTeam = killer.startsWith("t") ? "t" : "ct",
  victimTeam = victim.startsWith("t") ? "t" : "ct",
): TradeKill => ({
  tick,
  killer,
  victim,
  killer_team: killerTeam,
  victim_team: victimTeam,
});

describe("findTrades", () => {
  it("pairs a death with the teammate's revenge inside the window", () => {
    const kills = [kill(1000, "t1", "ct1"), kill(1000 + 2 * RATE, "ct2", "t1")];
    const trades = findTrades(kills, RATE);
    expect(trades[0]).toEqual({ tradedBy: 1, avenges: [] });
    expect(trades[1]).toEqual({ tradedBy: null, avenges: [0] });
  });

  it("leaves a death untraded once the window has passed", () => {
    const late = 1000 + (TRADE_WINDOW_SEC + 1) * RATE;
    const kills = [kill(1000, "t1", "ct1"), kill(late, "ct2", "t1")];
    expect(findTrades(kills, RATE)[0].tradedBy).toBeNull();
  });

  it("needs the killer to die, at the hands of the victim's side", () => {
    const kills = [
      kill(1000, "t1", "ct1"),
      kill(1064, "ct2", "t2"),
      kill(1100, "t3", "t1", "t", "t"),
    ];
    const trades = findTrades(kills, RATE);
    expect(trades[0].tradedBy).toBeNull();
    expect(trades[1].tradedBy).toBeNull();
  });

  it("ignores team kills and suicides as deaths to trade", () => {
    const kills = [
      kill(1000, "ct1", "ct2", "ct", "ct"),
      { tick: 1010, victim: "ct3", victim_team: "ct" },
      kill(1064, "t1", "ct1"),
    ];
    const trades = findTrades(kills, RATE);
    expect(trades[0].tradedBy).toBeNull();
    expect(trades[1].tradedBy).toBeNull();
  });

  it("works on kills that are not sorted by tick", () => {
    const kills = [kill(1200, "ct2", "t1"), kill(1000, "t1", "ct1")];
    const trades = findTrades(kills, RATE);
    expect(trades[1].tradedBy).toBe(0);
    expect(trades[0].avenges).toEqual([1]);
  });

  it("reads Terrorist as the T side", () => {
    const kills = [
      kill(1000, "t1", "ct1", "TERRORIST", "CT"),
      kill(1100, "ct2", "t1", "CT", "TERRORIST"),
    ];
    expect(findTrades(kills, RATE)[0].tradedBy).toBe(1);
  });
});

describe("tradeStateAt", () => {
  const kills = [
    kill(1000, "t1", "ct1"),
    kill(1128, "ct2", "t1"),
    kill(2000, "ct2", "t2"),
  ];
  const trades = findTrades(kills, RATE);

  it("shows a trade only once it has happened", () => {
    expect(tradeStateAt(kills, trades, 0, 1100, RATE)).toBe("open");
    expect(tradeStateAt(kills, trades, 0, 1128, RATE)).toBe("traded");
  });

  it("calls a death untraded after the window", () => {
    const end = 2000 + TRADE_WINDOW_SEC * RATE;
    expect(tradeStateAt(kills, trades, 2, end, RATE)).toBe("open");
    expect(tradeStateAt(kills, trades, 2, end + 1, RATE)).toBe("untraded");
  });

  it("calls an open death untraded once the round is over", () => {
    expect(tradeStateAt(kills, trades, 2, 2100, RATE, 2100)).toBe("untraded");
    expect(tradeStateAt(kills, trades, 2, 2050, RATE, 2100)).toBe("open");
  });

  it("has nothing to say about a team kill", () => {
    const tk = [kill(1000, "ct1", "ct2", "ct", "ct")];
    expect(tradeStateAt(tk, findTrades(tk, RATE), 0, 9999, RATE)).toBe("none");
  });
});

describe("tradeCounts", () => {
  it("counts each side's deaths and traded deaths up to the cursor", () => {
    const kills = [
      kill(1000, "t1", "ct1"),
      kill(1128, "ct2", "t1"),
      kill(1500, "t2", "ct2"),
      kill(5000, "t2", "ct3"),
    ];
    const trades = findTrades(kills, RATE);
    expect(tradeCounts(kills, trades, 1600)).toEqual({
      ct: { deaths: 2, traded: 1 },
      t: { deaths: 1, traded: 0 },
    });
    expect(tradeCounts(kills, trades, 1100).ct).toEqual({
      deaths: 1,
      traded: 0,
    });
  });
});
