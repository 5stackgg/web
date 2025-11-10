import { Selector } from "@/generated/zeus";

export const eloFields = Selector("v_player_elo")({
  assists: true,
  current_elo: true,
  damage: true,
  damage_percent: true,
  deaths: true,
  elo_change: true,
  expected_score: true,
  kda: true,
  kills: true,
  match_created_at: true,
  match_id: true,
  opponent_team_elo_avg: true,
  performance_multiplier: true,
  player_name: true,
  player_steam_id: true,
  player_team_elo_avg: true,
  team_avg_kda: true,
  updated_elo: true,
});
