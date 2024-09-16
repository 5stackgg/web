import { Selector } from "@/generated/zeus";

export const meFields = Selector("Players")({
  steam_id: true,
  role: true,
  name: true,
  country: true,
  profile_url: true,
  matchmaking_cooldown: true,
  avatar_url: true,
  teams: [
    {},
    {
      id: true,
      name: true,
      short_name: true,
    },
  ],
});
