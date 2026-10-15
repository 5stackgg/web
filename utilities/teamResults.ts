import type { e_match_status_enum } from "~/generated/zeus";

export type TeamResult = "W" | "L" | "T";

// A forfeit or surrender keeps its own status with a winner (api#615); it used
// to be stored as Finished, so every result surface counts all three.
export const RESULT_STATUSES = [
  "Finished",
  "Forfeit",
  "Surrendered",
] as e_match_status_enum[];

export function isEndedWithResult(status: string | null | undefined) {
  return !!status && (RESULT_STATUSES as string[]).includes(status);
}

export function resultStatusLabelKey(
  status: string | null | undefined,
): string | null {
  if (status === "Forfeit") {
    return "match.stream.card.forfeit";
  }
  if (status === "Surrendered") {
    return "match.stream.card.surrendered";
  }
  return null;
}

// The lineup a team played as in a match, by the lineup's team_id.
export function teamLineupId(match: any, teamId: string): string | null {
  if (match?.lineup_1?.team_id === teamId) return match.lineup_1_id ?? null;
  if (match?.lineup_2?.team_id === teamId) return match.lineup_2_id ?? null;
  return null;
}

export function teamResult(match: any, teamId: string): TeamResult | null {
  const lineupId = teamLineupId(match, teamId);
  if (!lineupId || !isEndedWithResult(match?.status)) {
    return null;
  }
  if (!match.winning_lineup_id) return "T";
  return match.winning_lineup_id === lineupId ? "W" : "L";
}

// Results oldest -> newest, from a newest-first list of finished matches.
export function teamForm(matches: any[], teamId: string): TeamResult[] {
  return matches
    .map((match) => teamResult(match, teamId))
    .filter((result): result is TeamResult => result !== null)
    .reverse();
}

// The other side of a match from this team's point of view.
export function teamOpponent(match: any, teamId: string): any | null {
  if (match?.lineup_1?.team_id === teamId) return match.lineup_2 ?? null;
  if (match?.lineup_2?.team_id === teamId) return match.lineup_1 ?? null;
  return null;
}
