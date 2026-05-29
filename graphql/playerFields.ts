import { Selector } from "@/generated/zeus";

export const playerFields = Selector("players")({
  name: true,
  role: true,
  country: true,
  steam_id: true,
  avatar_url: true,
  custom_avatar_url: true,
  roster_image_url: true,
  is_banned: true,
  is_gagged: true,
  is_muted: true,
  elo: true,
  premier_rank: true,
  premier_rank_updated_at: true,
});
