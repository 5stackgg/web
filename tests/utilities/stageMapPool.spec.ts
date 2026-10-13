import { describe, expect, it } from "vitest";
import {
  stageHighestBestOf,
  stageMapPoolShortfall,
} from "~/utilities/stageMapPool";

const singleElimination = {
  stageType: "SingleElimination",
  maxTeams: 8,
  groups: 1,
  swissNoElimination: false,
  defaultBestOf: "1",
  roundBestOf: {},
};

describe("stageHighestBestOf", () => {
  it("is the default best-of when nothing overrides it", () => {
    expect(
      stageHighestBestOf({ ...singleElimination, defaultBestOf: "3" }),
    ).toBe(3);
  });

  it("counts a per-round override above the default", () => {
    expect(
      stageHighestBestOf({
        ...singleElimination,
        roundBestOf: { "WB:3": "5" },
      }),
    ).toBe(5);
  });

  it("ignores a per-round override for a round this stage no longer has", () => {
    expect(
      stageHighestBestOf({
        ...singleElimination,
        maxTeams: 4,
        roundBestOf: { "WB:3": "5" },
      }),
    ).toBe(1);
  });

  it("counts a double elimination grand final", () => {
    expect(
      stageHighestBestOf({
        ...singleElimination,
        stageType: "DoubleElimination",
        roundBestOf: { GF: "5" },
      }),
    ).toBe(5);
  });

  // Round robin brackets run on path WB, and get_bracket_best_of reads
  // WB:<round> for them -- a league season writes one per week.
  it("counts every round robin round format the api reads", () => {
    const roundRobin = { ...singleElimination, stageType: "RoundRobin" };

    expect(
      stageHighestBestOf({ ...roundRobin, roundBestOf: { "WB:1": "5" } }),
    ).toBe(5);
    expect(
      stageHighestBestOf({ ...roundRobin, roundBestOf: { "WB:14": "3" } }),
    ).toBe(3);
  });

  // The third-place bracket is WB in the final round, so it plays the
  // final's format; nothing in the api reads decider_best_of.
  it("ignores the third-place decider", () => {
    const stage = {
      ...singleElimination,
      thirdPlaceMatch: true,
      deciderBestOf: "5",
    };

    expect(stageHighestBestOf(stage)).toBe(1);
  });

  it("counts only the regular format on a no-elimination swiss", () => {
    const swiss = {
      ...singleElimination,
      stageType: "Swiss",
      swissNoElimination: true,
    };

    expect(
      stageHighestBestOf({
        ...swiss,
        roundBestOf: { advancement: "5", elimination: "5" },
      }),
    ).toBe(1);
    expect(
      stageHighestBestOf({ ...swiss, roundBestOf: { regular: "3" } }),
    ).toBe(3);
    expect(
      stageHighestBestOf({
        ...swiss,
        swissNoElimination: false,
        roundBestOf: { advancement: "5" },
      }),
    ).toBe(5);
  });
});

describe("stageMapPoolShortfall", () => {
  it("needs at least as many maps as the best-of, like the api's veto", () => {
    expect(stageMapPoolShortfall(4, 5)).toEqual({ bestOf: 5, size: 4 });
    expect(stageMapPoolShortfall(5, 5)).toBeNull();
    expect(stageMapPoolShortfall(7, 3)).toBeNull();
  });

  it("rejects an empty pool even for a best of 1", () => {
    expect(stageMapPoolShortfall(0, 1)).toEqual({ bestOf: 1, size: 0 });
  });
});
