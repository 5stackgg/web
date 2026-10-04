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
      clips_count: true,
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
    // Coaches get their side's chat room too, same as the API's match_team
    // gate -- surfaces that only checked is_on_lineup were hiding it from them.
    coach: {
      steam_id: true,
    },
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
    // Coaches get their side's chat room too, same as the API's match_team
    // gate -- surfaces that only checked is_on_lineup were hiding it from them.
    coach: {
      steam_id: true,
    },
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

// A PlayerMatchRow list's lineup: who played and for which team -- never each
// player's elo, which via playerFields runs get_player_elo() for every player
// on the page.
export const matchRowLineup = Selector("match_lineups")({
  id: true,
  name: true,
  team_id: true,
  team: { name: true, short_name: true, avatar_url: true },
  lineup_players: [
    {},
    {
      steam_id: true,
      player: { steam_id: true, name: true, avatar_url: true },
    },
  ],
});

export const matchRowFields = Selector("matches")({
  ...simpleMatchFields,
  lineup_1: matchRowLineup,
  lineup_2: matchRowLineup,
});
