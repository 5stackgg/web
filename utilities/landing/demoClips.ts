import type { Clip } from "~/types/clip";

// A real highlight rendered on 5stack.gg, kept in the repo so the welcome page
// can play it on any instance: nuggets' Deagle ace on Dust II.
export const EXAMPLE_CLIP_VIDEO = "/landing/highlight.mp4";

function clip(
  id: string,
  player: string,
  map: string,
  fields: Pick<Clip, "title" | "duration_ms" | "kills_count" | "round"> & {
    thumbnail?: string;
    score?: [number, number];
  },
): Clip {
  const steamId = `demo-${player}`;
  return {
    id,
    user_steam_id: steamId,
    target_steam_id: steamId,
    match_map_id: `${id}-map`,
    title: fields.title,
    duration_ms: fields.duration_ms,
    download_url: null,
    thumbnail_url: null,
    thumbnail_download_url: fields.thumbnail ?? null,
    kills_count: fields.kills_count,
    round: fields.round,
    views_count: 0,
    visibility: "public",
    created_at: "2026-10-17T05:01:31Z",
    target: { steam_id: steamId, name: player, avatar_url: null },
    match_map: {
      id: `${id}-map`,
      lineup_1_score: fields.score?.[0] ?? null,
      lineup_2_score: fields.score?.[1] ?? null,
      winning_lineup_id: null,
      map: {
        name: map,
        label: null,
        poster: `/img/maps/screenshots/${map}.webp`,
      },
    },
  };
}

export const EXAMPLE_CLIP = clip(
  "00000000-0000-0000-0002-000000000001",
  "nuggets",
  "de_dust2",
  {
    title: "nuggets — Best Round (5K)",
    duration_ms: 23533,
    kills_count: 5,
    round: 13,
    thumbnail: "/landing/highlight.webp",
    score: [13, 10],
  },
);
