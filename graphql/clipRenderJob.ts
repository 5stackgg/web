// Not in zeus yet — consumers cast operation maps as any.
export const clipRenderJobFields = {
  id: true,
  user_steam_id: true,
  match_map_id: true,
  status: true,
  progress: true,
  error_message: true,
  clip_id: true,
  created_at: true,
  last_status_at: true,
  spec: true,
  user: {
    steam_id: true,
    name: true,
    avatar_url: true,
  },
  match_map: {
    id: true,
    map: { name: true, poster: true, label: true },
    match: {
      id: true,
      lineup_1: { name: true },
      lineup_2: { name: true },
    },
  },
} as const;

// Tick-addressed so server-side render reproduces the editor's range.
export type ClipSpec = {
  match_map_id: string;
  segments: Array<{
    start_tick: number;
    end_tick: number;
    speed?: number;
    pov_steam_id?: string;
  }>;
  overlays?: Array<{
    type: "text" | "killfeed" | "player_tag";
    start_ms: number;
    end_ms: number;
    payload: Record<string, unknown>;
  }>;
  audio?: {
    track_url?: string;
    volume?: number;
    fade_in_ms?: number;
    fade_out_ms?: number;
    duck_game_audio?: boolean;
  };
  output: {
    format: "mp4";
    resolution: "720p" | "1080p";
    fps: 60;
  };
  destination: "download" | "library";
  title?: string;
};
