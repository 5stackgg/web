import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

export const playerMapStatsQuery = generateQuery({
  players_by_pk: [
    { steam_id: $("steamId", "bigint!") },
    {
      steam_id: true,
      match_map_stats: [
        {
          where: $("statsWhere", "player_match_map_stats_bool_exp!"),
          order_by: [{ updated_at: order_by.asc_nulls_first }],
        },
        {
          match_map_id: true,
          kills: true,
          deaths: true,
          assists: true,
          damage: true,
          he_damage: true,
          molotov_damage: true,
          rounds_played: true,
          rounds_t: true,
          rounds_ct: true,
          kills_t: true,
          kills_ct: true,
          deaths_t: true,
          deaths_ct: true,
          damage_t: true,
          damage_ct: true,
          assists_t: true,
          assists_ct: true,
          match_map: {
            id: true,
            winning_lineup_id: true,
            map: {
              id: true,
              name: true,
              label: true,
              poster: true,
            },
            match: {
              id: true,
              lineup_1_id: true,
              lineup_2_id: true,
              lineup_1: {
                id: true,
                lineup_players: [
                  {
                    where: { steam_id: { _eq: $("steamId", "bigint!") } },
                    limit: 1,
                  },
                  {
                    steam_id: true,
                  },
                ],
              },
              lineup_2: {
                id: true,
                lineup_players: [
                  {
                    where: { steam_id: { _eq: $("steamId", "bigint!") } },
                    limit: 1,
                  },
                  {
                    steam_id: true,
                  },
                ],
              },
            },
          },
        },
      ],
    },
  ],
});
