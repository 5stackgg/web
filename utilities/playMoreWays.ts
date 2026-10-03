// Pure helpers behind /play's "More ways to play" so the layout rules can be
// tested without the data layer.

// One grid: an open tournament leads it and everything else (league, scrims,
// servers, practice) is a tile. Layout names only: the class names live in
// the template, where Tailwind can see them.
//   wide:    a tournament with at most one tile, as the /watch row card
//            across two thirds.
//   feature: a tournament stacked on the left, its banner growing to match a
//            rail of tiles on the right; one rail column for two tiles, two
//            after that.
//   tiles:   no tournament. A lone tile keeps a third of the row, two share
//            it, four fill it, anything else runs in rows of three.
export type WaysLayout =
  | { kind: "wide" }
  | { kind: "feature"; railColumns: 1 | 2 }
  | { kind: "tiles"; columns: 2 | 3 | 4 };

export function waysLayout(hasTournament: boolean, tiles: number): WaysLayout {
  if (hasTournament) {
    if (tiles <= 1) return { kind: "wide" };
    return { kind: "feature", railColumns: tiles === 2 ? 1 : 2 };
  }
  if (tiles === 2) return { kind: "tiles", columns: 2 };
  if (tiles === 4) return { kind: "tiles", columns: 4 };
  return { kind: "tiles", columns: 3 };
}

export const MAX_SERVER_TILES = 3;

// Busiest first; ties keep their incoming order (the query sorts by label).
export function pickServerTiles<T extends { players: number }>(
  servers: T[],
  max = MAX_SERVER_TILES,
): T[] {
  return servers
    .map((server, index) => ({ server, index }))
    .sort((a, b) => b.server.players - a.server.players || a.index - b.index)
    .slice(0, max)
    .map(({ server }) => server);
}

type ScrimPosting = {
  team_id: string;
  team?: {
    scrim_availability?: Array<{
      starts_at: string;
      recurring_weekly?: boolean | null;
    }> | null;
  } | null;
};

// Teams (other than the viewer's own) with a scrim window that falls on
// today, counted once each however many windows they posted. Same matching
// as the scrim finder's "today" list.
export function countScrimTeamsToday(
  postings: ScrimPosting[],
  excludeTeamIds: string[],
  now = new Date(),
): number {
  const today = now.getDay();
  const teams = new Set<string>();

  for (const posting of postings) {
    if (excludeTeamIds.includes(posting.team_id)) continue;
    const windows = posting.team?.scrim_availability ?? [];
    const onToday = windows.some((window) => {
      const start = new Date(window.starts_at);
      return window.recurring_weekly
        ? start.getDay() === today
        : start.toDateString() === now.toDateString();
    });
    if (onToday) teams.add(posting.team_id);
  }

  return teams.size;
}

export function formatDay(value: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
