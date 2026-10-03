// Pure helpers behind /play's "More ways to play" so the layout rules can be
// tested without the data layer.

// Column counts only: the class names live in the templates, where Tailwind
// can see them.

// The first row holds up to three cards. Two share the row evenly; a lone
// card keeps a third of it instead of stretching across the page.
export function wayCardColumns(count: number): 2 | 3 {
  return count === 2 ? 2 : 3;
}

// Drop in tiles: one tile keeps the width of a first-row card, two or more
// share the row evenly (at most four: three servers and the practice tile).
export function dropInColumns(count: number): 2 | 3 | 4 {
  if (count === 2) return 2;
  if (count >= 4) return 4;
  return 3;
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

export function formatDayAndTime(value: string, locale?: string): string {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} · ${time}`;
}

export function formatDay(value: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
