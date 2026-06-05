import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

export const playerIntroStatsQuery = generateQuery({
  __alias: {
    playerIntroMatches: {
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
              created_at: true,
              started_at: true,
              source: true,
              winning_lineup_id: true,
              lineup_1_id: true,
              lineup_2_id: true,
              lineup_1: {
                id: true,
                name: true,
                lineup_players: [
                  {},
                  {
                    player: {
                      steam_id: true,
                    },
                  },
                ],
              },
              lineup_2: {
                id: true,
                name: true,
                lineup_players: [
                  {},
                  {
                    player: {
                      steam_id: true,
                    },
                  },
                ],
              },
              match_maps: [
                {
                  order_by: [{ order: order_by.asc }],
                },
                {
                  id: true,
                  lineup_1_score: true,
                  lineup_2_score: true,
                  winning_lineup_id: true,
                  map: {
                    id: true,
                    name: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    playerIntroHltv: {
      v_player_match_map_hltv: [
        {
          where: {
            steam_id: { _eq: $("steamId", "bigint!") },
            match: $("matchesWhere", "matches_bool_exp!"),
          },
          limit: $("hltvLimit", "Int!"),
        },
        {
          match_id: true,
          hltv_rating: true,
          kast_pct: true,
          rounds_played: true,
        },
      ],
    },
    playerIntroStats: {
      player_match_stats_v: [
        {
          where: { steam_id: { _eq: $("steamId", "bigint!") } },
          limit: $("statsLimit", "Int!"),
        },
        {
          match_id: true,
          steam_id: true,
          kills: true,
          deaths: true,
          assists: true,
          flash_assists: true,
          damage: true,
          he_damage: true,
          molotov_damage: true,
          rounds_played: true,
          rounds_t: true,
          rounds_ct: true,
          hs_kills: true,
          hits: true,
          headshot_hits: true,
          two_kill_rounds: true,
          three_kill_rounds: true,
          four_kill_rounds: true,
          five_kill_rounds: true,
          trade_kill_successes: true,
          traded_death_successes: true,
        },
      ],
    },
  },
});
