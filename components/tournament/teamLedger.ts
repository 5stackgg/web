import { e_tournament_status_enum } from "~/generated/zeus";

// The Teams tab is one table: its header row in TournamentDetail and every
// TournamentTeam row sit on this grid. Seed, team, players, status, the
// organizer's action, the expand chevron.
export const teamLedgerColumns =
  "md:grid-cols-[2.5rem_minmax(0,1fr)_9rem_12.5rem_8.5rem_1rem]";

export type TeamLedgerStatus =
  | { key: "short"; count: number }
  | { key: "ready" }
  | { key: "not_eligible" }
  | { key: "in"; at: string }
  | { key: "wait" }
  | { key: "miss" };

// Seeding has not happened yet, so a team's readiness is still the question.
// A hold for check-in review counts: nothing is seeded or dropped until it ends.
const PRE_START = [
  e_tournament_status_enum.Setup,
  e_tournament_status_enum.RegistrationOpen,
  e_tournament_status_enum.RegistrationClosed,
  e_tournament_status_enum.CheckInReview,
];

export function tournamentHasStarted(status?: string | null) {
  return !!status && !PRE_START.includes(status as e_tournament_status_enum);
}

// One status per team, in the order the questions are asked: can it field a
// lineup, did it check in, is it eligible. Null once the tournament is under
// way, when the bracket says the rest.
export function teamLedgerStatus(
  team: Record<string, any>,
  tournament: Record<string, any>,
  registration?: Record<string, any> | null,
): TeamLedgerStatus | null {
  if (tournamentHasStarted(tournament?.status)) {
    return null;
  }

  const short =
    (Number(tournament?.min_players_per_lineup) || 0) -
    (team.roster?.length ?? 0);
  if (short > 0) {
    return { key: "short", count: short };
  }

  if (
    registration?.check_in_required === true &&
    registration?.check_in_started === true
  ) {
    if (team.checked_in_at) {
      return { key: "in", at: team.checked_in_at };
    }
    if (registration.check_in_open === true) {
      return { key: "wait" };
    }
    // Same gate as the api's tournament_check_in_window_opened: a team is
    // only a no-show once a check-in window actually opened.
    if (registration.check_in_ends_at) {
      return { key: "miss" };
    }
  }

  return { key: team.eligible_at ? "ready" : "not_eligible" };
}
