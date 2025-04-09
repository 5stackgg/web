import { Selector } from "@/generated/zeus";

export const playerFields = Selector("players")({
  name: true,
  country: true,
  steam_id: true,
  avatar_url: true,
  is_banned: true,
  is_gagged: true,
  is_muted: true,
  elo: true,
});
