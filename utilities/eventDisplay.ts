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
