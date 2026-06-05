import gql from "graphql-tag";

// Career opening-duels + clutches for the player's most recent matches. The
// per-round detection now lives in the backend views (v_match_player_opening_
// duels, v_match_clutches), nested here scoped to this player; we only keep a
// rounds count per map so the client can window to the last N *played* maps.
// Raw gql (not Zeus) so it works without regenerating types for the new views.
export const playerCareerCombatQuery = gql`
  query PlayerCareerCombat(
    $steamId: bigint!
    $matchesWhere: matches_bool_exp!
    $limit: Int!
  ) {
    players_by_pk(steam_id: $steamId) {
      steam_id
      matches(
        where: $matchesWhere
        limit: $limit
        order_by: [{ started_at: desc_nulls_last }, { created_at: desc }]
      ) {
        id
        match_maps(order_by: { order: asc }) {
          id
          winning_lineup_id
          map {
            id
            name
            label
          }
          rounds_aggregate {
            aggregate {
              count
            }
          }
        }
        clutches(where: { clutcher_steam_id: { _eq: $steamId } }) {
          match_map_id
          against_count
          outcome
        }
        opening_duels(where: { steam_id: { _eq: $steamId } }) {
          match_map_id
          attempts
          wins
          deaths
          traded_deaths
        }
      }
    }
  }
`;
