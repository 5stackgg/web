import { describe, expect, it } from "vitest";
import {
  matchSideWins,
  normalizeSide,
  oppositeSide,
  sideForRoundNumber,
} from "~/utilities/matchSideWins";

describe("normalizeSide", () => {
  it("treats T as TERRORIST", () => {
    expect(normalizeSide("T")).toBe("TERRORIST");
    expect(normalizeSide("TERRORIST")).toBe("TERRORIST");
    expect(normalizeSide("CT")).toBe("CT");
    expect(normalizeSide(null)).toBeNull();
  });
});

describe("sideForRoundNumber", () => {
  it("uses the current side for the whole first half", () => {
    expect(sideForRoundNumber(4, "TERRORIST", 8, 12)).toBe("TERRORIST");
  });

  it("flips first-half sides once the map is past MR", () => {
    expect(sideForRoundNumber(4, "CT", 16, 12)).toBe("TERRORIST");
    expect(sideForRoundNumber(14, "CT", 16, 12)).toBe("CT");
  });

  it("swaps every three overtime rounds", () => {
    expect(sideForRoundNumber(25, "CT", 26, 12)).toBe("CT");
    expect(sideForRoundNumber(28, "CT", 28, 12)).toBe("TERRORIST");
  });
});

describe("matchSideWins", () => {
  it("returns zeros when there are no rounds", () => {
    expect(matchSideWins([], true)).toEqual({ ct: 0, t: 0 });
  });

  it("counts from score deltas so a wrong winning_side cannot steal a round", () => {
    const rounds = [
      {
        round: 1,
        lineup_1_score: 1,
        lineup_2_score: 0,
        lineup_1_side: "TERRORIST",
        winning_side: "CT",
      },
      {
        round: 2,
        lineup_1_score: 1,
        lineup_2_score: 1,
        lineup_1_side: "TERRORIST",
        winning_side: "TERRORIST",
      },
    ];
    expect(matchSideWins(rounds, true)).toEqual({ ct: 0, t: 1 });
    expect(matchSideWins(rounds, false)).toEqual({ ct: 1, t: 0 });
  });

  it("accepts T as the terrorist side", () => {
    const rounds = [
      {
        round: 1,
        lineup_1_score: 1,
        lineup_2_score: 0,
        lineup_1_side: "T",
        winning_side: "T",
      },
    ];
    expect(matchSideWins(rounds, true)).toEqual({ ct: 0, t: 1 });
  });

  it("does not depend on the incoming round order", () => {
    const rounds = [
      {
        round: 2,
        lineup_1_score: 2,
        lineup_2_score: 0,
        lineup_1_side: "TERRORIST",
      },
      {
        round: 1,
        lineup_1_score: 1,
        lineup_2_score: 0,
        lineup_1_side: "TERRORIST",
      },
    ];
    expect(matchSideWins(rounds, true)).toEqual({ ct: 0, t: 2 });
  });

  it("infers sides from the current map assignment when rounds omit them", () => {
    const rounds = [
      { round: 1, lineup_1_score: 1, lineup_2_score: 0 },
      { round: 2, lineup_1_score: 2, lineup_2_score: 0 },
      { round: 13, lineup_1_score: 3, lineup_2_score: 0 },
    ];
    expect(
      matchSideWins(rounds, true, { currentSide: "CT", mr: 12 }),
    ).toEqual({ ct: 1, t: 2 });
  });

  it("falls back to winning_side when scores never increment", () => {
    const rounds = [
      {
        round: 1,
        lineup_1_score: 0,
        lineup_2_score: 0,
        lineup_1_side: "TERRORIST",
        winning_side: "TERRORIST",
      },
      {
        round: 2,
        lineup_1_score: 0,
        lineup_2_score: 0,
        lineup_1_side: "TERRORIST",
        winning_side: "CT",
      },
    ];
    expect(matchSideWins(rounds, true)).toEqual({ ct: 0, t: 1 });
  });
});

describe("oppositeSide", () => {
  it("swaps CT and T", () => {
    expect(oppositeSide("CT")).toBe("TERRORIST");
    expect(oppositeSide("TERRORIST")).toBe("CT");
  });
});
