export function useTournamentContext() {
  return useState<{ id: string; name: string } | null>(
    "tournamentContext",
    () => null,
  );
}
