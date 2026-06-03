import gql from "graphql-tag";

// Per-match-map canonical HLTV rating + KAST for the Maps tab. Joined to the
// per-side stat aggregation client-side by match_map_id so the "Both" rating
// and the round-rating sparkline are exactly canonical (KAST-inclusive) and the
// CT/T splits inherit the map's KAST. Raw doc (not zeus) — no regen needed.
export const playerMapHltvQuery = gql`
  query PlayerMapHltv($steamId: bigint!, $where: matches_bool_exp!) {
    v_player_match_map_hltv(
      where: { steam_id: { _eq: $steamId }, match: $where }
    ) {
      match_map_id
      hltv_rating
      kast_pct
      rounds_played
    }
  }
`;
