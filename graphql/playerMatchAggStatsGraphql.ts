import gql from "graphql-tag";

// Focus player's per-match aggregate stats (all maps), batched across the
// visible page of matches. Replaces the per-row matches_by_pk fetch the
// collapsed match rows used to fire on mount — one request for the whole page
// instead of one per row. Keyed off the v_player_match_stats view (one row per
// steam_id + match_id).
export const playerMatchAggStatsQuery = gql`
  query PlayerMatchAggStats($steamId: bigint!, $matchIds: [uuid!]!) {
    player_match_stats_v(
      where: { steam_id: { _eq: $steamId }, match_id: { _in: $matchIds } }
    ) {
      match_id
      kills
      deaths
      assists
      damage
      rounds_played
    }
  }
`;
