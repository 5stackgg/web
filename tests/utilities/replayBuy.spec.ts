// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatMoneyShort,
  halfStartRounds,
  loadoutValue,
  roundBuyType,
  startMoney,
  teamValuesByRound,
  weaponPrice,
} from "~/utilities/replayAnalysis/buy";

describe("weaponPrice", () => {
  it("reads internal and display names", () => {
    expect(weaponPrice("AK-47")).toBe(2700);
    expect(weaponPrice("M4A4")).toBe(3100);
    expect(weaponPrice("m4a1")).toBe(3100);
    expect(weaponPrice("m4a1_silencer")).toBe(2900);
    expect(weaponPrice("Glock-18")).toBe(200);
    expect(weaponPrice("Desert Eagle")).toBe(700);
    expect(weaponPrice("weapon_awp")).toBe(4750);
    expect(weaponPrice(null)).toBe(0);
    expect(weaponPrice("Something new")).toBe(0);
  });
});

describe("loadoutValue", () => {
  it("adds guns, armour, kit and utility", () => {
    expect(
      loadoutValue({
        team: "ct",
        primary: "M4A4",
        secondary: "USP-S",
        armor: 100,
        helmet: true,
        kit: true,
        flash: 2,
        smoke: 1,
        he: 1,
        molotov: 1,
      }),
    ).toBe(3100 + 200 + 1000 + 400 + 400 + 300 + 300 + 500);
  });

  it("prices a T molotov below a CT incendiary, and kevlar alone at 650", () => {
    expect(loadoutValue({ team: "t", molotov: 1 })).toBe(400);
    expect(loadoutValue({ team: "ct", molotov: 1 })).toBe(500);
    expect(loadoutValue({ armor: 80, helmet: false })).toBe(650);
  });
});

describe("roundBuyType", () => {
  it("uses the app's eco / force / full thresholds", () => {
    expect(roundBuyType(1000, false)).toBe("eco");
    expect(roundBuyType(12000, false)).toBe("force");
    expect(roundBuyType(24000, false)).toBe("full");
  });

  it("calls an eco at the start of a half the pistol round", () => {
    expect(roundBuyType(4200, true)).toBe("pistol");
    expect(roundBuyType(50000, true)).toBe("full");
  });
});

describe("halfStartRounds", () => {
  it("finds the first round and every side swap", () => {
    const side = (a: "ct" | "t") =>
      new Map<string, "ct" | "t">([
        ["p1", a],
        ["p2", a === "ct" ? "t" : "ct"],
      ]);
    const rounds = new Map([
      [1, side("ct")],
      [2, side("ct")],
      [13, side("t")],
      [14, side("t")],
    ]);
    expect([...halfStartRounds(rounds)]).toEqual([1, 13]);
  });
});

describe("startMoney", () => {
  const economy = [
    {
      round: 1,
      lineup_1_money: 18650,
      lineup_2_money: "10650",
      lineup_1_side: "TERRORIST",
      lineup_2_side: "CT",
    },
    {
      round: 2,
      lineup_1_money: 20650,
      lineup_2_money: 23250,
      lineup_1_side: "TERRORIST",
      lineup_2_side: "CT",
    },
    {
      round: 3,
      lineup_1_money: 1,
      lineup_2_money: 2,
      lineup_1_side: "CT",
      lineup_2_side: "TERRORIST",
    },
  ];

  it("takes the money a lineup ended the previous round with", () => {
    expect(startMoney(economy, 2, "ct")).toBe(10650);
    expect(startMoney(economy, 2, "t")).toBe(18650);
  });

  it("has no figure for the first round or across a side swap", () => {
    expect(startMoney(economy, 1, "ct")).toBeNull();
    expect(startMoney(economy, 3, "ct")).toBeNull();
  });

  it("resets on each overtime half, where the sides do not swap", () => {
    // MR12: lineup 1 is T for 1-12 and CT for 13-24. Overtime halves are
    // 3 rounds: CT 25-27, T 28-30, T 31-33 (no swap at 24->25 or 30->31).
    const lineup1Ct = (round: number) => {
      if (round <= 12) return false;
      if (round <= 24) return true;
      return Math.floor((Math.floor((round - 25) / 3) + 1) / 2) % 2 === 0;
    };
    const mr12 = Array.from({ length: 33 }, (_, i) => {
      const round = i + 1;
      const ct = lineup1Ct(round);
      return {
        round,
        lineup_1_money: 1000 * round,
        lineup_2_money: 500 * round,
        lineup_1_side: ct ? "CT" : "TERRORIST",
        lineup_2_side: ct ? "TERRORIST" : "CT",
      };
    });
    expect(startMoney(mr12, 24, "t")).toBe(11500);
    // Same sides as round 24, but the money resets.
    expect(startMoney(mr12, 25, "ct")).toBeNull();
    expect(startMoney(mr12, 26, "ct")).toBe(25000);
    expect(startMoney(mr12, 28, "t")).toBeNull();
    // Same sides as round 30, but a new overtime.
    expect(startMoney(mr12, 31, "t")).toBeNull();
    expect(startMoney(mr12, 32, "t")).toBe(31000);
  });
});

describe("money formatting", () => {
  it("writes full and short dollar amounts", () => {
    expect(formatMoney(24150)).toBe("$24,150");
    expect(formatMoneyShort(650)).toBe("$650");
    expect(formatMoneyShort(4750)).toBe("$4.8k");
    expect(formatMoneyShort(26400)).toBe("$26.4k");
  });
});

describe("teamValuesByRound", () => {
  it("sums each side's loadouts per round", () => {
    const values = teamValuesByRound([
      { round: 2, team: "ct", secondary: "usp_silencer" },
      { round: 2, team: "ct", secondary: "hkp2000", armor: 100 },
      { round: 2, team: "t", primary: "ak47", armor: 100, helmet: true },
      { round: 3, team: "TERRORIST", primary: "ak47" },
    ]);
    expect(values.get(2)).toEqual({ ct: 200 + 200 + 650, t: 2700 + 1000 });
    expect(values.has(3)).toBe(false);
  });
});
