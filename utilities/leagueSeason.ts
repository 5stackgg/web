export interface LeagueSeasonRef {
  id: string;
  season_number?: number | null;
  status: string;
}

const ACTIVE_STATUSES = [
  "RegistrationOpen",
  "RegistrationClosed",
  "Live",
  "Playoffs",
];

const byNumberDesc = (a: LeagueSeasonRef, b: LeagueSeasonRef) =>
  (b.season_number ?? 0) - (a.season_number ?? 0);

// The "current" season the leagues landing jumps to: prefer a live/registering
// season, otherwise the newest that isn't canceled, otherwise the newest.
export function pickCurrentSeason<T extends LeagueSeasonRef>(
  seasons: T[],
): T | null {
  if (!seasons?.length) {
    return null;
  }
  const active = seasons
    .filter((s) => ACTIVE_STATUSES.includes(s.status))
    .sort(byNumberDesc);
  if (active.length) {
    return active[0];
  }
  const live = seasons
    .filter((s) => s.status !== "Canceled")
    .sort(byNumberDesc);
  if (live.length) {
    return live[0];
  }
  return [...seasons].sort(byNumberDesc)[0] ?? null;
}
