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
