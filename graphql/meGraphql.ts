import { Selector } from "@/generated/zeus";
import { playerFields } from "./playerFields";

/**
 * Every field here is a hard dependency of sign-in: `me` is one document, so a
 * single key the api has not migrated yet rejects the whole thing and nobody
 * gets in. api and web are separate images on separate release channels, so
 * deploy order is not guaranteed — anything that lands with a migration goes in
 * its own document instead (see graphql/tournamentCooldown.ts).
 */
export const meFields = Selector("players")({
  ...playerFields,
  name_registered: true,
  role: true,
  profile_url: true,
  matchmaking_cooldown: true,
  // Null while banned means the ban is permanent -- there is no date to show.
  banned_until: true,
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
