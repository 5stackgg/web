// Pure rules behind the Alerts timeline: an alert's state, where its bars
// start and end, how a quick "show it again" picks its end time, and the
// time window each range shows.
//
// With on/off history (system_alert_activations) every period an alert was on
// is its own segment. Without it -- an api that doesn't serve the table yet --
// a showing alert's bar starts at updated_at (the page only stamps updated_at
// when an alert goes up or comes down), falling back to created_at, and an
// alert that's off shows from created_at to when it was turned off
// (updated_at), since when it last went up isn't known.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type AlertType = "info" | "warning" | "critical";

export type TimelineAlert = {
  id: string;
  type: AlertType;
  title: string | null;
  message: string;
  is_active: boolean;
  dismissible: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type AlertState = "live" | "expired" | "off";

export function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function alertState(alert: TimelineAlert, now: number): AlertState {
  if (!alert.is_active) return "off";
  const exp = toMs(alert.expires_at);
  return exp !== null && exp <= now ? "expired" : "live";
}

export function startOf(alert: TimelineAlert): number {
  const created = toMs(alert.created_at) ?? 0;
  if (!alert.is_active) return created;
  return Math.max(created, toMs(alert.updated_at) ?? created);
}

// Infinity = no end yet.
export function endOf(alert: TimelineAlert): number {
  const exp = toMs(alert.expires_at) ?? Infinity;
  if (alert.is_active) return exp;
  const start = startOf(alert);
  const offAt = toMs(alert.updated_at) ?? start;
  return Math.max(start, Math.min(offAt, exp));
}

// Putting an alert back up reuses the length it had last time it went up
// (expires_at minus its start), counted from now; without an end it stays
// open. Rounded to the minute.
export function reuseEnd(alert: TimelineAlert, now: number): number | null {
  const exp = toMs(alert.expires_at);
  const start = startOf(alert);
  if (exp === null || exp <= start) return null;
  return Math.round((now + (exp - start)) / MINUTE) * MINUTE;
}

export function plainMessage(message: string): string {
  return String(message || "")
    .replace(/\[([^[\]\n]+)\]\(([^)\s]+)\)/g, "$1")
    .trim();
}

export function alertLabel(
  alert: Pick<TimelineAlert, "title" | "message">,
): string {
  return alert.title?.trim() || plainMessage(alert.message);
}

export type RangeKey = "day" | "week" | "month" | "quarter";

export const RANGES: Record<RangeKey, { back: number; fwd: number }> = {
  day: { back: DAY, fwd: 8 * HOUR },
  week: { back: 7 * DAY, fwd: 2 * DAY },
  month: { back: 30 * DAY, fwd: 8 * DAY },
  quarter: { back: 100 * DAY, fwd: 14 * DAY },
};

export function windowOf(range: RangeKey, now: number): [number, number] {
  return [now - RANGES[range].back, now + RANGES[range].fwd];
}

// The tightest of week / month / 3 months that reaches back to the oldest
// alert.
export function defaultRange(alerts: TimelineAlert[], now: number): RangeKey {
  if (!alerts.length) return "week";
  const oldest = Math.min(...alerts.map((a) => toMs(a.created_at) ?? now));
  return (
    (["week", "month", "quarter"] as RangeKey[]).find(
      (key) => now - RANGES[key].back <= oldest,
    ) ?? "quarter"
  );
}

// Gridlines: every 4 hours on the day view, then daily, every 5 days and
// every 2 weeks. Lines hugging the left edge or the Now line are dropped so
// their labels never collide.
export function ticksOf(
  range: RangeKey,
  t0: number,
  t1: number,
  now: number,
): number[] {
  const out: number[] = [];
  const d = new Date(t0);
  if (range === "day") {
    d.setMinutes(0, 0, 0);
    d.setHours(Math.ceil(d.getHours() / 4) * 4);
    for (let t = d.getTime(); t < t1; t += 4 * HOUR) out.push(t);
  } else {
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    const step = range === "week" ? 1 : range === "month" ? 5 : 14;
    for (let t = d.getTime(); t < t1; t += step * DAY) out.push(t);
  }
  const span = t1 - t0;
  return out.filter(
    (t) => t >= t0 + span * 0.02 && Math.abs(t - now) > span * 0.04,
  );
}

export type Segment = {
  // Left edge and width as fractions of the track.
  x: number;
  w: number;
  tone: "past" | "future" | "gone" | "off" | "ghost";
  open: boolean;
};

