// The calendar grid, agenda list and fixture dialog all read the same `Fixture`,
// so a match can never look "unscheduled" in one view and "agreed" in another.

export interface Proposal {
  id: string;
  proposed_time: string;
  status: string;
  message: string | null;
  proposed_by_steam_id: string;
  proposed_by?: { steam_id: string; name: string } | null;
}

export interface BracketTeam {
  id: string;
  name: string;
  team_id: string | null;
}

export interface Bracket {
  id: string;
  round: number;
  match_number: number;
  scheduled_at: string | null;
  finished: boolean;
  bye?: boolean;
  match_id: string | null;
  tournament_team_id_1: string | null;
  tournament_team_id_2: string | null;
  team_1: BracketTeam | null;
  team_2: BracketTeam | null;
  match: {
    id: string;
    status: string;
    scheduled_at: string | null;
    winning_lineup_id: string | null;
    lineup_1_id: string;
    lineup_2_id: string;
    // Optional: the season selection doesn't request scores, so result chips
    // degrade to a bare Won/Lost when they're absent.
    lineup_1_score?: number | null;
    lineup_2_score?: number | null;
  } | null;
  scheduling_proposals: Proposal[];
}

export interface MatchWeek {
  id: string;
  week_number: number;
  opens_at: string;
  closes_at: string;
  default_match_at: string;
}

export type FixtureStatus =
  | "bye"
  | "finished"
  | "live"
  | "pending-me"
  | "pending-them"
  | "agreed"
  | "default";

export interface Fixture {
  bracket: Bracket;
  week: MatchWeek;
  weekNumber: number;
  bestOf: number | null;
  bye: boolean;
  mine: boolean;
  /** The time this match is expected at — agreed, else the week's default night. */
  date: Date;
  /** False when `date` is only the week's fallback, i.e. nobody has agreed a time. */
  exact: boolean;
  status: FixtureStatus;
  /** Blocking the viewer: their game is unscheduled, or a proposal awaits their answer. */
  needsMe: boolean;
  pending: Proposal[];
  history: Proposal[];
  /** Null when the viewer manages neither side (admin browsing the division). */
  won: boolean | null;
  score: string | null;
  myTeam: BracketTeam | null;
  opponent: BracketTeam | null;
}

const FINISHED_STATUSES = ["Finished", "Forfeit", "Surrendered"];
const NOT_STARTED_STATUSES = ["Scheduled", "WaitingForCheckIn"];

export function startOfDay(value: Date | string): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date | string): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

