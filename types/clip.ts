// Mirrors graphql/matchClip.ts — extend both together.
export type ClipPlayerRef = {
  steam_id: string;
  name: string;
  avatar_url: string | null;
};

export type ClipLineupPlayerRef = {
  steam_id: string;
  captain?: boolean | null;
  placeholder_name?: string | null;
  player?: ClipPlayerRef | null;
};

export type ClipLineupRef = {
  id: string;
  name: string;
  team_id?: string | null;
  team?: {
    name: string | null;
    avatar_url: string | null;
  } | null;
  lineup_players?: ClipLineupPlayerRef[] | null;
};

export type ClipMatchMapEntry = {
  id: string;
  order: number | null;
  lineup_1_score: number | null;
  lineup_2_score: number | null;
  winning_lineup_id: string | null;
  map?: { name: string; label: string | null } | null;
};

export type ClipMatchContext = {
  id: string;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  winning_lineup_id: string | null;
  is_tournament_match: boolean | null;
  lineup_1_id: string | null;
  lineup_2_id: string | null;
  lineup_1?: ClipLineupRef | null;
  lineup_2?: ClipLineupRef | null;
  options?: { best_of: number | null; mr: number | null } | null;
  match_maps?: ClipMatchMapEntry[] | null;
};

export type ClipMatchMapContext = {
  id: string;
  lineup_1_score: number | null;
  lineup_2_score: number | null;
  winning_lineup_id: string | null;
  map?: { name: string; poster: string | null; label: string | null } | null;
  match?: ClipMatchContext | null;
};

export type Clip = {
  id: string;
  user_steam_id: string;
  target_steam_id: string | null;
  match_map_id?: string | null;
  title: string | null;
  duration_ms: number | null;
  download_url: string | null;
  thumbnail_url: string | null;
  thumbnail_download_url: string | null;
  kills_count: number | null;
  round: number | null;
  views_count?: number | null;
  visibility: string;
  created_at: string;
  user?: ClipPlayerRef | null;
  target?: ClipPlayerRef | null;
  match_map?: ClipMatchMapContext | null;
};
