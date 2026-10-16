import {
  $,
  e_draft_game_status_enum,
  e_lobby_access_enum,
  e_match_status_enum,
  order_by,
} from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";

export const MY_FRIENDS_SUBSCRIPTION = generateSubscription({
  my_friends: [
    {},
    {
      elo: true,
      name: true,
      role: true,
      country: true,
      steam_id: true,
      avatar_url: true,
      status: true,
      invited_by_steam_id: true,
      last_presence_state: true,
      presence_updated_at: true,
      player: {
        steam_id: true,
        is_registered: true,
        is_in_lobby: true,
        is_in_another_match: true,
        is_in_draft: true,
        // Friend's current live match — drives the inline score preview.
        live_lineup: [
          {
            limit: 1,
            where: {
              lineup: {
                match: { status: { _eq: e_match_status_enum.Live } },
              },
            },
          },
          {
            lineup: {
              id: true,
              match: {
                id: true,
                status: true,
                started_at: true,
                lineup_1_id: true,
                lineup_2_id: true,
                options: { type: true, best_of: true },
                lineup_1: { id: true, name: true },
                lineup_2: { id: true, name: true },
                streams: [
                  { where: { is_live: { _eq: true } }, limit: 1 },
                  { id: true },
                ],
                match_maps: [
                  { order_by: [{ order: order_by.asc }] },
                  {
                    id: true,
                    order: true,
                    status: true,
                    is_current_map: true,
                    map: { name: true, label: true },
                    lineup_1_score: true,
                    lineup_2_score: true,
                    winning_lineup_id: true,
                  },
                ],
              },
            },
          },
        ],
        draft_game_players: [
          {
            limit: 1,
            where: {
              draft_game: {
                match_id: { _is_null: true },
                status: { _eq: e_draft_game_status_enum.Open },
                access: {
                  _in: [
                    e_lobby_access_enum.Friends,
                    e_lobby_access_enum.Open,
                  ],
                },
              },
            },
          },
          {
            draft_game_id: true,
            draft_game: {
              id: true,
              access: true,
              status: true,
              capacity: true,
              type: true,
              mode: true,
              require_approval: true,
              players: [
                { where: { status: { _neq: "Waitlist" } } },
                { steam_id: true, status: true },
              ],
            },
          },
        ],
        lobby_players: [
          {
            limit: 1,
            where: {
              lobby: {
                _not: {
                  players: {
                    steam_id: {
                      _eq: $("mySteamId", "bigint!"),
                    },
                  },
                },
                access: {
                  _in: [
                    e_lobby_access_enum.Friends,
                    e_lobby_access_enum.Open,
                  ],
                },
              },
            },
          },
          {
            lobby_id: true,
            lobby: {
              id: true,
              players: [
                {},
                {
                  player: {
                    name: true,
                    country: true,
                    steam_id: true,
                    avatar_url: true,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
});
