import { order_by, Selector } from "@/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";
import { playerFields } from "~/graphql/playerFields";

export const simpleMatchFields = Selector("matches")({
  id: true,
  status: true,
  source: true,
  ended_at: true,
  organizer_steam_id: true,
  is_in_lineup: true,
  is_coach: true,
  is_tournament_match: true,
  e_match_status: {
    description: true,
  },
  winning_lineup_id: true,
  lineup_1_id: true,
  lineup_2_id: true,
  created_at: true,
  started_at: true,
  scheduled_at: true,
  options: {
    mr: true,
    best_of: true,
    type: true,
  },
  match_maps: [
    {
      order_by: [
        {
          order: order_by.asc,
        },
      ],
    },
    {
      id: true,
      map: mapFields,
      is_current_map: true,
      lineup_1_score: true,
      lineup_2_score: true,
      winning_lineup_id: true,
      public_clips_count: true,
      vetos: {
        side: true,
        type: true,
        match_lineup_id: true,
      },
    },
  ],
  lineup_1: {
    id: true,
    name: true,
    is_on_lineup: true,
    team_id: true,
    team: {
      name: true,
      short_name: true,
      avatar_url: true,
      roster: [
        {},
        {
          player_steam_id: true,
          roster_image_url: true,
        },
      ],
    },
    lineup_players: [
      {},
      {
        checked_in: true,
        placeholder_name: true,
        player: playerFields,
      },
    ],
  },
  lineup_2: {
    id: true,
    name: true,
    is_on_lineup: true,
    team_id: true,
    team: {
      name: true,
      short_name: true,
      avatar_url: true,
      roster: [
        {},
        {
          player_steam_id: true,
          roster_image_url: true,
        },
      ],
    },
    lineup_players: [
      {},
      {
        checked_in: true,
        placeholder_name: true,
        player: playerFields,
      },
    ],
  },

  max_players_per_lineup: true,
  min_players_per_lineup: true,
  lineup_counts: [{}, true],
  tournament_brackets: [
    { limit: 1 },
    {
      round: true,
      match_number: true,
      stage: {
        order: true,
        e_tournament_stage_type: {
          description: true,
        },
        tournament: {
          id: true,
          name: true,
        },
      },
    },
  ],
});
