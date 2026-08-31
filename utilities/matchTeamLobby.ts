// Which side of a match a viewer belongs to, and the chat room that side owns.
//
// Three surfaces need this answer and they used to have none, one, or their own
// copy of it: the match page derived it inline, and the sidebar and pop-out
// simply never offered team chat at all. The API re-checks membership on join,
// so this only decides what to render -- but it has to agree with the API, or a
// surface offers a room the server will refuse.

export interface LineupLike {
  id?: string | null;
  is_on_lineup?: boolean | null;
  coach?: { steam_id?: string | null } | null;
}

export interface MatchLike {
  id?: string | null;
  status?: string | null;
  lineup_1?: LineupLike | null;
  lineup_2?: LineupLike | null;
}

// The same list VoiceService.ENDED_MATCH_STATUSES holds: the API stops
// admitting a match voice channel a few minutes after the match reaches one of
// these, so a surface that kept offering it would draw a control that answers
// 403.
const ENDED_STATUSES = [
  "Finished",
  "Canceled",
  "Forfeit",
  "Surrendered",
  "Tie",
];

export function matchHasEnded(match: MatchLike | null | undefined) {
  return !!match?.status && ENDED_STATUSES.includes(match.status);
}

// The lineup this viewer plays for, or coaches. Organizers and spectators get
// nothing -- team chat is private to the side actually playing.
export function myLineupId(
  match: MatchLike | null | undefined,
  steamId?: string | null,
): string | null {
  if (!match) {
    return null;
  }

  const mine = [match.lineup_1, match.lineup_2].find(
    (lineup) =>
      lineup?.is_on_lineup ||
      (steamId != null && lineup?.coach?.steam_id === steamId),
  );

  return mine?.id ?? null;
}

// The `match_team` lobby id, in the shape the server splits on. Undefined
// rather than null so it can be handed straight to a prop that means "no team
// room here".
export function matchTeamLobbyId(
  match: MatchLike | null | undefined,
  steamId?: string | null,
): string | undefined {
  const lineupId = myLineupId(match, steamId);

  if (!lineupId || !match?.id) {
    return undefined;
  }

  return `${match.id}:${lineupId}`;
}

// The lineup whose *voice* channel this viewer belongs to.
//
// Deliberately not myLineupId's rule: team chat outlives the match, because
// talking about a game you have just played is the normal thing to do, while
// the call closes itself once everyone has said gg.
export function myVoiceLineupId(
  match: MatchLike | null | undefined,
  steamId?: string | null,
): string | null {
  if (matchHasEnded(match)) {
    return null;
  }

  return myLineupId(match, steamId);
}
