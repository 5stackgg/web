import { dateLocale } from "~/utilities/dateLocale";

// The /bans ledger: one row per recently banned player, from Steam (VAC and
// game bans, which Steam dates to the day only) and from 5Stack (a ban
// sanction, issued by staff or automatically for a VAC ban).

export type BanKind = "vac" | "game" | "staff" | "auto";
export type BanSource = "all" | "steam" | "5stack";
export type BanStatus = "any" | "banned_here" | "not_banned_here";
export type BanTiming = "any" | "played_first" | "arrived_banned";
export type PlayedWith = "any" | "either" | "opponent" | "teammate";

export const BAN_KINDS: BanKind[] = ["vac", "game", "staff", "auto"];
export const STEAM_KINDS: BanKind[] = ["vac", "game"];
export const FIVESTACK_KINDS: BanKind[] = ["staff", "auto"];
export const BAN_WINDOWS = [7, 30, 90] as const;
export const DEFAULT_BAN_WINDOW = 30;

export type BanFilters = {
  search: string;
  source: BanSource;
  windowDays: number;
  kinds: Record<BanKind, boolean>;
  status: BanStatus;
  timing: BanTiming;
  playedWith: PlayedWith;
  lostOnly: boolean;
};

export type SharedMatch = {
  match_id: string;
  played_at: string;
  map: string | null;
  viewer_score: number;
  other_score: number;
  won: boolean | null;
  side: "teammate" | "opponent";
};

export type BanEntry = {
  steam_id: string;
  banned_at: string;
  banned_at_source: "steam" | "5stack";
  steam_banned_on: string | null;
  vac_ban_count: number;
  game_ban_count: number;
  sanction_id: string | null;
  sanction_kind: "staff" | "auto" | null;
  banned_here: boolean;
  first_match_at: string | null;
  last_match_at: string | null;
  last_match_map: string | null;
  matches_played: number;
  matches_since_steam_ban: number | null;
  arrived_banned: boolean;
  shared_matches: SharedMatch[] | null;
  player: Record<string, any> | null;
  sanction: {
    id: string;
    reason: string | null;
    created_at: string;
    remove_sanction_date: string | null;
    sanctioned_by: { steam_id: string; name: string } | null;
  } | null;
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export function defaultBanFilters(): BanFilters {
  return {
    search: "",
    source: "all",
    windowDays: DEFAULT_BAN_WINDOW,
    kinds: { vac: true, game: true, staff: true, auto: true },
    status: "any",
    timing: "any",
    playedWith: "any",
    lostOnly: false,
  };
}

export function sourceAllows(source: BanSource, kind: BanKind): boolean {
  if (source === "steam") return STEAM_KINDS.includes(kind);
  if (source === "5stack") return FIVESTACK_KINDS.includes(kind);
  return true;
}

export function kindOn(filters: BanFilters, kind: BanKind): boolean {
  return filters.kinds[kind] && sourceAllows(filters.source, kind);
}

export function requestedKinds(filters: BanFilters): BanKind[] {
  return BAN_KINDS.filter((kind) => kindOn(filters, kind));
}

// "Only matches I lost" on its own still means "played with me".
export function playedWithArg(filters: BanFilters): PlayedWith {
  return filters.lostOnly && filters.playedWith === "any"
    ? "either"
    : filters.playedWith;
}

export function playedWithOn(filters: BanFilters): boolean {
  return playedWithArg(filters) !== "any";
}

// The arguments of the api's recently_banned_players function. `_kinds` is a
// Postgres text[], which Hasura takes as an array literal string; it is left
// out when every kind is on, so the function's default applies.
export function banQueryArgs(filters: BanFilters) {
  const search = filters.search.trim();
  const kinds = requestedKinds(filters);
  return {
    _window_days: filters.windowDays,
    ...(kinds.length === BAN_KINDS.length
      ? {}
      : { _kinds: `{${kinds.join(",")}}` }),
    _status: filters.status,
    _timing: filters.timing,
    _played_with: playedWithArg(filters),
    _lost_only: filters.lostOnly,
    _search: search || null,
  };
}

// What the Filters menu holds: a partial Steam or 5Stack kind set, Banned
// here and Timing. Search, source, window and Played with me sit in the bar.
export function menuFilterCount(filters: BanFilters): number {
  let count = 0;
  if (!filters.kinds.vac || !filters.kinds.game) count++;
  if (!filters.kinds.staff || !filters.kinds.auto) count++;
  if (filters.status !== "any") count++;
  if (filters.timing !== "any") count++;
  return count;
}

export function hasBanFilters(filters: BanFilters): boolean {
  return (
    !!filters.search.trim() ||
    filters.source !== "all" ||
    filters.windowDays !== DEFAULT_BAN_WINDOW ||
    playedWithOn(filters) ||
    menuFilterCount(filters) > 0
  );
}

/* ---------- dates ---------- */

// A Steam ban is a UTC calendar day ("days since last ban" counted back from
// when the api last asked Steam), so it is read and printed in UTC: a ban on
// Oct 19 stays Oct 19 whatever the viewer's time zone.
export function steamDayMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function steamDaysAgo(day: string, now: Date): number {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.max(0, Math.round((today - steamDayMs(day)) / DAY));
}

const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase(dateLocale()) + text.slice(1);

export function steamDateLabel(day: string, now: Date): string {
  const date = new Date(steamDayMs(day));
  return date.toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
    year:
      date.getUTCFullYear() === now.getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  });
}

