import type { e_match_status_enum } from "~/generated/zeus";

export type TeamResult = "W" | "L" | "T";

type ResultMatch =
  | { status?: string | null; winning_lineup_id?: string | null }
  | null
  | undefined;

// A Forfeit or Surrendered match is a result only once it has a winner
// (api#615). Before that api, a decided one was stored as Finished, so every
// Forfeit/Surrendered row it left behind has no winner and is not a result.
const DECIDED_BY_WINNER = ["Forfeit", "Surrendered"] as e_match_status_enum[];

export const RESULT_STATUSES = [
  "Finished",
  ...DECIDED_BY_WINNER,
] as e_match_status_enum[];

export const RESULT_MATCHES_WHERE = {
  _or: [
    { status: { _eq: "Finished" as e_match_status_enum } },
    {
      status: { _in: DECIDED_BY_WINNER },
      winning_lineup_id: { _is_null: false },
    },
  ],
};

export function isEndedWithResult(match: ResultMatch): boolean {
  if (match?.status === "Finished") {
    return true;
  }
  return (
    (DECIDED_BY_WINNER as string[]).includes(match?.status ?? "") &&
    !!match?.winning_lineup_id
  );
}

export function resultStatusLabelKey(match: ResultMatch): string | null {
  if (!isEndedWithResult(match)) {
    return null;
  }
  if (match?.status === "Forfeit") {
    return "match.stream.card.forfeit";
  }
  if (match?.status === "Surrendered") {
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
  if (!lineupId || !isEndedWithResult(match)) {
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
