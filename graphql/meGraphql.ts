import { Selector } from "@/generated/zeus";
import { playerFields } from "./playerFields";

/**
 * PRE-CODEGEN ESCAPE HATCH — fold this key into the literal below and delete
 * the cast once `yarn codegen` has run against a migrated stack.
 *
 * `players.tournament_cooldown` is the sanctions-policy sibling of
 * `matchmaking_cooldown`: a computed timestamptz that is only ever non-null for
 * the session's own player. Zeus has not seen it, so an inline entry maps to
 * `never` — a compile error here and at every call site that spreads meFields.
 *
 * Note this puts the field in the `me` query itself, which is what makes it
 * behave exactly like `matchmaking_cooldown` — and which means this selection
 * requires an API that has run the sanctions migration. Web and API ship from
 * the same branch, so that holds; a split deploy would break sign-in.
 */
const pendingCooldownFields = {
  tournament_cooldown: true,
} as {};

export const meFields = Selector("players")({
  ...playerFields,
  ...pendingCooldownFields,
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
