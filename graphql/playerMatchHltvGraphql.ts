import gql from "graphql-tag";

// Canonical per-match HLTV rating from the v_player_match_rating view. Raw
// document (not zeus) so it needs no generated/zeus regen for the new view.
export const playerMatchHltvQuery = gql`
  query PlayerMatchRating($steamId: bigint!, $matchIds: [uuid!]!) {
    v_player_match_rating(
      where: { steam_id: { _eq: $steamId }, match_id: { _in: $matchIds } }
    ) {
      match_id
      hltv_rating
    }
  }
`;
