// What a list already knows about a tournament, kept so its page can draw the
// real header the moment you click through instead of a blank wait.
export type TournamentPreview = {
  id: string;
  name: string;
  banner: string | null;
  statusLabel: string | null;
};

const MAX_PREVIEWS = 200;

export function useTournamentPreviews() {
  return useState<Record<string, TournamentPreview>>(
    "tournament-previews",
    () => ({}),
  );
}

export function rememberTournaments(
  tournaments: Array<Record<string, any> | null | undefined>,
) {
  const previews = useTournamentPreviews();
  const next = { ...previews.value };
  for (const tournament of tournaments) {
    if (!tournament?.id || !tournament.name) continue;
    next[tournament.id] = {
      id: tournament.id,
      name: tournament.name,
      banner: tournament.banner ?? null,
      statusLabel: tournament.e_tournament_status?.description ?? null,
    };
  }
  const ids = Object.keys(next);
  if (ids.length > MAX_PREVIEWS) {
    for (const id of ids.slice(0, ids.length - MAX_PREVIEWS)) delete next[id];
  }
  previews.value = next;
}
