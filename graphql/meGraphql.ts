import { Selector } from "@/generated/zeus";

export const meFields = Selector("MeResponse")({
  steam_id: true,
  discord_id: true,
  player: {
    name: true,
    profile_url: true,
    avatar_url: true,
    teams: [
      {},
      {
        id: true,
        name: true,
        short_name: true,
      },
    ],
  },
});
