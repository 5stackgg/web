import { $, Selector, order_by } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";

/**
 * A team-addressed invite carries the team instead of a player. Selected on
 * every organizer/invitee document so one list can render both kinds — the
 * CHECK on the table guarantees exactly one of the two is non-null, so the
 * renderer branches on which one came back rather than on a type column.
 */
const inviteTeamFields = Selector("teams")({
  id: true,
  name: true,
  short_name: true,
  avatar_url: true,
});

/** The tournament card the notification tray renders for an invite. */
const inviteTournamentFields = Selector("tournaments")({
  id: true,
  name: true,
  logo: true,
});

/**
 * The organizer's view. The Hasura select permission already narrows this to
 * tournaments the caller organizes (or invites addressed to them), so the
 * tournament_id filter is a scope, not the security boundary.
 */
export const TOURNAMENT_INVITES_SUBSCRIPTION = generateSubscription({
  tournament_invites: [
    {
      where: {
        tournament_id: {
          _eq: $("tournamentId", "uuid!"),
        },
      },
      order_by: [
        {
          created_at: order_by.desc,
        },
      ],
    },
    {
      id: true,
      created_at: true,
      steam_id: true,
      team_id: true,
      player: playerFields,
      team: inviteTeamFields,
      invited_by: playerFields,
    },
  ],
});

/**
 * The invitee's view. Queried at the root rather than through a relationship:
 * there is deliberately no `players.tournament_invites` relationship in the
 * API's metadata, so this is the only way in.
 */
export const MY_TOURNAMENT_INVITES_SUBSCRIPTION = generateSubscription({
  tournament_invites: [
    {
      where: {
        steam_id: {
          _eq: $("steamId", "bigint!"),
        },
      },
      order_by: [
        {
          created_at: order_by.desc,
        },
      ],
    },
    {
      id: true,
      created_at: true,
      tournament: inviteTournamentFields,
      invited_by: playerFields,
    },
  ],
});

/**
 * A team-addressed invite as its recipients see it.
 *
 * Kept as its own document rather than folded into the player subscription
 * above with an `_or`: the two are addressed to different bodies of people (a
 * steam id vs a team's owner/captain), so one `_or` would have to widen the
 * player half to every team member as well.
 *
 * Filtered on ownership rather than on membership because those are exactly the
 * people who may register a team — a body the API's own row permission narrows
 * further (a `team_roster` Admin also qualifies there, and would simply see the
 * row as well).
 */
export const MY_TOURNAMENT_TEAM_INVITES_SUBSCRIPTION = generateSubscription({
  tournament_invites: [
    {
      where: {
        team_id: {
          _is_null: false,
        },
        team: {
          _or: [
            {
              owner_steam_id: {
                _eq: $("steamId", "bigint!"),
              },
            },
            {
              captain_steam_id: {
                _eq: $("steamId", "bigint!"),
              },
            },
          ],
        },
      },
      order_by: [
        {
          created_at: order_by.desc,
        },
      ],
    },
    {
      id: true,
      created_at: true,
      team_id: true,
      team: inviteTeamFields,
      tournament: inviteTournamentFields,
      invited_by: playerFields,
    },
  ],
});

/**
 * `invited_by_player_steam_id` is a Hasura column preset — sending it fails the
 * whole insert, so the object carries only the two insertable columns.
 * Re-inviting the same player hits the partial unique index on
 * (tournament_id, steam_id); callers treat that as a no-op rather than an
 * error.
 */
export const CREATE_TOURNAMENT_INVITE_MUTATION = generateMutation({
  insert_tournament_invites_one: [
    {
      object: {
        tournament_id: $("tournamentId", "uuid!"),
        steam_id: $("steamId", "bigint!"),
      },
    },
    {
      id: true,
    },
  ],
});

/**
 * The team half of the same table — never a second table. A sibling
 * `tournament_team_invites` already exists and means something completely
 * different (join a team that is ALREADY registered), which is exactly why
 * team addressing was folded into this row instead.
 */
export const CREATE_TOURNAMENT_TEAM_INVITE_MUTATION = generateMutation({
  insert_tournament_invites_one: [
    {
      object: {
        tournament_id: $("tournamentId", "uuid!"),
        team_id: $("teamId", "uuid!"),
      },
    },
    {
      id: true,
    },
  ],
});

/** Revoke (organizer) or decline-by-deletion (invitee) — one permission covers both. */
export const DELETE_TOURNAMENT_INVITE_MUTATION = generateMutation({
  delete_tournament_invites_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    {
      id: true,
    },
  ],
});
