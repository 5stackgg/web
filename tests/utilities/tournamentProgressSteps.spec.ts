import { describe, expect, it } from "vitest";
import {
  tournamentProgressSteps,
  type ProgressBracket,
  type ProgressStage,
} from "~/utilities/tournamentProgressSteps";

const WIN = { status: "Finished", winning_lineup_id: "lineup-1" };
const LIVE = { status: "Live", winning_lineup_id: null };
const SCHEDULED = { status: "Scheduled", winning_lineup_id: null };

function brackets(
  round: number,
  count: number,
  match: ProgressBracket["match"],
  extra: Partial<ProgressBracket> = {},
): ProgressBracket[] {
  return Array.from({ length: count }, () => ({
    round,
    group: 1,
    path: "WB",
    match,
    ...extra,
  }));
}

function summary(stages: ProgressStage[]) {
  return tournamentProgressSteps(stages).map((step) => ({
    kind: step.kind,
    number: step.number,
    state: step.state,
    live: step.liveCount,
  }));
}

describe("tournamentProgressSteps", () => {
  it("returns nothing for a tournament without stages", () => {
    expect(tournamentProgressSteps([])).toEqual([]);
    expect(tournamentProgressSteps(null)).toEqual([]);
  });

  it("walks a double elimination upper bracket and ignores the lower one", () => {
    const stage: ProgressStage = {
      type: "DoubleElimination",
      order: 1,
      groups: 1,
      brackets: [
        ...brackets(1, 8, WIN),
        ...brackets(2, 4, WIN),
        ...brackets(3, 1, LIVE),
        ...brackets(3, 1, LIVE),
        {
          round: 4,
          group: 1,
          path: "WB",
          match: null,
          scheduled_at: "2026-10-03T19:00:00Z",
        },
        {
          round: 5,
          group: 1,
          path: "WB",
          match: null,
          scheduled_at: "2026-10-04T18:00:00Z",
        },
        // Lower bracket: live, but never part of the upper-path steps.
        ...brackets(1, 4, LIVE, { group: 2, path: "LB" }),
      ],
    };

    expect(summary([stage])).toEqual([
      { kind: "round", number: 1, state: "done", live: 0 },
      { kind: "quarterfinals", number: undefined, state: "done", live: 0 },
      { kind: "semifinals", number: undefined, state: "current", live: 2 },
      { kind: "upper_final", number: undefined, state: "upcoming", live: 0 },
      { kind: "grand_final", number: undefined, state: "upcoming", live: 0 },
    ]);

    const steps = tournamentProgressSteps([stage]);
    expect(steps[3].startsAt).toBe("2026-10-03T19:00:00Z");
    expect(steps[4].startsAt).toBe("2026-10-04T18:00:00Z");
  });

  it("labels a single elimination final and drops bye-only rounds", () => {
    const stage: ProgressStage = {
      type: "SingleElimination",
      order: 1,
      groups: 1,
      brackets: [
        ...brackets(1, 4, null, { bye: true }),
        ...brackets(2, 4, WIN),
        ...brackets(3, 2, SCHEDULED),
        ...brackets(4, 1, null),
      ],
    };

    expect(summary([stage])).toEqual([
      { kind: "quarterfinals", number: undefined, state: "done", live: 0 },
      { kind: "semifinals", number: undefined, state: "current", live: 0 },
      { kind: "final", number: undefined, state: "upcoming", live: 0 },
    ]);
  });

  it("numbers swiss rounds", () => {
    const stage: ProgressStage = {
      type: "Swiss",
      order: 1,
      groups: 1,
      brackets: [
        ...brackets(1, 4, WIN, { group: 0 }),
        ...brackets(2, 2, WIN, { group: 100 }),
        ...brackets(2, 2, WIN, { group: 1 }),
        ...brackets(3, 4, LIVE, { group: 101 }),
      ],
    };

    expect(summary([stage])).toEqual([
      { kind: "round", number: 1, state: "done", live: 0 },
      { kind: "round", number: 2, state: "done", live: 0 },
      { kind: "round", number: 3, state: "current", live: 4 },
    ]);
  });

  it("collapses the other stages of a multi-stage tournament", () => {
    const swiss: ProgressStage = {
      type: "Swiss",
      order: 1,
      groups: 1,
      brackets: [...brackets(1, 4, WIN), ...brackets(2, 4, WIN)],
    };
    const playoffs: ProgressStage = {
      type: "SingleElimination",
      order: 2,
      groups: 1,
      brackets: [
        ...brackets(1, 4, LIVE),
        ...brackets(2, 2, null),
        ...brackets(3, 1, null),
      ],
    };

    expect(summary([playoffs, swiss])).toEqual([
      { kind: "swiss", number: undefined, state: "done", live: 0 },
      { kind: "quarterfinals", number: undefined, state: "current", live: 4 },
      { kind: "semifinals", number: undefined, state: "upcoming", live: 0 },
      { kind: "final", number: undefined, state: "upcoming", live: 0 },
    ]);
  });

  it("keeps a later stage as one upcoming step while an earlier one runs", () => {
    const groups: ProgressStage = {
      type: "RoundRobin",
      order: 1,
      groups: 2,
      brackets: [...brackets(1, 4, WIN), ...brackets(2, 4, LIVE)],
    };
    const playoffs: ProgressStage = {
      type: "SingleElimination",
      order: 2,
      groups: 1,
      brackets: [
        {
          round: 1,
          group: 1,
          path: "WB",
          match: null,
          scheduled_at: "2026-10-05T12:00:00Z",
        },
      ],
    };

    const steps = tournamentProgressSteps([groups, playoffs]);
    expect(steps.map((step) => [step.kind, step.number, step.state])).toEqual([
      ["round", 1, "done"],
      ["round", 2, "current"],
      ["playoffs", undefined, "upcoming"],
    ]);
    expect(steps[2].startsAt).toBe("2026-10-05T12:00:00Z");
  });

  it("marks every step done once the tournament is over", () => {
    const stage: ProgressStage = {
      type: "SingleElimination",
      order: 1,
      groups: 1,
      brackets: [
        ...brackets(1, 2, WIN),
        ...brackets(2, 1, null, { finished: true }),
      ],
    };

    const steps = tournamentProgressSteps([stage]);
    expect(steps.every((step) => step.state === "done")).toBe(true);
    expect(steps.every((step) => step.startsAt === null)).toBe(true);
  });

  it("starts at the first round before anything is played", () => {
    const stage: ProgressStage = {
      type: "SingleElimination",
      order: 1,
      groups: 1,
      brackets: [
        ...brackets(1, 2, null, { scheduled_at: "2026-10-31T19:00:00Z" }),
        ...brackets(2, 1, null),
      ],
    };

    const steps = tournamentProgressSteps([stage]);
    expect(steps.map((step) => step.state)).toEqual(["current", "upcoming"]);
    expect(steps[0]).toMatchObject({
      kind: "round",
      number: 1,
      liveCount: 0,
      startsAt: "2026-10-31T19:00:00Z",
    });
  });

  it("shows a not-yet-generated stage as the current collapsed step", () => {
    const done: ProgressStage = {
      type: "Swiss",
      order: 1,
      groups: 1,
      brackets: brackets(1, 2, WIN),
    };
    const empty: ProgressStage = {
      type: "DoubleElimination",
      order: 2,
      groups: 1,
      brackets: [],
    };

    expect(summary([done, empty])).toEqual([
      { kind: "swiss", number: undefined, state: "done", live: 0 },
      { kind: "playoffs", number: undefined, state: "current", live: 0 },
    ]);
  });
});
