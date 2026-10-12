// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  classifyBuyType,
  moneyPeriod,
  startMoneyByRound,
  type EconomyRound,
} from "~/utilities/buyType";

// Sides the way the game server assigns them: lineup 1 starts T, swaps at the
// half, and in overtime swaps each half but not between overtimes.
function lineup1Side(round: number, mr: number): string {
  const r0 = round - 1;
  if (r0 < mr) return "TERRORIST";
  if (r0 < mr * 2) return "CT";
  const ot = r0 - mr * 2;
  const block = ot % 6;
  const flip = Math.floor(ot / 6) % 2 === 0 ? block < 3 : block >= 3;
  return flip ? "CT" : "TERRORIST";
}

function rounds(count: number, mr: number): EconomyRound[] {
  return Array.from({ length: count }, (_, i) => {
    const round = i + 1;
    const side = lineup1Side(round, mr);
    return {
      round,
      lineup_1_money: round * 1000,
      lineup_2_money: round * 100,
      lineup_1_side: side,
      lineup_2_side: side === "CT" ? "TERRORIST" : "CT",
    };
  });
}

describe("moneyPeriod", () => {
  it("splits regulation into halves and overtime into three-round halves", () => {
    expect([1, 12, 13, 24].map((r) => moneyPeriod(r, 12))).toEqual([
      0, 0, 1, 1,
    ]);
    expect([25, 27, 28, 30, 31].map((r) => moneyPeriod(r, 12))).toEqual([
      2, 2, 3, 3, 4,
    ]);
  });

  it("never resets in Rush", () => {
    expect(moneyPeriod(9, 8, "Rush")).toBe(0);
    expect(moneyPeriod(15, 8, "Rush")).toBe(0);
  });
});

describe("startMoneyByRound", () => {
  it("starts a round on the money the lineup ended the previous one with", () => {
    const start = startMoneyByRound(rounds(24, 12), 12, "Competitive");
    expect(start.get(2)).toEqual({ lineup_1: 1000, lineup_2: 100 });
    expect(start.get(12)).toEqual({ lineup_1: 11000, lineup_2: 1100 });
    expect(start.get(14)).toEqual({ lineup_1: 13000, lineup_2: 1300 });
  });

  it("opens each regulation half on mp_startmoney for a full side", () => {
    const start = startMoneyByRound(rounds(24, 12), 12, "Competitive");
    expect(start.get(1)).toEqual({ lineup_1: 4000, lineup_2: 4000 });
    expect(start.get(13)).toEqual({ lineup_1: 4000, lineup_2: 4000 });

    const wingman = startMoneyByRound(rounds(16, 8), 8, "Wingman");
    expect(wingman.get(9)).toEqual({ lineup_1: 1600, lineup_2: 1600 });
  });

  it("has no figure for an overtime half, even where sides don't swap", () => {
    const start = startMoneyByRound(rounds(36, 12), 12, "Premier");
    const unknown = { lineup_1: null, lineup_2: null };
    // 24 -> 25 and 30 -> 31 keep both lineups on their side.
    for (const round of [25, 28, 31, 34]) {
      expect(start.get(round)).toEqual(unknown);
    }
    expect(start.get(26)).toEqual({ lineup_1: 25000, lineup_2: 2500 });
    expect(start.get(32)).toEqual({ lineup_1: 31000, lineup_2: 3100 });
  });

  it("carries Rush money across what would be the half", () => {
    const rush = rounds(15, 8).map((r) => ({
      ...r,
      lineup_1_side: "TERRORIST",
      lineup_2_side: "CT",
    }));
    const start = startMoneyByRound(rush, 8, "Rush");
    expect(start.get(1)).toEqual({ lineup_1: 2400, lineup_2: 2400 });
    expect(start.get(9)).toEqual({ lineup_1: 8000, lineup_2: 800 });
  });

  it("has no figure without the previous round or across a side change", () => {
    const list = rounds(6, 12)
      .filter((r) => r.round !== 3)
      .map((r) =>
        r.round >= 5
          ? { ...r, lineup_1_side: "CT", lineup_2_side: "TERRORIST" }
          : r,
      );
    const start = startMoneyByRound(list, 12, "Competitive");
    expect(start.get(4)).toEqual({ lineup_1: null, lineup_2: null });
    expect(start.get(5)).toEqual({ lineup_1: null, lineup_2: null });
    expect(start.get(6)).toEqual({ lineup_1: 5000, lineup_2: 500 });
  });

  it("reads money stored as strings", () => {
    const list = rounds(2, 12);
    list[0] = { ...list[0], lineup_1_money: "18650", lineup_2_money: null };
    expect(startMoneyByRound(list, 12, "Competitive").get(2)).toEqual({
      lineup_1: 18650,
      lineup_2: null,
    });
  });

  it("knows nothing without the match's MR or type", () => {
    const list = rounds(3, 12);
    expect(startMoneyByRound(list, null, "Competitive").get(2)).toEqual({
      lineup_1: null,
      lineup_2: null,
    });
    expect(startMoneyByRound(list, 12, null).get(1)).toEqual({
      lineup_1: null,
      lineup_2: null,
    });
  });
});

describe("classifyBuyType", () => {
  it("cuts eco and full where the api's buy-type views do", () => {
    expect(classifyBuyType(4999)).toBe("eco");
    expect(classifyBuyType(5000)).toBe("force");
    expect(classifyBuyType(20000)).toBe("force");
    expect(classifyBuyType(20001)).toBe("full");
    expect(classifyBuyType(null)).toBe("unknown");
  });
});
