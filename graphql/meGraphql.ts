import { Selector } from "@/generated/zeus";
import { playerFields } from "./playerFields";

export const meFields = Selector("Players")({
  ...playerFields,
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
