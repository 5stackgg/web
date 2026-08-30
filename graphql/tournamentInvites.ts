import gql from "graphql-tag";

/**
 * PRE-CODEGEN ESCAPE HATCH — replace every document here with Zeus selectors
 * and delete this comment once `yarn codegen` has run against a migrated stack.
 *
 * `tournament_invites` lands with the tournament-invites migration, so Zeus has
 * never seen the table. Two failures follow from that, not one: the generated
 * selector maps every key to `never` (a compile error at each call site), and
 * `Zeus()` has no `AllTypesProps` entry telling it `order_by`'s value is an
 * enum, so it serialises `order_by: {created_at: "desc"}` — a quoted string
 * Hasura rejects. Raw documents avoid both, the same way `graphql/leagues.ts`
 * does for the league tables.
 *
 * The player selections below are a hand-copy of `graphql/playerFields.ts`
 * (which PlayerDisplay reads); keep them in step until this file is deleted.
 */
const INVITE_PLAYER_SELECTION = `
    name
    role
    country
    steam_id
    avatar_url
    custom_avatar_url
    roster_image_url
    is_banned
    is_gagged
    is_muted
    vac_banned
    vac_ban_count
    game_ban_count
    days_since_last_ban
    elo
    premier_rank
    premier_rank_updated_at
    faceit_skill_level
    faceit_elo
    faceit_url
    faceit_nickname
`;

/**
 * The organizer's view. The Hasura select permission already narrows this to
 * tournaments the caller organizes (or invites addressed to them), so the
 * tournament_id filter is a scope, not the security boundary.
 */
export const TOURNAMENT_INVITES_SUBSCRIPTION = gql`
  subscription GetTournamentInvites($tournamentId: uuid!) {
    tournament_invites(
      where: { tournament_id: { _eq: $tournamentId } }
      order_by: { created_at: desc }
    ) {
      id
      created_at
      steam_id
      player {
        ${INVITE_PLAYER_SELECTION}
      }
      invited_by {
        ${INVITE_PLAYER_SELECTION}
      }
    }
  }
`;

/**
 * The invitee's view. Queried at the root rather than through a relationship:
 * there is deliberately no `players.tournament_invites` relationship in the
 * API's metadata, so this is the only way in.
 */
export const MY_TOURNAMENT_INVITES_SUBSCRIPTION = gql`
  subscription GetMyTournamentInvites($steamId: bigint!) {
    tournament_invites(
      where: { steam_id: { _eq: $steamId } }
      order_by: { created_at: desc }
    ) {
      id
      created_at
      tournament {
        id
        name
        logo
      }
      invited_by {
        ${INVITE_PLAYER_SELECTION}
      }
    }
  }
`;

/**
 * `invited_by_player_steam_id` is a Hasura column preset — sending it fails the
 * whole insert, so the object carries only the two insertable columns.
 * Re-inviting the same player hits UNIQUE (tournament_id, steam_id); callers
 * treat that as a no-op rather than an error.
 */
export const CREATE_TOURNAMENT_INVITE_MUTATION = gql`
  mutation CreateTournamentInvite($tournamentId: uuid!, $steamId: bigint!) {
    insert_tournament_invites_one(
      object: { tournament_id: $tournamentId, steam_id: $steamId }
    ) {
      id
    }
  }
`;

/** Revoke (organizer) or decline-by-deletion (invitee) — one permission covers both. */
export const DELETE_TOURNAMENT_INVITE_MUTATION = gql`
  mutation DeleteTournamentInvite($id: uuid!) {
    delete_tournament_invites_by_pk(id: $id) {
      id
    }
  }
`;
