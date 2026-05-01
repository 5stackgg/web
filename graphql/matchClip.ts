// `download_url` is a Hasura computed field backed by the
// `clip_download_url(match_clips)` SQL function — same pattern as
// match_map_demos.download_url. It builds a worker URL like
// `${cloudflare_worker_url}/clips?file=${file}` at read time so the
// URL is always live + free egress through Cloudflare.
export const matchClipFields = {
  id: true,
  user_steam_id: true,
  match_map_id: true,
  title: true,
  duration_ms: true,
  download_url: true,
  thumbnail_url: true,
  visibility: true,
  created_at: true,
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
