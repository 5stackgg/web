// Mirrors the api's ScrimsService rules: a series may run an hour past the
// end of a team's window (PLAYTIME_MINUTES), and a proposal is always at
// least LEAD_MINUTES ahead.
export const GRACE_MINUTES = 60;
export const LEAD_MINUTES = 15;
export const STEP_MINUTES = 30;
export const WEEK_DAYS = 7;

const MINUTE = 60_000;

export interface ScrimWindow {
  starts_at: string;
  ends_at: string;
  recurring_weekly?: boolean | null;
}

export interface OpenInterval {
  start: number;
  end: number;
}

export type DayRanges = Array<Array<[number, number]>>;

export function startOfDay(date: Date | number): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Days from today (0) in the viewer's zone.
export function dayOffset(ms: number, now: Date): number {
  return Math.round(
    (startOfDay(ms).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
}

// Concrete open stretches over the coming week. Weekly windows repeat on the
// weekday and local time they were saved with; anything already over is gone.
export function openIntervals(
  windows: Array<ScrimWindow> | null | undefined,
  now: Date,
  days = WEEK_DAYS,
): OpenInterval[] {
  const nowMs = now.getTime();
  const today = startOfDay(now);
  const horizon = addDays(today, days).getTime();
  const raw: OpenInterval[] = [];

  for (const window of windows ?? []) {
    const starts = new Date(window.starts_at);
    const length = new Date(window.ends_at).getTime() - starts.getTime();
    if (!(length > 0)) {
      continue;
    }
    if (!window.recurring_weekly) {
      const end = starts.getTime() + length;
      if (end > nowMs && starts.getTime() < horizon) {
        raw.push({ start: starts.getTime(), end });
      }
      continue;
    }
    for (let offset = -1; offset < days; offset++) {
      const day = addDays(today, offset);
      if (day.getDay() !== starts.getDay()) {
        continue;
      }
      day.setHours(starts.getHours(), starts.getMinutes(), 0, 0);
      const start = day.getTime();
      if (start + length > nowMs) {
        raw.push({ start, end: start + length });
      }
    }
  }

  raw.sort((a, b) => a.start - b.start);
  const merged: OpenInterval[] = [];
  for (const interval of raw) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

export function earliestStart(now: Date): number {
  return ceilToStep(now.getTime() + LEAD_MINUTES * MINUTE);
}

export function ceilToStep(ms: number, step = STEP_MINUTES): number {
  const date = new Date(ms);
  if (date.getSeconds() || date.getMilliseconds()) {
    date.setSeconds(0, 0);
    date.setMinutes(date.getMinutes() + 1);
  }
  const over = date.getMinutes() % step;
  if (over) {
    date.setMinutes(date.getMinutes() + step - over);
  }
  return date.getTime();
}

export function seriesMinutes(bestOf: number): number {
  return Math.max(1, bestOf) * 60;
}

export function covers(
  intervals: OpenInterval[],
  start: number,
  minutes: number,
): boolean {
  const end = start + minutes * MINUTE;
  return intervals.some(
    (interval) =>
      start >= interval.start && end <= interval.end + GRACE_MINUTES * MINUTE,
  );
}

export function isOpenAt(intervals: OpenInterval[], at: number): boolean {
  return intervals.some((interval) => at >= interval.start && at < interval.end);
}

// Every start (on the step grid) a series of `minutes` can take on `day`.
export function startsOn(
  intervals: OpenInterval[],
  day: Date,
  minutes: number,
  now: Date,
): number[] {
  const from = earliestStart(now);
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const out = new Set<number>();
  for (const interval of intervals) {
    let t = Math.max(ceilToStep(interval.start), from, dayStart);
    while (
      t < dayEnd &&
      t + minutes * MINUTE <= interval.end + GRACE_MINUTES * MINUTE
    ) {
      out.add(t);
      t += STEP_MINUTES * MINUTE;
    }
  }
  return [...out].sort((a, b) => a - b);
}

// The first start in `theirs`; with `mine`, the first one both teams cover.
export function firstStart(
  theirs: OpenInterval[],
  minutes: number,
  now: Date,
  mine?: OpenInterval[],
): number | null {
  for (let offset = 0; offset < WEEK_DAYS; offset++) {
    const day = addDays(startOfDay(now), offset);
    for (const t of startsOn(theirs, day, minutes, now)) {
      if (!mine || covers(mine, t, minutes)) {
        return t;
      }
    }
  }
  return null;
}

// The first stretch of at least an hour that both teams have open.
export function sharedStretch(
  a: OpenInterval[],
  b: OpenInterval[],
  now: Date,
): OpenInterval | null {
  const from = earliestStart(now);
  let best: OpenInterval | null = null;
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.start, y.start, from);
      const end = Math.min(x.end, y.end);
      if (end - start >= 60 * MINUTE && (!best || start < best.start)) {
        best = { start, end };
      }
    }
  }
  return best;
}

