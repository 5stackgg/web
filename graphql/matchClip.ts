const clipLineupWithPlayersFields = {
  id: true,
  name: true,
  team: {
    name: true,
    avatar_url: true,
  },
  lineup_players: [
    {},
    {
      captain: true,
      steam_id: true,
      placeholder_name: true,
      player: {
        steam_id: true,
        name: true,
        avatar_url: true,
      },
    },
  ],
} as const;

// download_url is a Hasura computed field returning a CF worker URL.
export const matchClipFields = {
  id: true,
  user_steam_id: true,
  target_steam_id: true,
  match_map_id: true,
  title: true,
  duration_ms: true,
  download_url: true,
  thumbnail_url: true,
  thumbnail_download_url: true,
  kills_count: true,
  round: true,
  visibility: true,
  created_at: true,
  user: {
    steam_id: true,
    name: true,
    avatar_url: true,
  },
  target: {
    steam_id: true,
    name: true,
    avatar_url: true,
  },
  match_map: {
    id: true,
    lineup_1_score: true,
    lineup_2_score: true,
    winning_lineup_id: true,
    map: { name: true, poster: true, label: true },
    match: {
      id: true,
      status: true,
      started_at: true,
      ended_at: true,
      winning_lineup_id: true,
      is_tournament_match: true,
      lineup_1_id: true,
      lineup_2_id: true,
      lineup_1: { id: true, name: true },
      lineup_2: { id: true, name: true },
      options: {
        best_of: true,
        mr: true,
      },
    },
  },
} as const;

export const matchClipFieldsWithLineups = {
  ...matchClipFields,
  match_map: {
    ...matchClipFields.match_map,
    match: {
      ...matchClipFields.match_map.match,
      lineup_1: clipLineupWithPlayersFields,
      lineup_2: clipLineupWithPlayersFields,
    },
  },
} as const;
