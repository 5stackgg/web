// See note in graphql/matchClip.ts — these tables aren't in zeus yet,
// so consumers should `as any` the operation map until codegen catches up.
export const clipRenderJobFields = {
  id: true,
  user_steam_id: true,
  match_map_id: true,
  status: true,
  progress: true,
  error_message: true,
  clip_id: true,
  created_at: true,
} as const;

// Tick-based clip-spec contract. Tick math is deterministic across
// replays of the same demo, so server-side rendering can reproduce the
// exact range the user picked in the editor. `output.format` is mp4 /
// h264 only at launch — see plan file.
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
