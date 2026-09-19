import { Selector } from "@/generated/zeus";

/**
 * Everything `PlayerDisplay` needs that is a plain column, plus the three
 * sanction booleans it always reads for the badge in `activeSanctionType`.
 *
 * `elo` is deliberately NOT here. It is a computed field backed by
 * `get_player_elo()`, which runs eight nested plpgsql calls per row, so it is
 * by far the most expensive thing a player selection can ask for. Selections
 * feeding a `<PlayerDisplay :show-elo="false">` should use `playerFields`
 * below without it -- see `playerFieldsWithoutElo`.
 */
const playerIdentityFields = {
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
  vac_banned: true,
  vac_ban_count: true,
  game_ban_count: true,
  days_since_last_ban: true,
  premier_rank: true,
  premier_rank_updated_at: true,
  faceit_skill_level: true,
  faceit_elo: true,
  faceit_url: true,
  faceit_nickname: true,
};

export const playerFields = Selector("players")({
  ...playerIdentityFields,
  elo: true,
});

/**
 * For player selections whose only consumer renders
 * `<PlayerDisplay :show-elo="false">`. Identical to `playerFields` minus the
 * `elo` computed field.
 *
 * Only use this once you have checked every consumer of that branch: `showElo`
 * defaults to TRUE, so a `<PlayerDisplay>` with no explicit binding does render
 * elo, and swapping the selector under one silently blanks it.
 */
export const playerFieldsWithoutElo = Selector("players")(playerIdentityFields);
