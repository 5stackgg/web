import { dateLocale } from "~/utilities/dateLocale";

// Pure helpers behind /play's "More ways to play" so the layout rules can be
// tested without the data layer.

export type PlayWay = "server" | "scrims" | "practice";

// The panel beside the big card lists the other ways in this order.
const PANEL_ORDER: PlayWay[] = ["scrims", "server", "practice"];

// The liveliest way gets the big card: people on a public server, then teams
// looking for a scrim today, then practice. When none of those is on, the
// first way on offer takes it. A null count means that way isn't offered.
export function playWays(offer: {
  serverPlayers: number | null;
  scrimsToday: number | null;
  practice: boolean;
}): { featured: PlayWay | null; others: PlayWay[] } {
  const available = PANEL_ORDER.filter((way) =>
    way === "server"
      ? offer.serverPlayers !== null
      : way === "scrims"
        ? offer.scrimsToday !== null
        : offer.practice,
  );
  const featured: PlayWay | null = offer.serverPlayers
    ? "server"
    : offer.scrimsToday
      ? "scrims"
      : offer.practice
        ? "practice"
        : (available[0] ?? null);
  return { featured, others: available.filter((way) => way !== featured) };
}

// Busiest first; ties keep their incoming order (the query sorts by label).
export function busiestServer<T extends { players: number }>(
  servers: T[],
): T | null {
  return servers.reduce<T | null>(
    (best, server) => (!best || server.players > best.players ? server : best),
    null,
  );
}

type ScrimPosting = {
  team_id: string;
  team?: {
    name?: string | null;
    avatar_url?: string | null;
    scrim_availability?: Array<{
      starts_at: string;
      ends_at?: string | null;
      recurring_weekly?: boolean | null;
    }> | null;
  } | null;
};

export type ScrimTeamToday = {
  id: string;
  name: string;
  avatarUrl: string | null;
  // Its first start and last end today; only the time of day counts.
  from: Date;
  to: Date | null;
};

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

// Teams (other than the viewer's own) with a scrim window that falls on
// today, once each however many windows they posted, earliest first. Same
// matching as the scrim finder's "today" list.
export function scrimTeamsToday(
  postings: ScrimPosting[],
  excludeTeamIds: string[],
  now = new Date(),
): ScrimTeamToday[] {
  const teams = new Map<string, ScrimTeamToday>();

  for (const posting of postings) {
    if (excludeTeamIds.includes(posting.team_id)) continue;
    const windows = (posting.team?.scrim_availability ?? []).filter(
      (window) => {
        const start = new Date(window.starts_at);
        return window.recurring_weekly
          ? start.getDay() === now.getDay()
          : start.toDateString() === now.toDateString();
      },
    );
    if (!windows.length) continue;

    const starts = windows.map((window) => new Date(window.starts_at));
    const ends = windows
      .filter((window) => window.ends_at)
      .map((window) => new Date(window.ends_at!));
    const previous = teams.get(posting.team_id);
    if (previous) {
      starts.push(previous.from);
      if (previous.to) ends.push(previous.to);
    }
    teams.set(posting.team_id, {
      id: posting.team_id,
      name: posting.team?.name ?? "",
      avatarUrl: posting.team?.avatar_url ?? null,
      from: starts.reduce((a, b) => (minuteOfDay(a) <= minuteOfDay(b) ? a : b)),
      to: ends.length
        ? ends.reduce((a, b) => (minuteOfDay(a) >= minuteOfDay(b) ? a : b))
        : null,
    });
  }

  return [...teams.values()].sort(
    (a, b) => minuteOfDay(a.from) - minuteOfDay(b.from),
  );
}

export function scrimWindowLabel(team: ScrimTeamToday): string {
  const time = (date: Date) =>
    date.toLocaleTimeString(dateLocale(), {
      hour: "numeric",
      minute: "2-digit",
    });
  return team.to ? `${time(team.from)} – ${time(team.to)}` : time(team.from);
}

export function formatDay(value: string): string {
  return new Intl.DateTimeFormat(dateLocale(), {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
