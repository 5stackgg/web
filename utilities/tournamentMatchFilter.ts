import { e_match_status_enum } from "~/generated/zeus";

export type TournamentMatchFilter = "live" | "upcoming" | "results" | "all";
export type TournamentMatchBucket =
  | Exclude<TournamentMatchFilter, "all">
  | "other";

type TimedMatch = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

// PickingPlayers is not in the /watch ticker's live set (there is nothing to
// stream), but on a tournament's own list it is a match already under way.
const BUCKETS: Record<e_match_status_enum, TournamentMatchBucket> = {
  [e_match_status_enum.Live]: "live",
  [e_match_status_enum.WaitingForServer]: "live",
  [e_match_status_enum.Veto]: "live",
  [e_match_status_enum.WaitingForCheckIn]: "live",
  [e_match_status_enum.PickingPlayers]: "live",
  [e_match_status_enum.Scheduled]: "upcoming",
  [e_match_status_enum.Finished]: "results",
  [e_match_status_enum.Forfeit]: "results",
  [e_match_status_enum.Surrendered]: "results",
  [e_match_status_enum.Tie]: "results",
  [e_match_status_enum.Canceled]: "other",
};

const BUCKET_ORDER: TournamentMatchBucket[] = [
  "live",
  "upcoming",
  "results",
  "other",
];

const LIVE_STEPS: string[] = [
  e_match_status_enum.Live,
  e_match_status_enum.WaitingForServer,
  e_match_status_enum.Veto,
  e_match_status_enum.WaitingForCheckIn,
  e_match_status_enum.PickingPlayers,
];

export function matchBucket(
  status: string | null | undefined,
): TournamentMatchBucket {
  if (!status || !Object.prototype.hasOwnProperty.call(BUCKETS, status)) {
    return "other";
  }
  return BUCKETS[status as e_match_status_enum];
}

function time(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function lastMoment(match: TimedMatch) {
  return (
    time(match.ended_at) ??
    time(match.started_at) ??
    time(match.scheduled_at) ??
    time(match.created_at) ??
    0
  );
}

function withinBucket(
  bucket: TournamentMatchBucket,
  a: TimedMatch,
  b: TimedMatch,
) {
  if (bucket === "live") {
    const step =
      LIVE_STEPS.indexOf(a.status ?? "") - LIVE_STEPS.indexOf(b.status ?? "");
    if (step !== 0) {
      return step;
    }
    return lastMoment(b) - lastMoment(a);
  }
  if (bucket === "upcoming") {
    const at = time(a.scheduled_at);
    const bt = time(b.scheduled_at);
    if (at !== bt) {
      return (at ?? Infinity) - (bt ?? Infinity);
    }
    return (time(a.created_at) ?? 0) - (time(b.created_at) ?? 0);
  }
  return lastMoment(b) - lastMoment(a);
}

export function orderTournamentMatches<T extends TimedMatch>(
  matches: T[],
): T[] {
  return [...matches].sort((a, b) => {
    const aBucket = matchBucket(a.status);
    const bBucket = matchBucket(b.status);
    const byBucket =
      BUCKET_ORDER.indexOf(aBucket) - BUCKET_ORDER.indexOf(bBucket);
    if (byBucket !== 0) {
      return byBucket;
    }
    return withinBucket(aBucket, a, b) || a.id.localeCompare(b.id);
  });
}

export function tournamentMatchesFor<T extends TimedMatch>(
  matches: T[],
  filter: TournamentMatchFilter,
): T[] {
  const ordered = orderTournamentMatches(matches);
  if (filter === "all") {
    return ordered;
  }
  return ordered.filter((match) => matchBucket(match.status) === filter);
}

export function countTournamentMatches(
  matches: TimedMatch[],
): Record<TournamentMatchFilter, number> {
  const counts = { live: 0, upcoming: 0, results: 0, all: matches.length };
  for (const match of matches) {
    const bucket = matchBucket(match.status);
    if (bucket !== "other") {
      counts[bucket] += 1;
    }
  }
  return counts;
}
