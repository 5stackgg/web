import { $, order_by, Selector } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";

// All-maps Overview tab. Reads from player_match_stats_v scoped to the current
// match — array_relationship of length <= 1; the UI reads [0].
export const matchAllMapsStats = Selector("match_lineups")({
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
        match_stats: [
          {
            where: { match_id: { _eq: $("matchId", "uuid!") } },
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
            avg_flash_duration: true,
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
            avg_time_to_damage_s: true,
            spotted_count: true,
            spotted_with_damage_count: true,
            he_throws: true,
            molotov_throws: true,
            smoke_throws: true,
            decoy_throws: true,
            counter_strafed_shots: true,
            counter_strafe_eligible_shots: true,
            avg_crosshair_angle_deg: true,
            non_awp_hits: true,
            hits_at_spotted: true,
            shots_at_spotted: true,
            spray_shots: true,
            spray_hits: true,
            rounds_played: true,
          },
        ],
      },
    },
  ],
});
