// steam_id -> reason, for the player pickers hanging off a match (lineup slots
// and coach slots). Shared because LineupOverview and MatchInfo need exactly
// the same set and used to carry byte-for-byte duplicates of it.
export function matchIneligiblePlayers(
  match: any,
  t: (key: string) => string,
): Record<string, string> {
  if (!match) {
    return {};
  }

  const map: Record<string, string> = {};
  const lineups = [match.lineup_1, match.lineup_2];

  for (const lineup of lineups) {
    for (const player of lineup?.lineup_players || []) {
      if (player?.steam_id) {
        map[String(player.steam_id)] = t("player.search.ineligible.in_lineup");
      }
    }
  }

  // Coaches last so anyone who is both reads as coaching, which is the more
  // specific fact.
  for (const lineup of lineups) {
    if (lineup?.coach?.steam_id) {
      map[String(lineup.coach.steam_id)] = t(
        "player.search.ineligible.coaching",
      );
    }
  }

  return map;
}
