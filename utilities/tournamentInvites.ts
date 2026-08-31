import { e_tournament_status_enum } from "~/generated/zeus";

/**
 * The statuses during which the API accepts a new invite — an addressed invite
 * OR a generated invite link. Past them every invite mutation is rejected
 * server-side, so the organizer controls have to read as unavailable rather
 * than offer an action that will bounce.
 *
 * Deliberately NOT the same question as `invite_only`. Invite-only governs who
 * may ENTER; this governs whether registration is still open at all. An open
 * tournament still accepts invites (they are a shortcut past the search), a
 * closed one accepts none however it was configured.
 */
export const TOURNAMENT_INVITE_STATUSES: string[] = [
  e_tournament_status_enum.Setup,
  e_tournament_status_enum.RegistrationOpen,
];

export function canSendTournamentInvites(status?: string | null): boolean {
  return !!status && TOURNAMENT_INVITE_STATUSES.includes(status);
}

/** The shape every share control renders and every copy button copies. */
export function tournamentInviteUrl(tournamentId: string, code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/tournaments/${tournamentId}?invite=${encodeURIComponent(code)}`;
}

/**
 * A refused invite arrives as a bare code rather than a sentence. A Hasura
 * action's error reaches the client as `message` and nothing else, so the only
 * part of the refusal that can survive the trip is the message itself — the api
 * throws the code there and the browser owns the wording.
 *
 * Anything NOT in this list is still English prose from somewhere further up the
 * api ("tournament not found"), so callers render it verbatim: a sentence
 * nobody translated beats no sentence at all.
 */
const TOURNAMENT_INVITE_ERROR_CODES: string[] = [
  "invite_not_found",
  "invite_revoked",
  "invite_expired",
  "invite_used_up",
  "invite_registration_closed",
  "invite_rate_limited",
  "invite_not_allowed",
];

export function tournamentInviteErrorKey(
  message?: string | null,
): string | null {
  const code = message?.trim() ?? "";
  return TOURNAMENT_INVITE_ERROR_CODES.includes(code)
    ? `tournament.invite_accept.errors.${code}`
    : null;
}

/**
 * Apollo renders every GraphQL error of a response into one `message`, so a
 * refusal that travelled alone is only guaranteed to be untouched — and
 * therefore matchable against a code — in `graphQLErrors`.
 */
export function tournamentInviteErrorMessage(error: unknown): string {
  const graphQLErrors = (
    error as { graphQLErrors?: Array<{ message?: string }> } | null
  )?.graphQLErrors;

  const reported = graphQLErrors?.[0]?.message;
  if (reported) {
    return reported;
  }

  return error instanceof Error ? error.message : String(error);
}
