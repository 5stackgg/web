import { resolveAwardTier } from "~/utilities/awardSeed";
import { dateLocale } from "~/utilities/dateLocale";

export const AWARD_PAGE_SIZE = 30;
export const AWARD_RECENT_MS = 90 * 24 * 60 * 60 * 1000;
export const AWARD_TIERS = ["mvp", "gold", "silver", "bronze", "special"];

// Header and rows share one grid; below md the owner and last-granted
// columns drop out, and on phones the actions shrink to the menu alone.
export const awardLedgerColumns =
  "grid grid-cols-[minmax(0,1fr)_5.25rem_3.5rem_4.75rem] max-sm:grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_1.75rem] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5.75rem_4rem_6.5rem_6.75rem] items-center gap-x-3.5 max-sm:gap-x-2.5";

export type AwardOwnerKind = "tournament" | "event" | "league" | "season";
export type AwardOwnerPhase = "live" | "upcoming" | "finished" | "gone";
export type AwardBelongs = "builtin" | "global" | AwardOwnerKind;
export type AwardKind = "all" | "custom" | "builtin";
export type AwardSort = "last" | "holders" | "name";

export type AwardOwner = {
  kind: AwardOwnerKind;
  id: string;
  name: string | null;
  number: number | null;
  phase: AwardOwnerPhase;
  start: string | null;
  end: string | null;
  to: string | null;
};

const LIVE_TOURNAMENT = ["Live", "Paused", "CheckInReview"];
const DONE_TOURNAMENT = ["Finished", "Cancelled", "CancelledMinTeams"];
const LIVE_LEAGUE = ["Live", "Playoffs"];
const DONE_LEAGUE = ["Finished", "Canceled", "Cancelled"];

function byStatus(
  status: string | null | undefined,
  live: string[],
  done: string[],
) {
  if (status && live.includes(status)) return "live";
  if (status && done.includes(status)) return "finished";
  return "upcoming";
}

function byDates(
  start: string | null | undefined,
  end: string | null | undefined,
  now: number,
): AwardOwnerPhase {
  const from = start ? new Date(start).getTime() : NaN;
  const to = end ? new Date(end).getTime() : NaN;
  if (!Number.isNaN(from) && now < from) return "upcoming";
  if (!Number.isNaN(to) && now > to) return "finished";
  if (Number.isNaN(from) && Number.isNaN(to)) return "upcoming";
  return "live";
}

/** What an award belongs to and where that owner is in its life. */
export function awardOwner(award: any, now = Date.now()): AwardOwner | null {
  if (award?.tournament_id) {
    const owner = award.tournament;
    return {
      kind: "tournament",
      id: award.tournament_id,
      name: owner?.name ?? null,
      number: null,
      phase: owner
        ? byStatus(owner.status, LIVE_TOURNAMENT, DONE_TOURNAMENT)
        : "gone",
      start: owner?.start ?? null,
      end: null,
      to: owner ? `/tournaments/${award.tournament_id}` : null,
    };
  }
  if (award?.event_id) {
    const owner = award.event;
    return {
      kind: "event",
      id: award.event_id,
      name: owner?.name ?? null,
      number: null,
      phase: owner ? byDates(owner.starts_at, owner.ends_at, now) : "gone",
      start: owner?.starts_at ?? null,
      end: owner?.ends_at ?? null,
      to: owner ? `/events/${award.event_id}` : null,
    };
  }
  if (award?.league_season_id) {
    const owner = award.league_season;
    return {
      kind: "league",
      id: award.league_season_id,
      name: owner?.name ?? null,
      number: owner?.season_number ?? null,
      phase: owner ? byStatus(owner.status, LIVE_LEAGUE, DONE_LEAGUE) : "gone",
      start: owner?.starts_at ?? null,
      end: null,
      to: owner ? `/league/seasons/${award.league_season_id}` : null,
    };
  }
  if (award?.season_id) {
    const owner = award.season;
    return {
      kind: "season",
      id: award.season_id,
      name: null,
      number: owner?.number ?? null,
      phase: owner ? byDates(owner.starts_at, owner.ends_at, now) : "gone",
      start: owner?.starts_at ?? null,
      end: owner?.ends_at ?? null,
      to: null,
    };
  }
  return null;
}

export function isBuiltIn(award: any): boolean {
  return !!award?.system_key;
}

export function belongsTo(award: any): AwardBelongs {
  if (isBuiltIn(award)) return "builtin";
  return awardOwner(award)?.kind ?? "global";
}

export function holderCount(award: any): number {
  return award?.recipients_aggregate?.aggregate?.count ?? 0;
}

