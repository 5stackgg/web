import { $, order_by, Selector } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";

// Per-map Overview tab. Reads one row from player_match_map_stats per player.
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
            trade_kill_opportunities: true,
            trade_kill_attempts: true,
            trade_kill_successes: true,
            traded_death_opportunities: true,
            traded_death_successes: true,
            shots_fired: true,
            hits: true,
            headshot_hits: true,
            time_to_damage_sum_s: true,
            time_to_damage_count: true,
            spotted_count: true,
            spotted_with_damage_count: true,
            he_throws: true,
            molotov_throws: true,
            smoke_throws: true,
            decoy_throws: true,
            counter_strafed_shots: true,
            crosshair_angle_sum_deg: true,
            crosshair_angle_count: true,
            rounds_played: true,
          },
        ],
      },
    },
  ],
});
