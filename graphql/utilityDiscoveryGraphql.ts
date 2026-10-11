import gql from "graphql-tag";

// Raw documents: lineup discovery is newer than the generated zeus client.
// Sent with UTILITY_DISCOVERY_OPTIONAL so a page running ahead of the api's
// metadata shows an empty panel instead of an error toast.
export const UTILITY_DISCOVERY_OPTIONAL = { optional: true };

const RESULT_FIELDS = `
  id
  rank
  technique
  move_direction
  move_gait
  jump_throw
  measured
  strength
  stand_x
  stand_y
  stand_z
  eye_z
  pitch
  yaw
  predicted_land_x
  predicted_land_y
  predicted_land_z
  predicted_distance
  predicted_spread
  predicted_bounces
  status
  land_x
  land_y
  land_z
  distance
  bounces
  flight_time_ms
  forgiveness
  grenades
  path
  is_new
  utility_lineup_id
`;

export const utilityDiscoverySubscription = gql`
  subscription UtilityDiscovery($id: uuid!) {
    utility_discoveries_by_pk(id: $id) {
      id
      map_name
      status
      predicted
      verified
      missed
      grenades
      error
      target_x
      target_y
      target_z
      radius
      area
      techniques
      strengths
      created_at
      started_at
      finished_at
      results(order_by: { rank: asc }) {
        ${RESULT_FIELDS}
      }
    }
  }
`;

export const myUtilityDiscoveriesSubscription = gql`
  subscription MyUtilityDiscoveries($map: String!, $steamId: bigint!) {
    utility_discoveries(
      where: {
        map_name: { _eq: $map }
        requested_by_steam_id: { _eq: $steamId }
      }
      order_by: { created_at: desc }
      limit: 6
    ) {
      id
      status
      predicted
      verified
      created_at
    }
  }
`;

export const discoverUtilityLineupsMutation = gql`
  mutation DiscoverUtilityLineups(
    $map_name: String!
    $target_x: Float!
    $target_y: Float!
    $target_z: Float!
    $radius: Float!
    $area: UtilityDiscoveryAreaInput!
    $techniques: [UtilityDiscoveryTechniqueInput!]!
    $strengths: [String!]
  ) {
    discoverUtilityLineups(
      map_name: $map_name
      target_x: $target_x
      target_y: $target_y
      target_z: $target_z
      radius: $radius
      area: $area
      techniques: $techniques
      strengths: $strengths
    ) {
      discovery_id
      status
      predicted
      message
    }
  }
`;

export const cancelUtilityDiscoveryMutation = gql`
  mutation CancelUtilityDiscovery($discovery_id: uuid!) {
    cancelUtilityDiscovery(discovery_id: $discovery_id) {
      success
    }
  }
`;

export const saveUtilityDiscoveryResultMutation = gql`
  mutation SaveUtilityDiscoveryResult(
    $result_id: uuid!
    $name: String!
    $side: String!
  ) {
    saveUtilityDiscoveryResult(result_id: $result_id, name: $name, side: $side) {
      lineup_id
    }
  }
`;

export const previewUtilitySmokeQuery = gql`
  query PreviewUtilitySmoke(
    $map_name: String!
    $x: Float!
    $y: Float!
    $z: Float!
  ) {
    previewUtilitySmoke(map_name: $map_name, x: $x, y: $y, z: $z) {
      x
      y
      z
      ox
      oy
      oz
      vs
      dx
      dy
      dz
      den
    }
  }
`;
