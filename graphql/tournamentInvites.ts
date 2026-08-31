import gql from "graphql-tag";

/**
 * PRE-CODEGEN ESCAPE HATCH — replace every document here with Zeus selectors
 * and delete this comment once `yarn codegen` has run against a migrated stack.
 *
 * Zeus HAS seen `tournament_invites` itself by now. What it has not seen is
 * team addressing: the nullable `team_id` column, its `team` relationship, and
 * `steam_id` having become nullable. An unknown key is not a soft failure —
 * the generated `SelectionFunction` maps it to `never`, which is a compile
 * error here AND at every call site — and `Zeus()` also has no `AllTypesProps`
 * entry telling it `order_by`'s value is an enum, so it would serialise
 * `order_by: {created_at: "desc"}`, a quoted string Hasura rejects. Raw
 * documents sidestep both, the same way `graphql/leagues.ts` does.
 *
 * The player selections below are a hand-copy of `graphql/playerFields.ts`
 * (which PlayerDisplay reads); keep them in step until this file is deleted.
 */
/**
 * A team-addressed invite carries the team instead of a player. Selected on
 * every organizer/invitee document so one list can render both kinds — the
 * CHECK on the table guarantees exactly one of the two is non-null, so the
 * renderer branches on which one came back rather than on a type column.
 */
const INVITE_TEAM_SELECTION = `
    id
    name
    short_name
    avatar_url
`;

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
      team_id
      player {
        ${INVITE_PLAYER_SELECTION}
      }
      team {
        ${INVITE_TEAM_SELECTION}
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
 * A team-addressed invite as its recipients see it.
 *
 * Kept as its own document rather than folded into the player subscription
 * above with an `_or`: the `team` relationship and `team_id` land with the
 * team-addressing migration, and one document naming an unknown field fails
 * entirely. Apart, a stack that has not migrated yet loses team invites from
 * the notification tray and keeps player invites working.
 *
 * Filtered on ownership rather than on membership because those are exactly the
 * people who may register a team — a body the API's own row permission narrows
 * further (a `team_roster` Admin also qualifies there, and would simply see the
 * row as well).
 */
export const MY_TOURNAMENT_TEAM_INVITES_SUBSCRIPTION = gql`
  subscription GetMyTournamentTeamInvites($steamId: bigint!) {
    tournament_invites(
      where: {
        team_id: { _is_null: false }
        team: {
          _or: [
            { owner_steam_id: { _eq: $steamId } }
            { captain_steam_id: { _eq: $steamId } }
          ]
        }
      }
      order_by: { created_at: desc }
    ) {
      id
      created_at
      team_id
      team {
        ${INVITE_TEAM_SELECTION}
      }
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
 * Re-inviting the same player hits the partial unique index on
 * (tournament_id, steam_id); callers treat that as a no-op rather than an
 * error.
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

/**
 * The team half of the same table — never a second table. A sibling
 * `tournament_team_invites` already exists and means something completely
 * different (join a team that is ALREADY registered), which is exactly why
 * team addressing was folded into this row instead.
 */
export const CREATE_TOURNAMENT_TEAM_INVITE_MUTATION = gql`
  mutation CreateTournamentTeamInvite($tournamentId: uuid!, $teamId: uuid!) {
    insert_tournament_invites_one(
      object: { tournament_id: $tournamentId, team_id: $teamId }
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
