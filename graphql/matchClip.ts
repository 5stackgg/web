// Generated Zeus types lag the new clip-manager schema until codegen
// runs against an api with the migrations applied — same pattern as
// match_demo_sessions before its schema landed (see
// composables/useDemoPlayback.ts). Selectors here are typed loosely
// with `as any` so the rest of the codebase compiles before then.
export const matchClipFields = {
  id: true,
  user_steam_id: true,
  match_map_id: true,
  title: true,
  duration_ms: true,
  s3_url: true,
  thumbnail_url: true,
  visibility: true,
  created_at: true,
  match_map: {
    id: true,
    map: { name: true, thumbnail: true },
    match: {
      id: true,
      lineup_1: { name: true },
      lineup_2: { name: true },
    },
  },
} as const;
