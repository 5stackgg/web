// The match page reads each map's kills and assists once and hands them to
// their rounds here: read through each round, they were looked up once per
// round in every chunk of the event hypertables.
export function withRoundEvents<T extends { match_maps?: any[] } | null>(
  match: T,
): T {
  if (!match?.match_maps) {
    return match;
  }
  return {
    ...match,
    match_maps: match.match_maps.map((map) => {
      const { player_kills, player_assists, ...rest } = map;
      const kills = byRound(player_kills);
      const assists = byRound(player_assists);
      return {
        ...rest,
        rounds: (map.rounds ?? []).map((round: { round: number }) => ({
          ...round,
          kills: kills.get(round.round) ?? [],
          assists: assists.get(round.round) ?? [],
        })),
      };
    }),
  };
}

function byRound(rows: Array<{ round: number }> = []) {
  const out = new Map<number, Array<Record<string, unknown>>>();
  for (const { round, ...row } of rows) {
    const list = out.get(round);
    if (list) {
      list.push(row);
    } else {
      out.set(round, [row]);
    }
  }
  return out;
}
