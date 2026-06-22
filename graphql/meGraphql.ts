import { Selector } from "@/generated/zeus";
import { playerFields } from "./playerFields";

export const meFields = Selector("players")({
  ...playerFields,
  name_registered: true,
  role: true,
  profile_url: true,
  matchmaking_cooldown: true,
  current_lobby_id: true,
  language: true,
  country: true,
  show_match_ready_modal: true,
  teams: [
    {},
    {
      id: true,
      name: true,
      short_name: true,
      role: true,
      owner_steam_id: true,
      captain_steam_id: true,
      avatar_url: true,
    },
  ],
});