export type Bars = {
  // Always two segments, so a state change animates instead of swapping
  // elements: the first is the part behind Now, the second the part ahead.
  segments: [Segment, Segment];
  // Where the end-time marker sits while the alert is being edited.
  end: { x: number; open: boolean } | null;
};

// A stretch of time as a segment, clipped to the window; anything with
// length stays at least a sliver wide.
function spanOf(
  window: [number, number],
  from: number,
  to: number,
  tone: Segment["tone"],
  open = false,
): Segment {
  const [t0, t1] = window;
  const X = (t: number) => Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
  const x = X(from);
  const w = to <= from ? 0 : Math.max(0.006, X(to) - x);
  return { x, w, tone, open };
}

// `draft` draws a not-yet-created alert going up now; `editing` turns the
// part ahead of Now amber and adds the end marker.
export function barsOf(
  alert: TimelineAlert,
  window: [number, number],
  now: number,
  opts: { draft?: boolean; editing?: boolean } = {},
): Bars {
  const [t0, t1] = window;
  const span = t1 - t0;
  const X = (t: number) => Math.max(0, Math.min(1, (t - t0) / span));
  const seg = (
    from: number,
    to: number,
    tone: Segment["tone"],
    open = false,
  ): Segment => spanOf(window, from, to, tone, open);
  const nil = (tone: Segment["tone"]): Segment => seg(now, now, tone);

  if (opts.draft) {
    const exp = toMs(alert.expires_at);
    const open = exp === null;
    return {
      segments: [
        nil("past"),
        seg(now, open ? t1 : Math.min(exp, t1), "ghost", open),
      ],
      end: { x: open ? 1 : X(exp), open },
    };
  }

  const state = alertState(alert, now);
  const start = startOf(alert);
  const end = endOf(alert);
  if (state === "off") {
    return {
      segments: [
        seg(start, Math.max(end, start + span * 0.004), "off"),
        nil("future"),
      ],
      end: null,
    };
  }
  if (state === "expired") {
    return {
      segments: [seg(start, end, "gone"), nil("future")],
      end: opts.editing ? { x: X(end), open: false } : null,
    };
  }
  const open = end === Infinity;
  return {
    segments: [
      seg(start, now, "past"),
      seg(
        now,
        open ? t1 : Math.min(end, t1),
        opts.editing ? "ghost" : "future",
        open,
      ),
    ],
    end: opts.editing ? { x: open ? 1 : X(end), open } : null,
  };
}

// ---- On/off history ----

export type AlertActor = {
  name: string | null;
  steam_id: string | number;
} | null;

// A row of system_alert_activations: one period an alert was on.
// `estimated` rows were backfilled from created/updated for alerts turned
// off before the table existed.
export type AlertActivation = {
  alert_id: string;
  started_at: string;
  ended_at: string | null;
  estimated: boolean;
  started_by?: AlertActor;
  ended_by?: AlertActor;
};

export type Period = {
  key: string;
  start: number;
  // An open period ends at Now, or at expires_at when that came first:
  // nothing flips is_active when an alert expires.
  end: number;
  open: boolean;
  expired: boolean;
  estimated: boolean;
  startedBy: AlertActor;
  endedBy: AlertActor;
};

export function groupActivations(
  rows: AlertActivation[],
): Map<string, AlertActivation[]> {
  const out = new Map<string, AlertActivation[]>();
  for (const row of rows) {
    const list = out.get(row.alert_id);
    if (list) list.push(row);
    else out.set(row.alert_id, [row]);
  }
  return out;
}

// Two rows for the same start: a recorded row beats a backfilled one, then
// the one that ran longer.
function mergePeriods(a: Period, b: Period): Period {
  const keep =
    a.estimated !== b.estimated ? (a.estimated ? b : a) : b.end > a.end ? b : a;
  const other = keep === a ? b : a;
  return {
    ...keep,
    startedBy: keep.startedBy ?? other.startedBy,
    endedBy:
      keep.endedBy ??
      (!keep.open && other.end === keep.end ? other.endedBy : null),
  };
}

