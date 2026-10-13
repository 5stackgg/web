import { describe, expect, it } from "vitest";
import { isTournamentBracketDrawn } from "~/utilities/tournamentBracketDrawn";

type Bracket = {
  team_1?: { id: string } | null;
  team_2?: { id: string } | null;
  match?: { id: string } | null;
};

const emptySlot = (): Bracket => ({ team_1: null, team_2: null, match: null });

const tournament = (status: string, ...stages: Bracket[][]) => ({
  status,
  stages: stages.map((brackets) => ({ brackets })),
});

describe("isTournamentBracketDrawn", () => {
  it("is never drawn in Setup, even with a bracket left from an earlier draw", () => {
    expect(isTournamentBracketDrawn(tournament("Setup"))).toBe(false);
    expect(
      isTournamentBracketDrawn(
        tournament("Setup", [
          { team_1: { id: "team-a" }, team_2: null, match: { id: "match-1" } },
        ]),
      ),
    ).toBe(false);
  });

  it.each(["RegistrationOpen", "CheckInReview"])(
    "is not drawn in %s while every bracket is empty",
    (status) => {
      expect(isTournamentBracketDrawn(tournament(status))).toBe(false);
      expect(
        isTournamentBracketDrawn(
          tournament(status, [emptySlot(), emptySlot()], [emptySlot()]),
        ),
      ).toBe(false);
    },
  );

  it.each(["RegistrationOpen", "CheckInReview"])(
    "is drawn in %s once a bracket of any stage holds a team or a match",
    (status) => {
      const filled: Bracket[] = [
        { team_1: { id: "team-a" }, team_2: null, match: null },
        { team_1: null, team_2: { id: "team-b" }, match: null },
        { team_1: null, team_2: null, match: { id: "match-1" } },
      ];

      for (const bracket of filled) {
        expect(
          isTournamentBracketDrawn(tournament(status, [emptySlot(), bracket])),
        ).toBe(true);
        expect(
          isTournamentBracketDrawn(
            tournament(status, [emptySlot()], [emptySlot(), bracket]),
          ),
        ).toBe(true);
      }
    },
  );

  it.each([
    "RegistrationClosed",
    "Live",
    "Paused",
    "Finished",
    "Cancelled",
    "CancelledMinTeams",
  ])("is drawn in %s whatever the brackets hold", (status) => {
    expect(isTournamentBracketDrawn(tournament(status))).toBe(true);
    expect(isTournamentBracketDrawn(tournament(status, [emptySlot()]))).toBe(
      true,
    );
  });

  it("reads a tournament without stages, or a stage without brackets, as having no brackets", () => {
    expect(isTournamentBracketDrawn({ status: "Setup" })).toBe(false);
    expect(isTournamentBracketDrawn({ status: "RegistrationOpen" })).toBe(
      false,
    );
    expect(
      isTournamentBracketDrawn({ status: "CheckInReview", stages: null }),
    ).toBe(false);
    expect(
      isTournamentBracketDrawn({ status: "RegistrationOpen", stages: [{}] }),
    ).toBe(false);
    expect(isTournamentBracketDrawn({ status: "Live" })).toBe(true);
  });
});
