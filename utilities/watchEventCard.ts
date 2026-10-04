import { e_match_types_enum, e_tournament_status_enum } from "~/generated/zeus";
import { EXPECTED_PLAYERS } from "~/utilities/matchmakingPartySize";

const DAY_MS = 86_400_000;

function localMidnight(value: string | Date) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Calendar days, not 24h windows: an event running Fri 18:00 to Sun 02:00 is
// three days, and Saturday morning is day 2.
export function eventDayProgress(
  startsAt?: string | null,
  endsAt?: string | null,
  now: Date = new Date(),
): { day: number; total: number | null } | null {
  if (!startsAt) return null;
  const start = localMidnight(startsAt);
  const today = localMidnight(now);
  if (today < start) return null;

  const day = Math.round((today.getTime() - start.getTime()) / DAY_MS) + 1;
  if (!endsAt) return { day, total: null };

  const total =
    Math.round((localMidnight(endsAt).getTime() - start.getTime()) / DAY_MS) +
    1;
  if (total < 1) return null;
  return { day: Math.min(day, total), total };
}

export function formatEventRange(
  startsAt?: string | null,
  endsAt?: string | null,
): string | null {
  if (!startsAt) return null;
  const format = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  const start = new Date(startsAt);
  if (
    !endsAt ||
    localMidnight(startsAt).getTime() === localMidnight(endsAt).getTime()
  ) {
    return format.format(start);
  }
  const end = new Date(endsAt);
  return typeof format.formatRange === "function"
    ? format.formatRange(start, end)
    : `${format.format(start)} – ${format.format(end)}`;
}

// "Sat 19:00" inside the coming week, a date after that. `short` drops the
// time on other days ("Sat") for narrow step labels.
export function formatStartTime(
  value?: string | null,
  now: Date = new Date(),
  short = false,
) {
  if (!value) return null;
  const date = new Date(value);
  const days = Math.round(
    (localMidnight(date).getTime() - localMidnight(now).getTime()) / DAY_MS,
  );
  if (days === 0) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  if (days > 0 && days < 7) {
    return new Intl.DateTimeFormat(
      undefined,
      short
        ? { weekday: "short" }
        : { weekday: "short", hour: "2-digit", minute: "2-digit" },
    ).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

// "5v5" / "2v2" / "1v1" -- demo-only types (Premier, Faceit) are 5v5.
export function matchTypeLabel(type?: string | null) {
  const players = EXPECTED_PLAYERS[type as e_match_types_enum] ?? 10;
  const side = players / 2;
  return `${side}v${side}`;
}

export type TournamentRowState = "live" | "finished" | "upcoming";

export function tournamentRowState(status?: string | null): TournamentRowState {
  if (
    status === e_tournament_status_enum.Live ||
    status === e_tournament_status_enum.Paused
  ) {
    return "live";
  }
  if (
    status === e_tournament_status_enum.Finished ||
    status === e_tournament_status_enum.Cancelled ||
    status === e_tournament_status_enum.CancelledMinTeams
  ) {
    return "finished";
  }
  return "upcoming";
}

function teamName(entry: any): string | null {
  return entry?.team?.name || entry?.team?.short_name || entry?.name || null;
}

// The awarded winner first, then the final stage's standings when awards
// were never issued (same order as TournamentCompactCard's podium).
export function tournamentChampion(tournament: any): string | null {
  const award = (tournament?.awards || []).find(
    (row: any) => row.placement === 1,
  );
  if (award) {
    const name = teamName(award.tournament_team);
    if (name) return name;
  }

  const finalStage = [...(tournament?.stages || [])].sort(
    (a: any, b: any) => (Number(b.order) || 0) - (Number(a.order) || 0),
  )[0];
  const winner = (finalStage?.results || []).find(
    (row: any) => Number(row.rank) === 1,
  );
  return winner ? teamName(winner.team) : null;
}

// Same precedence as EventHero: the creator unless hidden, then co-organizers.
export function eventOrganizerNames(event: any): string[] {
  const names: string[] = [];
  if (!event?.hide_creator_organizer && event?.organizer?.name) {
    names.push(event.organizer.name);
  }
  for (const entry of event?.organizers || []) {
    if (String(entry.steam_id) === String(event.organizer_steam_id)) continue;
    if (entry.organizer?.name) names.push(entry.organizer.name);
  }
  return names;
}
