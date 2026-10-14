// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import TournamentResults from "~/components/tournament/TournamentResults.vue";

const { computed, methods } = TournamentResults as any;

function tournamentTeam(id: string, name: string, steamIds: string[]) {
  return {
    id,
    name: null,
    team: { id: `team-${id}`, name },
    roster: steamIds.map((steam_id) => ({
      player_steam_id: steam_id,
      player: { steam_id, name: `player-${steam_id}` },
    })),
  };
}

const winners = tournamentTeam("tt-1", "100FOFOCA", ["1", "2"]);
const runnersUp = tournamentTeam("tt-2", "SOCAFOFO", ["3", "4"]);
const thirds = tournamentTeam("tt-3", "Brazino69", ["5", "6"]);

function grant(overrides: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    player_steam_id: null,
    player: null,
    team_id: null,
    award: { id: "award", name: "Award", tier: "gold" },
    ...overrides,
  };
}

function context(awards: any[], podiumSteps: any[] | null = null) {
  const self: any = {
    tournament: { awards },
    podiumSteps,
    finalStageType: "SingleElimination",
    displayTeamName: methods.displayTeamName,
  };
  self.podiumFromAwards = methods.podiumFromAwards.bind(self);
  return self;
}

function podium(awards: any[]) {
  return computed.podium.call(context(awards));
}

describe("TournamentResults podium", () => {
  it("leaves tournament awards without a placement off the podium", () => {
    const karambit = {
      id: "karambit",
      name: "Golden Karambit",
      tier: "special",
    };

    const steps = podium([
      grant({
        placement: 1,
        source: "tournament",
        tournament_team_id: winners.id,
        tournament_team: winners,
      }),
      grant({
        placement: 2,
        source: "tournament",
        tournament_team_id: runnersUp.id,
        tournament_team: runnersUp,
      }),
      grant({
        placement: null,
        source: "manual",
        award: karambit,
        player_steam_id: "1",
        player: winners.roster[0].player,
        tournament_team_id: winners.id,
        tournament_team: winners,
      }),
      grant({
        placement: null,
        source: "manual",
        player_steam_id: "5",
        player: thirds.roster[0].player,
        tournament_team_id: thirds.id,
        tournament_team: thirds,
      }),
    ]);

    expect(steps.map((step: any) => [step.placement, step.teamName])).toEqual([
      [1, "100FOFOCA"],
      [2, "SOCAFOFO"],
    ]);
  });

  it("puts a hand-granted third place on the third step", () => {
    const steps = podium([
      grant({
        placement: 1,
        source: "tournament",
        tournament_team_id: winners.id,
        tournament_team: winners,
      }),
      grant({
        placement: 3,
        source: "manual",
        tournament_team_id: thirds.id,
        tournament_team: thirds,
      }),
    ]);

    expect(steps.map((step: any) => [step.placement, step.teamName])).toEqual([
      [1, "100FOFOCA"],
      [3, "Brazino69"],
    ]);
    expect(steps[1].players.map((p: any) => p.steam_id)).toEqual(["5", "6"]);
  });

  it("gives two teams handed the same placement a step each", () => {
    const fourths = tournamentTeam("tt-4", "Quarta Linha", ["7", "8"]);

    const steps = podium(
      [thirds, fourths].flatMap((entry) =>
        entry.roster.map((seat) =>
          grant({
            placement: 3,
            source: "manual",
            player_steam_id: seat.player_steam_id,
            player: seat.player,
            tournament_team_id: entry.id,
            tournament_team: entry,
          }),
        ),
      ),
    );

    expect(
      steps.map((step: any) => [
        step.teamName,
        step.players.map((p: any) => p.steam_id),
      ]),
    ).toEqual([
      ["Brazino69", ["5", "6"]],
      ["Quarta Linha", ["7", "8"]],
    ]);
  });

  describe("from the tournament's placements", () => {
    const step = (
      placement: number,
      entry: ReturnType<typeof tournamentTeam>,
    ) => ({
      placement,
      tournament_team_id: entry.id,
      team_id: entry.team.id,
      name: entry.team.name,
      players: entry.roster.map((seat) => seat.player),
    });

    const fromPlacements = (rows: any[], awards: any[] = []) =>
      computed.podium.call(context(awards, rows));

    it("shows every placing team when awards are off", () => {
      const fourths = tournamentTeam("tt-4", "Quarta Linha", ["7", "8"]);

      const steps = fromPlacements([
        step(1, winners),
        step(2, runnersUp),
        step(3, thirds),
        step(3, fourths),
      ]);

      expect(
        steps.map((s: any) => [s.placement, s.teamName, s.hasAward]),
      ).toEqual([
        [1, "100FOFOCA", false],
        [2, "SOCAFOFO", false],
        [3, "Brazino69", false],
        [3, "Quarta Linha", false],
      ]);
      expect(steps[0].players.map((p: any) => p.steam_id)).toEqual([
        "1",
        "2",
      ]);
    });

    it("wears an award only where one was granted", () => {
      const steps = fromPlacements(
        [step(1, winners), step(2, runnersUp)],
        [
          grant({
            placement: 1,
            source: "tournament",
            tournament_team_id: winners.id,
            tournament_team: winners,
          }),
        ],
      );

      expect(steps.map((s: any) => s.hasAward)).toEqual([true, false]);
      expect(steps[0].award.tier).toBe("gold");
    });

    it("keeps a placement award granted to a team the placements don't name", () => {
      const steps = fromPlacements(
        [step(1, winners), step(2, runnersUp), step(3, thirds)],
        [
          grant({
            placement: 3,
            source: "manual",
            tournament_team_id: "tt-9",
            tournament_team: tournamentTeam("tt-9", "Joint Third", ["9"]),
          }),
        ],
      );

      expect(
        steps.map((s: any) => [s.placement, s.teamName, s.hasAward]),
      ).toEqual([
        [1, "100FOFOCA", false],
        [2, "SOCAFOFO", false],
        [3, "Brazino69", false],
        [3, "Joint Third", true],
      ]);
    });

    it("falls back to the awards when there are no placements", () => {
      const steps = fromPlacements(
        [],
        [
          grant({
            placement: 1,
            source: "tournament",
            tournament_team_id: winners.id,
            tournament_team: winners,
          }),
        ],
      );

      expect(steps.map((s: any) => [s.placement, s.teamName])).toEqual([
        [1, "100FOFOCA"],
      ]);
    });

    it("calls the section Standings when nothing was awarded", () => {
      const hasAwards = (podium: any[], mvp: any = null) =>
        computed.hasAwards.call({ podium, mvp, otherAwards: [] });

      expect(hasAwards([{ hasAward: false }])).toBe(false);
      expect(hasAwards([{ hasAward: true }])).toBe(true);
      expect(hasAwards([{ hasAward: false }], { placement: 0 })).toBe(true);
    });
  });
});
