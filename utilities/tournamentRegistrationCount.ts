import {
  e_match_types_enum,
  e_tournament_registration_types_enum,
} from "~/generated/zeus";
import { EXPECTED_PLAYERS } from "~/utilities/matchmakingPartySize";

export type TournamentRegistrationCount = {
  unit: "teams" | "players";
  count: number;
  max: number | null;
};

function firstStageMaxTeams(tournament: any): number {
  const stages: Array<{ order?: number; max_teams?: number | null }> =
    tournament?.stages ?? [];
  const first = [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  return Number(first?.max_teams) || 0;
}

function lineupSize(tournament: any): number {
  const fromApi = Number(tournament?.min_players_per_lineup);
  if (fromApi > 0) {
    return fromApi;
  }
  const match =
    EXPECTED_PLAYERS[tournament?.options?.type as e_match_types_enum];
  return match ? match / 2 : 5;
}

// A team counts the players on its roster up to one starting lineup: short of
// it, only who is there; past it, substitutes fill no slot the cap counts. The
// pool is what the api calls the pool: registered and waitlisted agents. A
// drafted agent is already on one of the rosters.
export function tournamentRegistrationCount(
  tournament: any,
): TournamentRegistrationCount {
  const teams = Number(tournament?.teams_aggregate?.aggregate?.count) || 0;
  const maxTeams = firstStageMaxTeams(tournament);
  const type = tournament?.registration_type;

  if (
    type !== e_tournament_registration_types_enum.free_agents &&
    type !== e_tournament_registration_types_enum.both
  ) {
    return { unit: "teams", count: teams, max: maxTeams || null };
  }

  const size = lineupSize(tournament);
  const agents =
    Number(tournament?.free_agents_aggregate?.aggregate?.count) || 0;
  const rostered = (tournament?.roster_counts ?? []).reduce(
    (sum: number, team: any) =>
      sum +
      Math.min(Number(team?.roster_aggregate?.aggregate?.count) || 0, size),
    0,
  );
  const players = rostered + agents;
  const max = maxTeams ? maxTeams * size : null;

  return {
    unit: "players",
    count: max === null ? players : Math.min(players, max),
    max,
  };
}
