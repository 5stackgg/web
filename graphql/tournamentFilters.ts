// League division play materializes as internal tournaments (one per division,
// linked via the `league_season_division` relationship); they belong on the
// league pages, not the public tournament lists. This relationship has been in
// the schema since the league feature shipped, so the filter works with no
// migration/metadata step. Merge it into a tournaments `where` (via `_and`).
export const NOT_LEAGUE_TOURNAMENT: any = {
  _not: { league_season_division: {} },
};

export function excludeLeagueTournaments(
  where: Record<string, any> = {},
): Record<string, any> {
  return {
    ...where,
    _and: [...(where._and ?? []), NOT_LEAGUE_TOURNAMENT],
  };
}
