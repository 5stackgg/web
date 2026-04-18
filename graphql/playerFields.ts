import { Selector } from "@/generated/zeus";

export const playerFields = Selector("players")({
  name: true,
  role: true,
  country: true,
  steam_id: true,
  avatar_url: true,
  custom_avatar_url: true,
  is_banned: true,
  is_gagged: true,
  is_muted: true,
  elo: true,
  tournament_trophies_aggregate: [
    {},
    {
      aggregate: {
        count: true,
      },
    },
  ],
  tournament_trophies: [
    {},
    {
      placement: true,
      placement_tier: true,
    },
  ],
});
