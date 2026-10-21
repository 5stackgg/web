// @vitest-environment node
import { describe, expect, it } from "vitest";
import { tournamentRegistrationCount } from "~/utilities/tournamentRegistrationCount";

function tournament({
  registration_type = "teams",
  teams = 0,
  rostered = 0,
  freeAgents = 0,
  maxTeams = 16 as number | null,
  lineup = 5 as number | null,
  type = "Competitive",
}: {
  registration_type?: string;
  teams?: number;
  rostered?: number;
  freeAgents?: number;
  maxTeams?: number | null;
  lineup?: number | null;
  type?: string;
} = {}) {
  return {
    registration_type,
    min_players_per_lineup: lineup,
    options: { type },
    teams_aggregate: { aggregate: { count: teams } },
    rosters_aggregate: { aggregate: { count: rostered } },
    free_agents_aggregate: { aggregate: { count: freeAgents } },
    stages: maxTeams === null ? [] : [{ order: 1, max_teams: maxTeams }],
  };
}

describe("tournamentRegistrationCount", () => {
  it("counts teams against the team cap when only teams register", () => {
    expect(
      tournamentRegistrationCount(tournament({ teams: 6, freeAgents: 3 })),
    ).toEqual({ unit: "teams", count: 6, max: 16 });
  });

  it("counts players against the player cap when only free agents register", () => {
    expect(
      tournamentRegistrationCount(
        tournament({ registration_type: "free_agents", freeAgents: 34 }),
      ),
    ).toEqual({ unit: "players", count: 34, max: 80 });
  });

  it("counts the players on team rosters plus the free agents", () => {
    expect(
      tournamentRegistrationCount(
        tournament({
          registration_type: "both",
          teams: 6,
          rostered: 22,
          freeAgents: 16,
        }),
      ),
    ).toEqual({ unit: "players", count: 38, max: 80 });
  });

  it("counts a team still short of players as the players it has", () => {
    expect(
      tournamentRegistrationCount(
        tournament({
          registration_type: "both",
          teams: 1,
          rostered: 2,
          maxTeams: 32,
        }),
      ),
    ).toEqual({ unit: "players", count: 2, max: 160 });
  });

  it("never shows more players than the cap", () => {
    expect(
      tournamentRegistrationCount(
        tournament({
          registration_type: "both",
          teams: 15,
          rostered: 75,
          freeAgents: 20,
        }),
      ),
    ).toEqual({ unit: "players", count: 80, max: 80 });
  });

  it("has no cap when the first stage has none", () => {
    expect(
      tournamentRegistrationCount(
        tournament({
          registration_type: "free_agents",
          freeAgents: 34,
          maxTeams: null,
        }),
      ),
    ).toEqual({ unit: "players", count: 34, max: null });
  });

  it("uses the tournament's lineup size, so a wingman team is two players", () => {
    expect(
      tournamentRegistrationCount(
        tournament({
          registration_type: "both",
          teams: 3,
          rostered: 6,
          freeAgents: 2,
          maxTeams: 8,
          lineup: 2,
          type: "Wingman",
        }),
      ),
    ).toEqual({ unit: "players", count: 8, max: 16 });
  });

  it("falls back to the match type's lineup when the api has not said", () => {
    expect(
      tournamentRegistrationCount(
        tournament({
          registration_type: "free_agents",
          freeAgents: 4,
          maxTeams: 4,
          lineup: null,
          type: "Rush",
        }),
      ),
    ).toEqual({ unit: "players", count: 4, max: 12 });
  });

  it("reads the cap from the first stage, whatever order the stages came in", () => {
    const cup = tournament({ registration_type: "free_agents", freeAgents: 1 });
    cup.stages = [
      { order: 2, max_teams: 4 },
      { order: 1, max_teams: 16 },
    ];

    expect(tournamentRegistrationCount(cup).max).toBe(80);
  });

  it("treats a tournament without a registration type as teams only", () => {
    const cup: Record<string, unknown> = tournament({ teams: 2 });
    delete cup.registration_type;
    delete cup.free_agents_aggregate;

    expect(tournamentRegistrationCount(cup)).toEqual({
      unit: "teams",
      count: 2,
      max: 16,
    });
  });
});
