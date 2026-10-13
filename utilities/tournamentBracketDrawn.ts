import { e_tournament_status_enum } from "~/generated/zeus";

interface DrawableTournament {
  status?: string | null;
  stages?: Array<{
    brackets?: Array<{
      team_1?: unknown;
      team_2?: unknown;
      match?: unknown;
    }> | null;
  }> | null;
}

// Mirrors the api's assert_tournament_stages_editable, which its map pool lock
// follows too: Setup is always open (opening registration redraws every
// bracket), registration and check-in review only until a team or match is in
// a bracket.
export function isTournamentBracketDrawn(
  tournament: DrawableTournament,
): boolean {
  switch (tournament.status) {
    case e_tournament_status_enum.Setup:
      return false;
    case e_tournament_status_enum.RegistrationOpen:
    case e_tournament_status_enum.CheckInReview:
      return (tournament.stages ?? []).some((stage) =>
        (stage.brackets ?? []).some(
          (bracket) => !!(bracket.team_1 || bracket.team_2 || bracket.match),
        ),
      );
    default:
      return true;
  }
}
