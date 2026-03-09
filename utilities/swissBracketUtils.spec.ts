import {
  parseGroupToRecord,
  getBorderColor,
  getBackgroundColor,
} from "./swissBracketUtils";

describe("parseGroupToRecord", () => {
  it("returns 0-0 for null", () => {
    expect(parseGroupToRecord(null)).toEqual({
      wins: 0,
      losses: 0,
      recordKey: "0-0",
    });
  });

  it("returns 0-0 for undefined", () => {
    expect(parseGroupToRecord(undefined)).toEqual({
      wins: 0,
      losses: 0,
      recordKey: "0-0",
    });
  });

  it("returns 0-0 for 0", () => {
    expect(parseGroupToRecord(0)).toEqual({
      wins: 0,
      losses: 0,
      recordKey: "0-0",
    });
  });

  it.each([
    [1, 0, 1, "0-1"],
    [2, 0, 2, "0-2"],
    [3, 0, 3, "0-3"],
  ])(
    "decodes %d as %d-%d (%s)",
    (group, expectedWins, expectedLosses, expectedKey) => {
      expect(parseGroupToRecord(group)).toEqual({
        wins: expectedWins,
        losses: expectedLosses,
        recordKey: expectedKey,
      });
    },
  );

  it.each([
    [100, 1, 0, "1-0"],
    [101, 1, 1, "1-1"],
    [102, 1, 2, "1-2"],
    [200, 2, 0, "2-0"],
    [201, 2, 1, "2-1"],
    [202, 2, 2, "2-2"],
    [300, 3, 0, "3-0"],
  ])(
    "decodes %d as %d-%d (%s)",
    (group, expectedWins, expectedLosses, expectedKey) => {
      expect(parseGroupToRecord(group)).toEqual({
        wins: expectedWins,
        losses: expectedLosses,
        recordKey: expectedKey,
      });
    },
  );

  it("parses numeric string '101' as 1-1", () => {
    expect(parseGroupToRecord("101")).toEqual({
      wins: 1,
      losses: 1,
      recordKey: "1-1",
    });
  });

  it("parses string '2-1' as numeric 2 (parseFloat strips after dash)", () => {
    // parseFloat("2-1") === 2, so treated as numeric 2 → 0-2
    expect(parseGroupToRecord("2-1")).toEqual({
      wins: 0,
      losses: 2,
      recordKey: "0-2",
    });
  });

  it("returns 0-0 for unrecognized input", () => {
    expect(parseGroupToRecord({})).toEqual({
      wins: 0,
      losses: 0,
      recordKey: "0-0",
    });
  });
});

describe("getBorderColor", () => {
  it("returns green-500 for 3+ wins", () => {
    expect(getBorderColor(3, 1)).toBe("border-green-500");
  });

  it("returns red-500 for 3+ losses", () => {
    expect(getBorderColor(1, 3)).toBe("border-red-500");
  });

  it("returns green-400 when wins > losses", () => {
    expect(getBorderColor(2, 1)).toBe("border-green-400");
  });

  it("returns red-400 when losses > wins", () => {
    expect(getBorderColor(1, 2)).toBe("border-red-400");
  });

  it("returns yellow-400 when tied", () => {
    expect(getBorderColor(1, 1)).toBe("border-yellow-400");
  });
});

describe("getBackgroundColor", () => {
  it("returns green-900/20 for 3+ wins", () => {
    expect(getBackgroundColor(3, 0)).toBe("bg-green-900/20");
  });

  it("returns red-900/20 for 3+ losses", () => {
    expect(getBackgroundColor(0, 3)).toBe("bg-red-900/20");
  });

  it("returns green-800/10 when wins > losses", () => {
    expect(getBackgroundColor(2, 1)).toBe("bg-green-800/10");
  });

  it("returns red-800/10 when losses > wins", () => {
    expect(getBackgroundColor(0, 1)).toBe("bg-red-800/10");
  });

  it("returns yellow-800/10 when tied", () => {
    expect(getBackgroundColor(1, 1)).toBe("bg-yellow-800/10");
  });
});
