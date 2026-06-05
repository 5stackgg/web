import gql from "graphql-tag";

// Per-(match map, player) combat roles + signals straight from the server view
// v_player_match_map_roles. Raw documents (not zeus) so they need no
// generated/zeus regen for the new view — the bool_exp / order_by names match
// what Hasura generates once the view + metadata are applied.

export const matchRolesQuery = gql`
  query MatchRoles($matchId: uuid!) {
    v_player_match_map_roles(where: { match_id: { _eq: $matchId } }) {
      match_map_id
      steam_id
      role
      rounds
      awp_share
      entry_rate
      support_idx
    }
  }
`;

// Carries the full per-map stat set so the role radar can aggregate every axis
// straight from the view (no kill/stat re-processing in the browser).
export const playerRolesQuery = gql`
  query PlayerRoles($steamId: bigint!, $where: matches_bool_exp!, $limit: Int!) {
    v_player_match_map_roles(
      where: { steam_id: { _eq: $steamId }, match: $where }
      order_by: { match: { started_at: desc_nulls_last } }
      limit: $limit
    ) {
      match_map_id
      role
      rounds
      kills
      deaths
      open_kills
      open_deaths
      opening_attempts
      trade_kill_successes
      traded_death_successes
      flash_assists
      util_damage
      hltv_rating
      adr
      kpr
      dpr
      kast_pct
      awp_share
      entry_rate
      support_idx
    }
  }
`;
