export type SeasonRow = {
  id: string;
  number: number | null;
  description?: string | null;
  starts_at: string;
  ends_at: string | null;
  needs_rebuild?: boolean;
};

export type SeasonStatus = "active" | "upcoming" | "ended";

const DAY_MS = 86_400_000;

const ms = (iso: string) => new Date(iso).getTime();

export function seasonStatus(season: SeasonRow, now: number): SeasonStatus {
  if (ms(season.starts_at) > now) {
    return "upcoming";
  }
  return !season.ends_at || ms(season.ends_at) > now ? "active" : "ended";
}

export function activeSeason<T extends SeasonRow>(
  seasons: T[],
  now: number,
): T | null {
  return seasons.find((s) => seasonStatus(s, now) === "active") || null;
}

/** Soonest first. */
export function upcomingSeasons<T extends SeasonRow>(
  seasons: T[],
  now: number,
): T[] {
  return seasons
    .filter((s) => seasonStatus(s, now) === "upcoming")
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at));
}

/** Most recent first. */
export function pastSeasons<T extends SeasonRow>(
  seasons: T[],
  now: number,
): T[] {
  return seasons
    .filter((s) => seasonStatus(s, now) === "ended")
    .sort((a, b) => ms(b.starts_at) - ms(a.starts_at));
}

/** The season with the latest start, whatever its status. */
export function latestSeason<T extends SeasonRow>(seasons: T[]): T | null {
  return seasons.reduce<T | null>(
    (latest, s) =>
      !latest || ms(s.starts_at) > ms(latest.starts_at) ? s : latest,
    null,
  );
}

// The create form starts open only when there is nothing to fall back on:
// no seasons at all, or an off-season with nothing scheduled.
export function mustPlanNext(seasons: SeasonRow[], now: number): boolean {
  return (
    seasons.length === 0 ||
    (!activeSeason(seasons, now) && upcomingSeasons(seasons, now).length === 0)
  );
}

export type NextHint =
  | { kind: "scheduled"; season: SeasonRow }
  | { kind: "after"; season: SeasonRow }
  | { kind: "open_ended"; season: SeasonRow }
  | null;

export function nextSeasonHint(seasons: SeasonRow[], now: number): NextHint {
  const upcoming = upcomingSeasons(seasons, now)[0];
  if (upcoming) {
    return { kind: "scheduled", season: upcoming };
  }
  const active = activeSeason(seasons, now);
  if (active?.ends_at) {
    return { kind: "after", season: active };
  }
  if (active) {
    return { kind: "open_ended", season: active };
  }
  return null;
}

// A later season would overlap one that never ends.
export function openEndedBlocker<T extends SeasonRow>(
  seasons: T[],
  now: number,
): T | null {
  const latest = latestSeason(seasons);
  return latest && !latest.ends_at && seasonStatus(latest, now) !== "ended"
    ? latest
    : null;
}

export function previewNumber(
  seasons: SeasonRow[],
  startMs: number | null,
): number {
  if (startMs == null) {
    return seasons.length + 1;
  }
  return seasons.filter((s) => ms(s.starts_at) < startMs).length + 1;
}

export function overlapsSeason(
  seasons: SeasonRow[],
  startMs: number,
  endMs: number,
  excludeId: string | null = null,
): boolean {
  return seasons.some((s) => {
    if (excludeId && s.id === excludeId) {
      return false;
    }
    const sEnd = s.ends_at ? ms(s.ends_at) : Infinity;
    return startMs < sEnd && ms(s.starts_at) < endMs;
  });
}

export function seasonProgress(season: SeasonRow, now: number): number | null {
  if (!season.ends_at) {
    return null;
  }
  const start = ms(season.starts_at);
  const end = ms(season.ends_at);
  if (end <= start) {
    return 100;
  }
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

/** 1-based day of the season `now` falls on. */
export function seasonDay(season: SeasonRow, now: number): number {
  return Math.max(1, Math.floor((now - ms(season.starts_at)) / DAY_MS) + 1);
}

export function seasonLengthDays(season: SeasonRow): number | null {
  return season.ends_at
    ? Math.round((ms(season.ends_at) - ms(season.starts_at)) / DAY_MS)
    : null;
}

export function daysUntil(iso: string, now: number): number {
  return Math.max(0, Math.ceil((ms(iso) - now) / DAY_MS));
}

export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(total / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(Math.floor((total % 86400) / 3600))}:${pad(
    Math.floor((total % 3600) / 60),
  )}:${pad(total % 60)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}
