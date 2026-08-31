import gql from "graphql-tag";

/**
 * PRE-CODEGEN ESCAPE HATCH — delete this whole file and rewrite its documents
 * as Zeus selectors / `generateMutation` calls once `yarn codegen` has run
 * against a stack carrying the tournament-invite-code migration.
 *
 * Nothing here exists in `generated/zeus` yet: neither the two tables
 * (`tournament_invite_codes`, `tournament_invite_code_uses`) nor the three
 * actions. Two separate failures follow from an unknown table, which is why a
 * raw document rather than a cast is the fix: the generated `SelectionFunction`
 * maps every key to `never` (a compile error here AND at every call site), and
 * `Zeus()` has no `AllTypesProps` entry telling it `order_by`'s value is an
 * enum, so it serialises `order_by: {created_at: "desc"}` — a quoted string
 * Hasura rejects outright. `graphql/sanctions.ts` and `graphql/leagues.ts` take
 * the same route.
 */

/**
 * The organizer's link list. Deliberately selects plain columns only: the
 * relationship NAMES on these tables are the API's to choose and are not part
 * of the agreed action contract, so a guessed `created_by { … }` would fail the
 * entire document and take the panel with it. Who used a link is fetched
 * separately by TOURNAMENT_INVITE_CODE_USES_QUERY, on demand.
 *
 * Revoked codes are filtered out rather than rendered struck-through: revoking
 * is the organizer saying "this link is gone", and the row is only kept in the
 * table so the code stays permanently reserved.
 */
export const TOURNAMENT_INVITE_CODES_SUBSCRIPTION = gql`
  subscription GetTournamentInviteCodes($tournamentId: uuid!) {
    tournament_invite_codes(
      where: {
        tournament_id: { _eq: $tournamentId }
        revoked_at: { _is_null: true }
      }
      order_by: { created_at: desc }
    ) {
      id
      code
      expires_at
      max_uses
      uses
      revoked_at
      created_at
    }
  }
`;

/**
 * "Who used this link", opened one code at a time.
 *
 * A query rather than a subscription: an organizer expands a row to read it
 * once, and a live socket per expanded code buys nothing. The `player` / `team`
 * relationship names are the one assumption in this file — if the API named
 * them otherwise the whole document fails, so the caller treats a failure as an
 * empty list rather than an error, and the rest of the panel is unaffected.
 */
export const TOURNAMENT_INVITE_CODE_USES_QUERY = gql`
  query GetTournamentInviteCodeUses($inviteCodeId: uuid!) {
    tournament_invite_code_uses(
      where: { invite_code_id: { _eq: $inviteCodeId } }
      order_by: { used_at: desc }
    ) {
      player_steam_id
      team_id
      used_at
      player {
        name
        steam_id
        avatar_url
      }
      team {
        id
        name
        short_name
      }
    }
  }
`;

/**
 * `expires_in_minutes: null` = never expires, `max_uses: null` = unlimited.
 * Both are sent explicitly as null rather than omitted so the action always
 * receives the organizer's actual choice.
 */
export const CREATE_TOURNAMENT_INVITE_CODE_MUTATION = gql`
  mutation CreateTournamentInviteCode(
    $tournamentId: uuid!
    $expiresInMinutes: Int
    $maxUses: Int
  ) {
    createTournamentInviteCode(
      tournament_id: $tournamentId
      expires_in_minutes: $expiresInMinutes
      max_uses: $maxUses
    ) {
      id
      code
    }
  }
`;

export const REVOKE_TOURNAMENT_INVITE_CODE_MUTATION = gql`
  mutation RevokeTournamentInviteCode($inviteCodeId: uuid!) {
    revokeTournamentInviteCode(invite_code_id: $inviteCodeId) {
      success
    }
  }
`;

/**
 * Redemption is an explicit act by the visitor, never something a link does on
 * arrival — see the accept prompt in TournamentDetail.
 */
export const REDEEM_TOURNAMENT_INVITE_CODE_MUTATION = gql`
  mutation RedeemTournamentInviteCode($tournamentId: uuid!, $code: String!) {
    redeemTournamentInviteCode(tournament_id: $tournamentId, code: $code) {
      success
    }
  }
`;

/** The shape every share control renders and every copy button copies. */
export function tournamentInviteUrl(tournamentId: string, code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/tournaments/${tournamentId}?invite=${encodeURIComponent(code)}`;
}