// The alert's periods that reach into the window, oldest first. A showing
// alert with no open period (the row not in yet, or never backfilled) gets
// one estimated from when it last went up.
export function periodsOf(
  alert: TimelineAlert,
  rows: AlertActivation[],
  window: [number, number],
  now: number,
): Period[] {
  const [t0, t1] = window;
  const exp = toMs(alert.expires_at);
  const openEnd = (start: number) =>
    Math.max(start, Math.min(now, exp ?? Infinity));
  const expired = exp !== null && exp <= now;
  const byStart = new Map<number, Period>();

  for (const row of rows) {
    const start = toMs(row.started_at);
    if (row.alert_id !== alert.id || start === null) continue;
    const ended = toMs(row.ended_at);
    const period: Period = {
      key: String(start),
      start,
      end: ended === null ? openEnd(start) : Math.max(start, ended),
      open: ended === null,
      expired: ended === null && expired,
      estimated: !!row.estimated,
      startedBy: row.started_by ?? null,
      endedBy: row.ended_by ?? null,
    };
    const seen = byStart.get(start);
    byStart.set(start, seen ? mergePeriods(seen, period) : period);
  }

  const periods = [...byStart.values()];
  if (alert.is_active && !periods.some((p) => p.open)) {
    const start = startOf(alert);
    periods.push({
      key: "estimate",
      start,
      end: openEnd(start),
      open: true,
      expired,
      estimated: true,
      startedBy: null,
      endedBy: null,
    });
  }
  return periods
    .filter((p) => p.start < t1 && p.end > t0)
    .sort((a, b) => a.start - b.start);
}

export type PeriodSegment = Segment & { key: string; period: Period };

export type HistoryBars = {
  periods: PeriodSegment[];
  // The stretch ahead of Now and the end marker, as barsOf draws them: the
  // schedule, not history.
  ahead: Segment;
  end: Bars["end"];
};

// Closed periods are grey like an alert that's off; the open one keeps the
// severity colour while showing and dims once expired.
export function historyBarsOf(
  alert: TimelineAlert,
  periods: Period[],
  window: [number, number],
  now: number,
  opts: { editing?: boolean } = {},
): HistoryBars {
  const state = alertState(alert, now);
  const plain = barsOf(alert, window, now, opts);
  return {
    periods: periods.map((period) => ({
      ...spanOf(
        window,
        period.start,
        period.end,
        !period.open || state === "off"
          ? "off"
          : period.expired
            ? "gone"
            : "past",
      ),
      key: period.key,
      period,
    })),
    ahead: plain.segments[1],
    end: plain.end,
  };
}

// `rows` is null while the api doesn't serve on/off history: the lane falls
// back to the created/updated estimate. Drafts have no history yet.
export type LaneBars =
  { kind: "estimate"; bars: Bars } | { kind: "history"; bars: HistoryBars };

export function laneBarsOf(
  alert: TimelineAlert,
  rows: AlertActivation[] | null,
  window: [number, number],
  now: number,
  opts: { draft?: boolean; editing?: boolean } = {},
): LaneBars {
  if (!rows || opts.draft) {
    return { kind: "estimate", bars: barsOf(alert, window, now, opts) };
  }
  return {
    kind: "history",
    bars: historyBarsOf(
      alert,
      periodsOf(alert, rows, window, now),
      window,
      now,
      opts,
    ),
  };
}

// With history, a lane belongs in the window when a period reaches into it
// (a showing alert always has one) or it was created inside it (an alert
// never turned on).
export function inWindowOf(
  alert: TimelineAlert,
  rows: AlertActivation[] | null,
  window: [number, number],
  now: number,
): boolean {
  if (!rows) return inWindow(alert, window[0]);
  return (
    periodsOf(alert, rows, window, now).length > 0 ||
    (toMs(alert.created_at) ?? 0) >= window[0]
  );
}

// Showing first, then off, then expired; newest first within each.
export function sortAlerts<T extends TimelineAlert>(
  alerts: T[],
  now: number,
): T[] {
  const rank: Record<AlertState, number> = { live: 0, off: 1, expired: 2 };
  return [...alerts].sort(
    (a, b) =>
      rank[alertState(a, now)] - rank[alertState(b, now)] ||
      (toMs(b.created_at) ?? 0) - (toMs(a.created_at) ?? 0),
  );
}

export function inWindow(alert: TimelineAlert, t0: number): boolean {
  return endOf(alert) >= t0;
}

export function showingSummary(alerts: TimelineAlert[], now: number) {
  const live = alerts.filter((a) => alertState(a, now) === "live");
  return {
    showing: live.length,
    locked: live.filter((a) => !a.dismissible).length,
  };
}

// The quick end-time chips: same as the picked end when within 5 minutes.
export function chipMatches(
  chip: number | null,
  exp: number | null,
  now: number,
): boolean {
  if (chip === null) return exp === null;
  return exp !== null && Math.abs(exp - (now + chip)) < 5 * MINUTE;
}

export function roundTo5Minutes(ms: number): number {
  return Math.round(ms / (5 * MINUTE)) * 5 * MINUTE;
}
