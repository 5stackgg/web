import { calculateRounds } from "./tournamentRoundCalculator";

describe("calculateRounds", () => {
  describe("Single Elimination", () => {
    it("calculates 2 rounds for 4 teams", () => {
      const rounds = calculateRounds("SingleElimination", 4);
      expect(rounds).toHaveLength(2);
    });

    it("calculates 3 rounds for 8 teams", () => {
      const rounds = calculateRounds("SingleElimination", 8);
      expect(rounds).toHaveLength(3);
    });

    it("calculates 4 rounds for 16 teams", () => {
      const rounds = calculateRounds("SingleElimination", 16);
      expect(rounds).toHaveLength(4);
    });

    it("all rounds have WB path", () => {
      const rounds = calculateRounds("SingleElimination", 8);
      expect(rounds.every((r) => r.path === "WB")).toBe(true);
    });

    it("rounds are numbered sequentially", () => {
      const rounds = calculateRounds("SingleElimination", 8);
      expect(rounds.map((r) => r.round)).toEqual([1, 2, 3]);
    });
  });

  describe("Double Elimination", () => {
    it("has more rounds than single elimination", () => {
      const se = calculateRounds("SingleElimination", 8);
      const de = calculateRounds("DoubleElimination", 8);
      expect(de.length).toBeGreaterThan(se.length);
    });

    it("includes WB, LB, and GF rounds for 8 teams", () => {
      const rounds = calculateRounds("DoubleElimination", 8);
      const paths = rounds.map((r) => r.path);
      expect(paths).toContain("WB");
      // LB rounds exist
      const lbRounds = rounds.filter((r) => r.key.startsWith("LB:"));
      expect(lbRounds.length).toBeGreaterThan(0);
      // Grand final exists
      expect(rounds.some((r) => r.key === "GF")).toBe(true);
    });

    it("calculates correct WB + LB + GF for 4 teams", () => {
      const rounds = calculateRounds("DoubleElimination", 4);
      // 4 teams: 2 WB rounds + 2 LB rounds + 1 GF = 5
      const wbRounds = rounds.filter((r) => r.key.startsWith("WB:"));
      const lbRounds = rounds.filter((r) => r.key.startsWith("LB:"));
      const gf = rounds.filter((r) => r.key === "GF");
      expect(wbRounds).toHaveLength(2);
      expect(lbRounds).toHaveLength(2);
      expect(gf).toHaveLength(1);
    });
  });

  describe("Swiss", () => {
    it("always returns 3 entries", () => {
      const rounds = calculateRounds("Swiss", 8);
      expect(rounds).toHaveLength(3);
    });

    it("returns 3 entries regardless of team count", () => {
      const rounds = calculateRounds("Swiss", 16);
      expect(rounds).toHaveLength(3);
    });

    it("has regular, advancement, and elimination keys", () => {
      const rounds = calculateRounds("Swiss", 8);
      expect(rounds.map((r) => r.key)).toEqual([
        "regular",
        "advancement",
        "elimination",
      ]);
    });
  });

  describe("groups", () => {
    it("divides teams by group count", () => {
      // 16 teams in 4 groups = 4 per group = 2 SE rounds
      const rounds = calculateRounds("SingleElimination", 16, 4);
      expect(rounds).toHaveLength(2);
    });
  });

  describe("unknown type", () => {
    it("returns empty array", () => {
      const rounds = calculateRounds("Unknown", 8);
      expect(rounds).toEqual([]);
    });
  });
});
