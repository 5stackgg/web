import { $, order_by, Selector } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";

// Lineup shape for the per-map Overview tab. Reads from player_match_map_stats
// (one indexed row per player+map) instead of running ~13 hypertable aggregates
// per player with a match_map_id filter.
export const matchMapStats = Selector("match_lineups")({
  id: true,
  name: true,
  lineup_players: [
    {
      order_by: [
        { captain: order_by.desc_nulls_last },
        { player: { name: $("order_by_name", "order_by!") } },
      ],
    },
    {
      captain: true,
      steam_id: true,
      placeholder_name: true,
      player: {
        ...playerFields,
        match_map_stats: [
          {
            where: {
              match_id: { _eq: $("matchId", "uuid!") },
              match_map_id: { _eq: $("matchMapId", "uuid!") },
            },
            limit: 1,
          },
          {
            kills: true,
            hs_kills: true,
            knife_kills: true,
            zeus_kills: true,
            assists: true,
            flash_assists: true,
            deaths: true,
            damage: true,
            team_damage: true,
            he_damage: true,
            molotov_damage: true,
            flashes_thrown: true,
            enemies_flashed: true,
            team_flashed: true,
            flash_duration_sum: true,
            flash_duration_count: true,
            two_kill_rounds: true,
            three_kill_rounds: true,
            four_kill_rounds: true,
            five_kill_rounds: true,
          },
        ],
      },
    },
  ],
});