/** Local-calendar day key. Not `toISOString()` — that would bucket by UTC day. */
export function dayKey(value: Date | string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function weekForDay(weeks: MatchWeek[], day: Date): MatchWeek | undefined {
  return weeks.find(
    (week) =>
      day >= startOfDay(week.opens_at) && day <= endOfDay(week.closes_at),
  );
}

/** `hh:mm` in the viewer's zone — seeds the propose dialog's time input. */
export function localTimeInput(value: Date | string): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function pendingProposals(bracket: Bracket): Proposal[] {
  return (bracket.scheduling_proposals ?? []).filter(
    (proposal) => proposal.status === "Pending",
  );
}

export function canRespondTo(
  bracket: Bracket,
  proposal: Proposal,
  options: { isAdmin: boolean; mySteamId?: string | null; mine: boolean },
): boolean {
  if (proposal.status !== "Pending") {
    return false;
  }
  if (options.isAdmin) {
    return true;
  }
  // The proposing side can't accept its own offer; the DB trigger enforces it,
  // we just avoid rendering a dead button.
  return options.mine && proposal.proposed_by_steam_id !== options.mySteamId;
}

export function buildFixtures(
  brackets: Bracket[],
  weeks: MatchWeek[],
  options: {
    managedTeamIds: string[];
    isAdmin: boolean;
    mySteamId?: string | null;
    weekBestOf?: Record<string, number>;
    defaultBestOf?: number;
  },
): Fixture[] {
  const weekByNumber = new Map(weeks.map((week) => [week.week_number, week]));

  return brackets.flatMap((bracket) => {
    const week = weekByNumber.get(bracket.round);
    if (!week) {
      return [];
    }

    const managesTeam1 =
      !!bracket.team_1?.team_id &&
      options.managedTeamIds.includes(bracket.team_1.team_id);
    const managesTeam2 =
      !!bracket.team_2?.team_id &&
      options.managedTeamIds.includes(bracket.team_2.team_id);
    const mine = managesTeam1 || managesTeam2;

    const myTeam = managesTeam1
      ? bracket.team_1
      : managesTeam2
        ? bracket.team_2
        : null;
    const opponent = managesTeam1
      ? bracket.team_2
      : managesTeam2
        ? bracket.team_1
        : (bracket.team_2 ?? null);

    const pending = pendingProposals(bracket);
    const history = (bracket.scheduling_proposals ?? []).filter(
      (proposal) => proposal.status !== "Pending",
    );

    // A match row wins over the bracket's agreed time: once the match exists,
    // `matches.scheduled_at` is what the server actually runs on.
    const agreedAt = bracket.match?.scheduled_at ?? bracket.scheduled_at;
    const exact = !!agreedAt;
    // Nothing agreed yet: show the newest offer on the table (proposals arrive
    // ordered `created_at desc`) rather than the week's default night — a chip
    // reading "they proposed" has to sit on the time they proposed.
    const date = new Date(
      agreedAt ?? pending[0]?.proposed_time ?? week.default_match_at,
    );

    const match = bracket.match;
    const isFinished = !!match && FINISHED_STATUSES.includes(match.status);
    const isLive = !!match && !isFinished && !NOT_STARTED_STATUSES.includes(match.status);

    let won: boolean | null = null;
    let score: string | null = null;
    if (isFinished && match) {
      const myLineupId = managesTeam1
        ? match.lineup_1_id
        : managesTeam2
          ? match.lineup_2_id
          : null;
      if (myLineupId && match.winning_lineup_id) {
        won = match.winning_lineup_id === myLineupId;
      }
      if (
        match.lineup_1_score !== null &&
        match.lineup_1_score !== undefined &&
        match.lineup_2_score !== null &&
        match.lineup_2_score !== undefined
      ) {
        const [first, second] = managesTeam2
          ? [match.lineup_2_score, match.lineup_1_score]
          : [match.lineup_1_score, match.lineup_2_score];
        score = `${first}–${second}`;
      }
    }

    // An admin can respond to any proposal, including one they made themselves —
    // that makes them able to act, not blocked. Only somebody else's standing
    // offer is actually waiting on the viewer.
    const awaitingMyAnswer = pending.some(
      (proposal) =>
        proposal.proposed_by_steam_id !== options.mySteamId &&
        canRespondTo(bracket, proposal, {
          isAdmin: options.isAdmin,
          mySteamId: options.mySteamId,
          mine,
        }),
    );

    let status: FixtureStatus;
    if (bracket.bye) {
      status = "bye";
    } else if (isFinished) {
      status = "finished";
    } else if (isLive) {
      status = "live";
    } else if (pending.length) {
      status = awaitingMyAnswer ? "pending-me" : "pending-them";
    } else if (exact) {
      status = "agreed";
    } else {
      status = "default";
    }

    const needsMe =
      !bracket.bye &&
      !match &&
      (mine || options.isAdmin) &&
      (status === "default" || awaitingMyAnswer);

    return [
      {
        bracket,
        week,
        weekNumber: bracket.round,
        bestOf:
          options.weekBestOf?.[String(week.week_number)] ??
          options.defaultBestOf ??
          null,
        bye: !!bracket.bye,
        mine,
        date,
        exact,
        status,
        needsMe,
        pending,
        history,
        won,
        score,
        myTeam,
        opponent,
      },
    ];
  });
}

/** A fixture can still be moved while it hasn't started and both teams are known. */
export function reschedulable(fixture: Fixture): boolean {
  const { bracket } = fixture;
  if (bracket.bye || bracket.finished) {
    return false;
  }
  if (!bracket.tournament_team_id_1 || !bracket.tournament_team_id_2) {
    return false;
  }
  if (!bracket.match) {
    return true;
  }
  return NOT_STARTED_STATUSES.includes(bracket.match.status);
}
