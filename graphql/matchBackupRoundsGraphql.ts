import gql from "graphql-tag";

// Restorable rounds for the admin restore-round UI. Reads the dedicated
// v_match_map_backup_rounds view (round + backup availability only) so it keeps
// working while match_map_rounds itself is gated to finished maps. Raw doc (not
// zeus) so the new view needs no generated/zeus regen.
export const matchBackupRoundsSubscription = gql`
  subscription MatchBackupRounds($matchMapId: uuid!) {
    v_match_map_backup_rounds(
      where: { match_map_id: { _eq: $matchMapId } }
      order_by: { round: asc }
    ) {
      round
      has_backup_file
    }
  }
`;
