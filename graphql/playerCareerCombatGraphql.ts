import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

export const playerCareerCombatQuery = generateQuery({
  players_by_pk: [
    { steam_id: $("steamId", "bigint!") },
    {
      steam_id: true,
      matches: [
        {
          where: $("matchesWhere", "matches_bool_exp!"),
          limit: $("limit", "Int!"),
          order_by: [
            { started_at: order_by.desc_nulls_last },
            { created_at: order_by.desc },
          ],
        },
        {
          id: true,
          lineup_1_id: true,
          lineup_2_id: true,
          lineup_1: {
            id: true,
            lineup_players: [
              {},
              {
                steam_id: true,
              },
            ],
          },
          lineup_2: {
            id: true,
            lineup_players: [
              {},
              {
                steam_id: true,
              },
            ],
          },
          match_maps: [
            {
              order_by: [{ order: order_by.asc }],
            },
            {
              id: true,
              winning_lineup_id: true,
              map: {
                id: true,
                name: true,
                label: true,
              },
              rounds: [
                {
                  order_by: [{ round: order_by.asc }],
                },
                {
                  round: true,
                  lineup_1_side: true,
                  lineup_2_side: true,
                  winning_side: true,
                  kills: [
                    {
                      order_by: [{ time: order_by.asc }],
                    },
                    {
                      with: true,
                      headshot: true,
                      player: {
                        steam_id: true,
                      },
                      attacked_player: {
                        steam_id: true,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
