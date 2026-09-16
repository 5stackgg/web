import { describe, expect, it } from "vitest";
import {
  advancingTeams,
  groupsSplitNextStage,
  stageTeamLimits,
  teamCountOptions,
} from "~/utilities/tournamentStageTeams";

const roundRobin = (max_teams: number) => ({
  type: "RoundRobin",
  max_teams,
});

describe("stageTeamLimits", () => {
  it("round robin needs three teams per group, at any stage", () => {
    expect(
      stageTeamLimits({ type: "RoundRobin", order: 1, groups: 4 }).min,
    ).toBe(12);
    expect(
      stageTeamLimits({ type: "RoundRobin", order: 2, groups: 1 }).min,
    ).toBe(3);
  });

  it("round robin isn't capped at 32 teams", () => {
    expect(
      stageTeamLimits({ type: "RoundRobin", order: 1, groups: 8 }).max,
    ).toBeGreaterThan(32);
  });

  it("a first elimination stage still needs four teams per group", () => {
    expect(
      stageTeamLimits({ type: "SingleElimination", order: 1, groups: 2 }).min,
    ).toBe(8);
    expect(
      stageTeamLimits({ type: "DoubleElimination", order: 1, groups: 1 }).min,
    ).toBe(4);
  });

  it("single elimination after a round robin can be a two-team final", () => {
    expect(
      stageTeamLimits({
        type: "SingleElimination",
        order: 2,
        groups: 1,
        previousStage: roundRobin(8),
      }).min,
    ).toBe(2);
    expect(
      stageTeamLimits({
        type: "SingleElimination",
        order: 2,
        groups: 1,
        previousStage: {
          type: "Swiss",
          max_teams: 16,
          swiss_no_elimination: true,
        },
      }).min,
    ).toBe(2);
  });

  it("a stage after a Valve Swiss takes at most the half that reaches 3 wins", () => {
    expect(
      stageTeamLimits({
        type: "SingleElimination",
        order: 2,
        groups: 1,
        previousStage: { type: "Swiss", max_teams: 16 },
      }).max,
    ).toBe(8);
  });

  it("a Valve Swiss must hold twice the teams the next stage takes", () => {
    expect(
      stageTeamLimits({
        type: "Swiss",
        order: 1,
        groups: 1,
        nextStage: { type: "SingleElimination", max_teams: 8 },
      }).maxTeamsFloor,
    ).toBe(16);
    expect(
      stageTeamLimits({
        type: "Swiss",
        order: 1,
        groups: 1,
        swissNoElimination: true,
        nextStage: { type: "SingleElimination", max_teams: 8 },
      }).maxTeamsFloor,
    ).toBe(8);
  });

  it("single elimination after a Valve Swiss can be a two-team final too", () => {
    expect(
      stageTeamLimits({
        type: "SingleElimination",
        order: 2,
        groups: 1,
        previousStage: { type: "Swiss", max_teams: 16 },
      }).min,
    ).toBe(2);
    expect(
      stageTeamLimits({
        type: "SingleElimination",
        order: 2,
        groups: 1,
        previousStage: { type: "Swiss", min_teams: 32, max_teams: 64 },
      }).min,
    ).toBe(2);
  });

  it("double elimination keeps four teams after a round robin", () => {
    expect(
      stageTeamLimits({
        type: "DoubleElimination",
        order: 2,
        groups: 1,
        previousStage: roundRobin(8),
      }).min,
    ).toBe(4);
  });

  it("a stage after a round robin can't hold more teams than the round robin", () => {
    expect(
      stageTeamLimits({
        type: "DoubleElimination",
        order: 2,
        groups: 1,
        previousStage: roundRobin(20),
      }).max,
    ).toBe(20);
  });

  it("a round robin must hold at least as many teams as the next stage advances", () => {
    const limits = stageTeamLimits({
      type: "RoundRobin",
      order: 1,
      groups: 2,
      nextStage: { type: "SingleElimination", max_teams: 8 },
    });
    expect(limits.min).toBe(6);
    expect(limits.maxTeamsFloor).toBe(8);

    expect(
      stageTeamLimits({
        type: "SingleElimination",
        order: 1,
        groups: 1,
        nextStage: { type: "SingleElimination", max_teams: 8 },
      }).maxTeamsFloor,
    ).toBe(0);
  });
});