/* ---------- who can play whom (ScrimsService.rangesOverlap / regionsOverlap) ---------- */

export function withinRange(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  if (min == null && max == null) {
    return true;
  }
  if (value == null) {
    return false;
  }
  if (min != null && value < min) {
    return false;
  }
  return max == null || value <= max;
}

// Regions both teams play on; an empty list means "any".
export function sharedRegions(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
): string[] {
  const left = a ?? [];
  const right = b ?? [];
  if (!left.length) {
    return right;
  }
  if (!right.length) {
    return left;
  }
  return left.filter((region) => right.includes(region));
}

export interface ScrimSide {
  elo: number | null | undefined;
  eloMin: number | null | undefined;
  eloMax: number | null | undefined;
  regions: string[] | null | undefined;
  mapIds: string[] | null | undefined;
  intervals: OpenInterval[];
}

export type ScrimBlock = "booked" | "their_range" | "our_range" | null;

export interface ScrimFit {
  block: ScrimBlock;
  theyAccept: boolean;
  weAccept: boolean;
  regions: string[];
  regionShared: boolean;
  mapsShared: string[];
  shared: OpenInterval | null;
  next: number | null;
}

export function scrimFit(
  mine: ScrimSide,
  theirs: ScrimSide,
  now: Date,
  { booked = false }: { booked?: boolean } = {},
): ScrimFit {
  const theyAccept = withinRange(mine.elo, theirs.eloMin, theirs.eloMax);
  const weAccept = withinRange(theirs.elo, mine.eloMin, mine.eloMax);
  const regions = sharedRegions(mine.regions, theirs.regions);
  const theirMaps = theirs.mapIds ?? [];
  const myMaps = mine.mapIds ?? [];
  let block: ScrimBlock = null;
  if (booked) {
    block = "booked";
  } else if (!theyAccept) {
    block = "their_range";
  } else if (!weAccept) {
    block = "our_range";
  }
  return {
    block,
    theyAccept,
    weAccept,
    regions,
    regionShared:
      !mine.regions?.length || !theirs.regions?.length || regions.length > 0,
    mapsShared: theirMaps.length
      ? theirMaps.filter((id) => myMaps.includes(id))
      : [...myMaps],
    shared: sharedStretch(theirs.intervals, mine.intervals, now),
    next: firstStart(theirs.intervals, 60, now, mine.intervals),
  };
}

/* ---------- weekly hours <-> availability rows ---------- */

// Weekly rows are saved against the week of Sun Jan 4 1970 in the saver's
// local time, the same anchor the api and the old grid use.
function anchor(day: number, minutes: number): Date {
  return new Date(1970, 0, 4 + day, 0, minutes, 0, 0);
}

export function weeklyRanges(
  windows: Array<ScrimWindow> | null | undefined,
): DayRanges {
  const ranges: DayRanges = Array.from({ length: 7 }, () => []);
  for (const window of windows ?? []) {
    if (!window.recurring_weekly) {
      continue;
    }
    const starts = new Date(window.starts_at);
    const length = Math.round(
      (new Date(window.ends_at).getTime() - starts.getTime()) / MINUTE,
    );
    if (length <= 0) {
      continue;
    }
    const start = starts.getHours() * 60 + starts.getMinutes();
    ranges[starts.getDay()].push([start, start + length]);
  }
  for (const day of ranges) {
    day.sort((a, b) => a[0] - b[0]);
  }
  // A stretch the old grid split at midnight reads as one range.
  for (let day = 0; day < 7; day++) {
    const next = ranges[(day + 1) % 7];
    for (const range of ranges[day]) {
      const carry = next.findIndex(([start]) => start === 0);
      if (range[1] === 1440 && carry !== -1) {
        range[1] = 1440 + next[carry][1];
        next.splice(carry, 1);
      }
    }
  }
  return ranges;
}

export function windowsFromRanges(
  ranges: DayRanges,
): Array<{ starts_at: string; ends_at: string; recurring_weekly: true }> {
  const out: Array<{
    starts_at: string;
    ends_at: string;
    recurring_weekly: true;
  }> = [];
  ranges.forEach((day, index) => {
    for (const [start, end] of day) {
      if (end <= start) {
        continue;
      }
      out.push({
        starts_at: anchor(index, start).toISOString(),
        ends_at: anchor(index, end).toISOString(),
        recurring_weekly: true,
      });
    }
  });
  return out;
}
