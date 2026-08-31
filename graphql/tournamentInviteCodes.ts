import { $, order_by } from "~/generated/zeus";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";

/**
 * The organizer's link list.
 *
 * Revoked codes are filtered out rather than rendered struck-through: revoking
 * is the organizer saying "this link is gone", and the row is only kept in the
 * table so the code stays permanently reserved. That same filter is what the
 * Links sub-tab counts, so the badge and the list can never disagree.
 */
export const TOURNAMENT_INVITE_CODES_SUBSCRIPTION = generateSubscription({
  tournament_invite_codes: [
    {
      where: {
        tournament_id: {
          _eq: $("tournamentId", "uuid!"),
        },
        revoked_at: {
          _is_null: true,
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
      code: true,
      expires_at: true,
      max_uses: true,
      uses: true,
      revoked_at: true,
      created_at: true,
    },
  ],
});

export const TOURNAMENT_INVITE_CODE_USES_QUERY = generateQuery({
  tournament_invite_code_uses: [
    {
      where: {
        invite_code_id: {
          _eq: $("inviteCodeId", "uuid!"),
        },
      },
      order_by: [
        {
          used_at: order_by.desc,
        },
      ],
    },
    {
      player_steam_id: true,
      team_id: true,
      used_at: true,
      player: {
        name: true,
        steam_id: true,
        avatar_url: true,
      },
      team: {
        id: true,
        name: true,
        short_name: true,
      },
    },
  ],
});

/**
 * `expires_in_minutes: null` = never expires, `max_uses: null` = unlimited.
 * Both are sent explicitly as null rather than omitted so the action always
 * receives the organizer's actual choice.
 */
export const CREATE_TOURNAMENT_INVITE_CODE_MUTATION = generateMutation({
  createTournamentInviteCode: [
    {
      tournament_id: $("tournamentId", "uuid!"),
      expires_in_minutes: $("expiresInMinutes", "Int"),
      max_uses: $("maxUses", "Int"),
    },
    {
      id: true,
      code: true,
    },
  ],
});

export const REVOKE_TOURNAMENT_INVITE_CODE_MUTATION = generateMutation({
  revokeTournamentInviteCode: [
    {
      invite_code_id: $("inviteCodeId", "uuid!"),
    },
    {
      success: true,
    },
  ],
});

/**
 * Redemption is an explicit act by the visitor, never something a link does on
 * arrival — see the accept prompt in TournamentDetail.
 */
export const REDEEM_TOURNAMENT_INVITE_CODE_MUTATION = generateMutation({
  redeemTournamentInviteCode: [
    {
      tournament_id: $("tournamentId", "uuid!"),
      code: $("code", "String!"),
    },
    {
      success: true,
    },
  ],
});