describe("stageTeamLimits after an elimination stage", () => {
  const bracketRounds = (...matchesPerRound: number[]) =>
    matchesPerRound.flatMap((matches, index) =>
      Array.from({ length: matches }, () => ({ round: index + 1 })),
    );

  it("must take every team the previous bracket's last round sends on", () => {
    const groupFinals = {
      type: "SingleElimination",
      min_teams: 32,
      max_teams: 32,
      groups: 8,
      brackets: bracketRounds(16, 8),
    };
    expect(
      stageTeamLimits({
        type: "SingleElimination",
        order: 2,
        groups: 1,
        previousStage: groupFinals,
      }).min,
    ).toBe(8);
    expect(
      stageTeamLimits({
        type: "RoundRobin",
        order: 2,
        groups: 1,
        previousStage: groupFinals,
      }).min,
    ).toBe(8);
  });

  it("falls back to half the previous stage's per-group minimum when it has no brackets", () => {
    expect(
      stageTeamLimits({
        type: "DoubleElimination",
        order: 2,
        groups: 1,
        previousStage: {
          type: "SingleElimination",
          min_teams: 16,
          max_teams: 16,
          groups: 1,
          brackets: [],
        },
      }).min,
    ).toBe(8);
  });

  it("still never offers fewer than four", () => {
    expect(
      stageTeamLimits({
        type: "SingleElimination",
        order: 2,
        groups: 1,
        previousStage: {
          type: "SingleElimination",
          min_teams: 8,
          max_teams: 8,
          groups: 1,
          brackets: bracketRounds(4, 2, 1),
        },
      }).min,
    ).toBe(4);
  });
});

describe("groupsSplitNextStage", () => {
  const nextStage = (min_teams: number) => ({
    type: "SingleElimination",
    min_teams,
    max_teams: 16,
  });

  it("needs the next stage's minimum to split evenly across this stage's groups", () => {
    expect(
      groupsSplitNextStage({
        type: "SingleElimination",
        groups: 4,
        minTeams: 16,
        nextStage: nextStage(10),
      }),
    ).toBe(false);
    expect(
      groupsSplitNextStage({
        type: "SingleElimination",
        groups: 4,
        minTeams: 16,
        nextStage: nextStage(12),
      }),
    ).toBe(true);
  });

  it("checks the next stage's minimum after saving halves this stage's into it", () => {
    expect(
      groupsSplitNextStage({
        type: "SingleElimination",
        groups: 4,
        minTeams: 16,
        nextStage: nextStage(6),
      }),
    ).toBe(true);
    expect(
      groupsSplitNextStage({
        type: "DoubleElimination",
        groups: 2,
        minTeams: 9,
        nextStage: nextStage(3),
      }),
    ).toBe(true);
    expect(
      groupsSplitNextStage({
        type: "DoubleElimination",
        groups: 2,
        minTeams: 11,
        nextStage: nextStage(3),
      }),
    ).toBe(true);
    expect(
      groupsSplitNextStage({
        type: "DoubleElimination",
        groups: 4,
        minTeams: 20,
        nextStage: nextStage(3),
      }),
    ).toBe(false);
  });

  it("doesn't apply to round robins, single groups, or a last stage", () => {
    expect(
      groupsSplitNextStage({
        type: "RoundRobin",
        groups: 4,
        minTeams: 16,
        nextStage: nextStage(10),
      }),
    ).toBe(true);
    expect(
      groupsSplitNextStage({
        type: "SingleElimination",
        groups: 1,
        minTeams: 16,
        nextStage: nextStage(7),
      }),
    ).toBe(true);
    expect(
      groupsSplitNextStage({
        type: "SingleElimination",
        groups: 4,
        minTeams: 16,
        nextStage: null,
      }),
    ).toBe(true);
  });
});

describe("advancingTeams", () => {
  it("is the whole field for ranked stages, half for a Valve Swiss, and unbounded for elimination", () => {
    expect(advancingTeams(roundRobin(12))).toBe(12);
    expect(
      advancingTeams({
        type: "Swiss",
        max_teams: 16,
        swiss_no_elimination: true,
      }),
    ).toBe(16);
    expect(advancingTeams({ type: "Swiss", max_teams: 32 })).toBe(16);
    expect(
      advancingTeams({ type: "SingleElimination", max_teams: 16 }),
    ).toBeNull();
    expect(advancingTeams(null)).toBeNull();
  });
});

describe("teamCountOptions", () => {
  it("lists every count between the limits in ascending order", () => {
    expect(teamCountOptions({ min: 2, max: 5, step: 1 })).toEqual([2, 3, 4, 5]);
  });

  it("keeps Swiss counts even", () => {
    expect(teamCountOptions({ min: 10, max: 16, step: 2 }, 11)).toEqual([
      12, 14, 16,
    ]);
  });
});
