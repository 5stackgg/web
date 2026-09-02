type EloLadder = "Competitive" | "Wingman";

type TournamentLike =
  | {
      min_players_per_lineup?: number | string | null;
      max_players_per_lineup?: number | string | null;
    }
  | null
  | undefined;

type PlayerLike =
  | { elo?: Record<string, number | null> | null }
  | null
  | undefined;

/**
 * Mirrors get_tournament_player_elo: a 2-per-lineup format is rated on the
 * Wingman ladder and everything else on Competitive. The entry gate, the draft
 * and the free agent pool all have to read the same ladder the server does.
 */
export function tournamentEloLadder(tournament: TournamentLike): EloLadder {
  const size =
    Number(tournament?.min_players_per_lineup) ||
    Number(tournament?.max_players_per_lineup) ||
    0;
  return size === 2 ? "Wingman" : "Competitive";
}

/**
 * `players.elo` is a per-ladder map, never a single number — rendering or
 * comparing the column itself yields raw JSON and NaN.
 */
export function tournamentPlayerElo(
  tournament: TournamentLike,
  player: PlayerLike,
): number | null {
  const value = Number(
    player?.elo?.[tournamentEloLadder(tournament).toLowerCase()],
  );
  return Number.isFinite(value) ? value : null;
}
