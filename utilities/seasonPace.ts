export interface Season {
  id: string;
  number: number | null;
  starts_at: string;
  ends_at: string | null;
}

export interface SeasonEloEntry {
  season_id?: string | null;
  type: string;
  current_elo: number | null;
  updated_elo: number | null;
  match_created_at: string;
  match_id?: string | null;
  match_result?: string | null;
}

export interface SeasonLine {
  // Ratings by match number in the season; index 0 is the season start.
  ratings: number[];
  peak: number;
  peakIndex: number;
  peakAt: string;
  peakMatchId: string | null;
}

export interface SeasonRecap {
  start: number;
  final: number;
  peak: number;
  peakMatchId: string | null;
  wins: number;
  losses: number;
}

export interface SeasonPace {
  type: string;
  current: SeasonLine | null;
  previous: SeasonLine;
  played: number;
  // Rating gap to the previous season after the same number of matches, or to
  // its final rating once this season has run longer.
  delta: number | null;
  against: number | null;
  pastPrevious: boolean;
}

export type SeasonRow<T> =
  | { kind: "match"; match: T }
  | { kind: "season"; key: string; began: Season | null; ended: Season | null };

const time = (iso: string) => new Date(iso).getTime();

const rating = (e: SeasonEloEntry) => e.updated_elo ?? e.current_elo ?? null;

export function seasonAt(
  seasons: Season[],
  iso: string | null | undefined,
): Season | null {
  if (!iso) return null;
  const t = time(iso);
  return (
    seasons.find(
      (s) => time(s.starts_at) <= t && (!s.ends_at || t < time(s.ends_at)),
    ) ?? null
  );
}

export function seasonBefore(seasons: Season[], season: Season): Season | null {
  const start = time(season.starts_at);
  return (
    seasons
      .filter((s) => time(s.starts_at) < start)
      .sort((a, b) => time(b.starts_at) - time(a.starts_at))[0] ?? null
  );
}

// Competitive leads whenever the player has any; otherwise the ladder they
// played last.
export function seasonLadder(
  entries: SeasonEloEntry[],
  seasonIds: string[],
): string | null {
  const scoped = entries.filter(
    (e) => e.season_id && seasonIds.includes(e.season_id),
  );
  if (scoped.some((e) => e.type === "Competitive")) return "Competitive";
  return scoped.at(-1)?.type ?? null;
}

export function seasonLine(
  entries: SeasonEloEntry[],
  seasonId: string,
  type: string,
): SeasonLine | null {
  const played = entries.filter(
    (e) => e.season_id === seasonId && e.type === type && rating(e) !== null,
  );
  if (played.length === 0) return null;
  const ratings = [
    played[0].current_elo ?? (rating(played[0]) as number),
    ...played.map((e) => rating(e) as number),
  ];
  let peakIndex = 1;
  for (let i = 2; i < ratings.length; i++) {
    if (ratings[i] > ratings[peakIndex]) peakIndex = i;
  }
  return {
    ratings,
    peak: ratings[peakIndex],
    peakIndex,
    peakAt: played[peakIndex - 1].match_created_at,
    peakMatchId: played[peakIndex - 1].match_id ?? null,
  };
}

export function seasonPace(
  entries: SeasonEloEntry[],
  current: Season,
  previous: Season,
): SeasonPace | null {
  const type = seasonLadder(entries, [current.id, previous.id]);
  if (!type) return null;
  const prev = seasonLine(entries, previous.id, type);
  if (!prev) return null;
  const cur = seasonLine(entries, current.id, type);
  if (!cur) {
    return {
      type,
      current: null,
      previous: prev,
      played: 0,
      delta: null,
      against: null,
      pastPrevious: false,
    };
  }
  const played = cur.ratings.length - 1;
  const pastPrevious = played >= prev.ratings.length;
  const against = prev.ratings[pastPrevious ? prev.ratings.length - 1 : played];
  return {
    type,
    current: cur,
    previous: prev,
    played,
    delta: cur.ratings[played] - against,
    against,
    pastPrevious,
  };
}

// A season's lead-ladder start/final/peak plus its record across every ladder,
// for the break between seasons in the match list.
export function seasonRecap(
  entries: SeasonEloEntry[],
  seasonId: string,
): SeasonRecap | null {
  const type = seasonLadder(entries, [seasonId]);
  const line = type ? seasonLine(entries, seasonId, type) : null;
  if (!line) return null;
  let wins = 0;
  let losses = 0;
  for (const e of entries) {
    if (e.season_id !== seasonId) continue;
    const result = (e.match_result ?? "").toLowerCase();
    if (result === "win" || result === "won") wins++;
    else if (result === "loss" || result === "lost") losses++;
  }
  return {
    start: line.ratings[0],
    final: line.ratings[line.ratings.length - 1],
    peak: line.peak,
    peakMatchId: line.peakMatchId,
    wins,
    losses,
  };
}

// Matches arrive newest first; a break goes wherever two neighbours fall in
// different seasons (or one of them falls outside every season).
export function withSeasonBreaks<T>(
  matches: T[],
  seasons: Season[],
  playedAt: (match: T) => string | null | undefined,
): SeasonRow<T>[] {
  const rows: SeasonRow<T>[] = [];
  let newer: Season | null = null;
  matches.forEach((match, index) => {
    const season = seasonAt(seasons, playedAt(match));
    if (index > 0 && season?.id !== newer?.id) {
      rows.push({
        kind: "season",
        key: `season-${newer?.id ?? "none"}-${season?.id ?? "none"}`,
        began: newer,
        ended: season,
      });
    }
    rows.push({ kind: "match", match });
    newer = season;
  });
  return rows;
}
