import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import gql from "graphql-tag";

export const playerWeaponStatsQuery = generateQuery({
  v_player_weapon_kills: [
    {
      where: $("where", "v_player_weapon_kills_bool_exp!"),
      order_by: [{ kill_count: order_by.desc }],
    },
    {
      with: true,
      kill_count: true,
    },
  ],
});

// Per-weapon damage (v_player_weapon_damage) + rounds-with-a-kill
// (v_player_weapon_kills.rounds). Raw document (not zeus) so it needs no
// generated/zeus regen when the view/column is added — the where shape
// matches the kills view (same player_steam_id / source / type columns).
// Fetched best-effort; callers ignore failures so the table still renders
// kills/usage if these aren't deployed yet.
export const playerWeaponExtraQuery = gql`
  query PlayerWeaponExtra(
    $whereDmg: v_player_weapon_damage_bool_exp!
    $whereKills: v_player_weapon_kills_bool_exp!
  ) {
    v_player_weapon_damage(where: $whereDmg) {
      with
      damage
    }
    v_player_weapon_kills(where: $whereKills) {
      with
      rounds
    }
  }
`;
