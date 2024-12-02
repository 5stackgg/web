import { Selector } from "@/generated/zeus";
import { playerFields } from "./playerFields";

export const meFields = Selector("players")({
  ...playerFields,
  name_registered: true,
  role: true,
  profile_url: true,
  matchmaking_cooldown: true,
  teams: [
    {},
    {
      id: true,
      name: true,
      short_name: true,
    },
  ],
});
