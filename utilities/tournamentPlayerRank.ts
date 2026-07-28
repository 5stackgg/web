export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// Resolves the finishing rank of the roster the query was scoped to — only
// non-null when the caller filtered `rosters` down to a single player (the
// player profile), otherwise every card would claim a rank.
export function tournamentPlayerRank(tournament: any): number | null {
  const teamId = tournament?.rosters?.[0]?.tournament_team_id;
  if (!teamId) {
    return null;
  }

  const stages = [...(tournament?.stages || [])].sort(
    (a: any, b: any) => (Number(b.order) || 0) - (Number(a.order) || 0),
  );

  for (const stage of stages) {
    const row = (stage?.results || []).find(
      (result: any) => result.tournament_team_id === teamId,
    );
    if (row?.rank) {
      return Number(row.rank);
    }
  }

  return null;
}

export function tournamentPlayerRankLabel(tournament: any): string | null {
  const rank = tournamentPlayerRank(tournament);
  return rank ? ordinal(rank) : null;
}
