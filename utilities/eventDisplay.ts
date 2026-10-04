export function formatEventDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export type EventPhase = "upcoming" | "live" | "finished";

// Events have no status column; the lifecycle is derived from the schedule.
// An event with no dates at all is treated as upcoming (nothing has provably
// started), and an open-ended event (starts_at only) stays live forever.
export function eventPhase(event: {
  starts_at?: string | null;
  ends_at?: string | null;
}): EventPhase {
  const now = Date.now();
  const ends = event.ends_at ? new Date(event.ends_at).getTime() : NaN;
  const starts = event.starts_at ? new Date(event.starts_at).getTime() : NaN;

  if (Number.isFinite(ends) && ends < now) {
    return "finished";
  }
  if (Number.isFinite(starts) && starts <= now) {
    return "live";
  }
  return "upcoming";
}

// Must classify events exactly like eventPhase; change the two together.
export function eventPhaseWhere<Now>(phase: EventPhase, now: Now) {
  if (phase === "finished") {
    return { ends_at: { _lt: now } };
  }

  const notEnded = {
    _or: [{ ends_at: { _is_null: true } }, { ends_at: { _gte: now } }],
  };
  if (phase === "live") {
    return { _and: [notEnded, { starts_at: { _lte: now } }] };
  }
  return { _and: [notEnded, { starts_at: { _gt: now } }] };
}

export function phaseBadgeVariant(
  phase: EventPhase,
): "default" | "secondary" | "destructive" | "outline" {
  if (phase === "live") return "destructive";
  if (phase === "finished") return "secondary";
  return "outline";
}

export function phaseLabelKey(phase: EventPhase): string {
  return `event.phase.${phase}`;
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}

// "Nov 7 – 10, 2025": one range, the shared parts written once.
export function formatEventRange(
  startsAt?: string | null,
  endsAt?: string | null,
): string | null {
  const starts = startsAt ? new Date(startsAt) : null;
  const ends = endsAt ? new Date(endsAt) : null;
  const format = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (
    starts &&
    ends &&
    !Number.isNaN(starts.getTime()) &&
    !Number.isNaN(ends.getTime())
  ) {
    return format.formatRange(starts, ends);
  }
  return formatEventDate(startsAt) ?? formatEventDate(endsAt);
}

// Which day of a running event it is; `total` is null for open-ended events.
export function eventDay(
  event: { starts_at?: string | null; ends_at?: string | null },
  now = new Date(),
): { day: number; total: number | null } | null {
  if (!event.starts_at) return null;
  const starts = new Date(event.starts_at);
  const day = calendarDaysBetween(starts, now) + 1;
  if (!event.ends_at) return { day, total: null };
  const total = calendarDaysBetween(starts, new Date(event.ends_at)) + 1;
  return { day: Math.min(day, total), total };
}

export function daysUntil(
  value?: string | null,
  now = new Date(),
): number | null {
  if (!value) return null;
  return Math.max(0, calendarDaysBetween(now, new Date(value)));
}