// "Today", "Yesterday", "3 days ago", then the date.
export function steamDayLabel(day: string, now: Date): string {
  const ago = steamDaysAgo(day, now);
  if (ago < 7) {
    return capitalize(
      new Intl.RelativeTimeFormat(dateLocale(), { numeric: "auto" }).format(
        -ago,
        "day",
      ),
    );
  }
  return steamDateLabel(day, now);
}

export function dateLabel(value: string | number, now: Date): string {
  const date = new Date(value);
  return date.toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function dateTimeLabel(value: string | number, now: Date): string {
  const date = new Date(value);
  return date.toLocaleString(dateLocale(), {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ---------- length ---------- */

export type BanLength =
  | { state: "permanent" }
  | {
      state: "active";
      unit: "day" | "hour";
      total: number;
      leftUnit: "day" | "hour";
      left: number;
    }
  | { state: "ended"; endedAt: string };

export function banLength(
  createdAt: string,
  removeAt: string | null,
  now: Date,
): BanLength {
  if (!removeAt) {
    return { state: "permanent" };
  }
  const end = Date.parse(removeAt);
  if (end <= now.getTime()) {
    return { state: "ended", endedAt: removeAt };
  }
  const total = end - Date.parse(createdAt);
  const left = end - now.getTime();
  return {
    state: "active",
    unit: total < DAY ? "hour" : "day",
    total:
      total < DAY
        ? Math.max(1, Math.round(total / HOUR))
        : Math.round(total / DAY),
    leftUnit: left < DAY ? "hour" : "day",
    left:
      left < DAY ? Math.max(1, Math.ceil(left / HOUR)) : Math.ceil(left / DAY),
  };
}

// "Cheating: aimlock confirmed in…" → "Cheating". Only a short label before
// a colon counts; anything else stays in the full reason.
export function reasonCategory(
  reason: string | null | undefined,
): string | null {
  if (!reason) return null;
  const at = reason.indexOf(":");
  if (at <= 0 || at > 32) return null;
  return reason.slice(0, at).trim() || null;
}

/* ---------- played with me ---------- */

export function sharedMatchesOf(
  entry: Pick<BanEntry, "shared_matches">,
): SharedMatch[] {
  return Array.isArray(entry.shared_matches) ? entry.shared_matches : [];
}

export function sharedSide(
  matches: SharedMatch[],
): "teammate" | "opponent" | "both" | null {
  if (!matches.length) return null;
  const sides = new Set(matches.map((match) => match.side));
  return sides.size > 1 ? "both" : (matches[0].side as "teammate" | "opponent");
}

// Over every row: a match two banned players were both in counts once.
export function sharedSummary(entries: Pick<BanEntry, "shared_matches">[]) {
  const matches = new Map<string, SharedMatch>();
  for (const entry of entries) {
    for (const match of sharedMatchesOf(entry)) {
      matches.set(match.match_id, match);
    }
  }
  const all = [...matches.values()];
  return {
    matches: all.length,
    lost: all.filter((match) => match.won === false).length,
  };
}

/* ---------- what happened ---------- */

export type BanTimelineItem =
  | {
      type: "steam";
      at: number;
      day: string;
      vac: number;
      game: number;
      arrived: boolean;
    }
  | { type: "first_match"; at: number; only: boolean }
  | {
      type: "sanction";
      at: number;
      kind: "staff" | "auto";
      by: string | null;
      length: BanLength;
    }
  | { type: "sanction_end"; at: number }
  | {
      type: "last_match";
      at: number;
      map: string | null;
      since: number | null;
    };

export function steamBanned(
  entry: Pick<BanEntry, "vac_ban_count" | "game_ban_count" | "steam_banned_on">,
): boolean {
  return (
    !!entry.steam_banned_on &&
    (entry.vac_ban_count > 0 || entry.game_ban_count > 0)
  );
}

// Oldest first. A Steam ban sits at the start of its UTC day, so the
// automatic ban it caused the same day always lands after it.
export function banTimeline(entry: BanEntry, now: Date): BanTimelineItem[] {
  const items: BanTimelineItem[] = [];

  if (steamBanned(entry)) {
    items.push({
      type: "steam",
      at: steamDayMs(entry.steam_banned_on!),
      day: entry.steam_banned_on!,
      vac: entry.vac_ban_count,
      game: entry.game_ban_count,
      arrived: entry.arrived_banned,
    });
  }

  if (entry.first_match_at && entry.matches_played > 0) {
    items.push({
      type: "first_match",
      at: Date.parse(entry.first_match_at),
      only: entry.matches_played === 1,
    });
  }

  if (entry.sanction) {
    const length = banLength(
      entry.sanction.created_at,
      entry.sanction.remove_sanction_date,
      now,
    );
    items.push({
      type: "sanction",
      at: Date.parse(entry.sanction.created_at),
      kind:
        entry.sanction_kind ??
        (entry.sanction.sanctioned_by ? "staff" : "auto"),
      by: entry.sanction.sanctioned_by?.name ?? null,
      length,
    });
    if (length.state === "ended") {
      items.push({ type: "sanction_end", at: Date.parse(length.endedAt) });
    }
  }

  if (entry.last_match_at && entry.matches_played > 1) {
    items.push({
      type: "last_match",
      at: Date.parse(entry.last_match_at),
      map: entry.last_match_map,
      since:
        steamBanned(entry) && !entry.banned_here
          ? entry.matches_since_steam_ban
          : null,
    });
  }

  return items.sort((a, b) => a.at - b.at);
}