export function lastGrantedAt(award: any): number | null {
  const at = award?.recipients_aggregate?.aggregate?.max?.created_at;
  if (!at) return null;
  const time = new Date(at).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * The Status facet's values an award carries: granted lately or never, and
 * whether its owner is still running. An award can carry two.
 */
export function awardStatusKeys(award: any, now = Date.now()): string[] {
  const keys: string[] = [];
  const last = lastGrantedAt(award);
  if (last === null) keys.push("never");
  else if (now - last < AWARD_RECENT_MS) keys.push("recent");
  const owner = awardOwner(award, now);
  if (owner) {
    keys.push(
      owner.phase === "live" || owner.phase === "upcoming"
        ? "open"
        : "finished",
    );
  }
  return keys;
}

export function awardFacetValues(award: any, key: string, now = Date.now()) {
  if (key === "owner") return belongsTo(award);
  if (key === "tier") return resolveAwardTier(null, award?.tier);
  if (key === "status") return awardStatusKeys(award, now);
  return [];
}

export function matchesKind(award: any, kind: AwardKind): boolean {
  if (kind === "all") return true;
  return (kind === "builtin") === isBuiltIn(award);
}

export function matchesSearch(
  award: any,
  term: string,
  ownerLabel = "",
): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return `${award?.name ?? ""} ${award?.description ?? ""} ${ownerLabel}`
    .toLowerCase()
    .includes(q);
}

const byName = (a: any, b: any) =>
  String(a?.name ?? "").localeCompare(String(b?.name ?? ""));

/**
 * Each column sorts its natural way first (name A–Z, most holders, most
 * recently granted); `reverse` flips it, as a second click on the header does.
 */
export function sortAwards(
  list: any[],
  sort: AwardSort,
  reverse = false,
): any[] {
  const sorted = [...list];
  if (sort === "name") sorted.sort(byName);
  else if (sort === "holders") {
    sorted.sort((a, b) => holderCount(b) - holderCount(a) || byName(a, b));
  } else {
    sorted.sort(
      (a, b) =>
        (lastGrantedAt(b) ?? 0) - (lastGrantedAt(a) ?? 0) || byName(a, b),
    );
  }
  return reverse ? sorted.reverse() : sorted;
}

type Translate = (key: string, values?: Record<string, unknown>) => string;

const formatMonth = (iso: string) =>
  new Date(iso).toLocaleDateString(dateLocale(), {
    month: "short",
    year: "numeric",
  });
const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  });

export function ownerLabel(owner: AwardOwner | null, t: Translate): string {
  if (!owner) return "";
  if (owner.kind === "season" && owner.number !== null) {
    return t("pages.awards.season_label", { number: owner.number });
  }
  return owner.name ?? t("pages.awards.scope_gone");
}

export function ownerStatusText(
  owner: AwardOwner | null,
  t: Translate,
): string {
  if (!owner) return "";
  if (owner.phase === "gone") return t("pages.awards.owner_deleted");
  if (owner.phase === "live") {
    return owner.kind === "tournament" || owner.kind === "event"
      ? t("pages.awards.owner_live")
      : t("pages.awards.owner_running");
  }
  if (owner.phase === "upcoming") {
    return owner.start
      ? t("pages.awards.owner_starts", { date: formatDay(owner.start) })
      : t("pages.awards.owner_upcoming");
  }
  if (!owner.end) return t("common.finished");
  return owner.kind === "season"
    ? t("pages.awards.owner_ended", { date: formatMonth(owner.end) })
    : t("pages.awards.owner_finished", { date: formatMonth(owner.end) });
}

/** What hands a built-in out, for the Belongs to column. */
export function automationLabel(award: any, t: Translate): string {
  const key = String(award?.system_key ?? "");
  if (key.startsWith("season_")) return t("pages.awards.automation_season");
  if (key.startsWith("tournament_")) {
    return t("pages.awards.automation_tournament");
  }
  return t("pages.awards.built_in");
}

export function formatAwardDate(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Splits text around every case-insensitive hit of `term`. */
export function highlightParts(
  text: string | null | undefined,
  term: string,
): Array<{ text: string; hit: boolean }> {
  const value = String(text ?? "");
  const q = term.trim().toLowerCase();
  if (!q) return [{ text: value, hit: false }];
  const parts: Array<{ text: string; hit: boolean }> = [];
  const lower = value.toLowerCase();
  let at = 0;
  while (at < value.length) {
    const found = lower.indexOf(q, at);
    if (found < 0) break;
    if (found > at) parts.push({ text: value.slice(at, found), hit: false });
    parts.push({ text: value.slice(found, found + q.length), hit: true });
    at = found + q.length;
  }
  if (at < value.length) parts.push({ text: value.slice(at), hit: false });
  return parts.length ? parts : [{ text: value, hit: false }];
}
