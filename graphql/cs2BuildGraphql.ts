import gql from "graphql-tag";

// Raw documents, like graphql/leagues.ts: the build-history columns and the
// optional action arguments are newer than the generated zeus client.
// Subscribe with CS2_BUILD_OPTIONAL so web shipping ahead of the api's
// metadata shows an empty card instead of an error toast.
export const CS2_BUILD_OPTIONAL = { optional: true };

const RUN_PEOPLE = `
  game_server_node {
    id
    label
  }
  requested_by {
    steam_id
    name
  }
`;

const GAMEDATA_RUN_SELECTION = `
  id
  build_id
  status
  started_at
  validated_at
  trigger
  previous_build_id
  changes
  ${RUN_PEOPLE}
`;

const MAP_ASSETS_RUN_SELECTION = `
  build_id
  status
  started_at
  finished_at
  created_at
  updated_at
  trigger
  previous_build_id
  changes
  failed
  failed_view
  ${RUN_PEOPLE}
`;

export const CS2_BUILD_GAMEDATA_SUBSCRIPTION = gql`
  subscription Cs2BuildGamedata($build_id: Int!) {
    gamedata_signature_validations(
      where: { build_id: { _eq: $build_id }, branch: { _eq: "public" } }
      limit: 1
    ) {
      ${GAMEDATA_RUN_SELECTION}
      results
    }
  }
`;

export const CS2_BUILD_MAP_ASSETS_SUBSCRIPTION = gql`
  subscription Cs2BuildMapAssets($build_id: String!) {
    map_asset_builds_by_pk(build_id: $build_id) {
      ${MAP_ASSETS_RUN_SELECTION}
      manifest
      maps
      error
    }
  }
`;

export const CS2_BUILD_GAMEDATA_HISTORY_SUBSCRIPTION = gql`
  subscription Cs2BuildGamedataHistory {
    gamedata_signature_validations(
      where: { branch: { _eq: "public" } }
      order_by: { build_id: desc }
      limit: 50
    ) {
      ${GAMEDATA_RUN_SELECTION}
    }
  }
`;

export const CS2_BUILD_MAP_ASSETS_HISTORY_SUBSCRIPTION = gql`
  subscription Cs2BuildMapAssetsHistory {
    map_asset_builds(order_by: { created_at: desc }, limit: 50) {
      ${MAP_ASSETS_RUN_SELECTION}
    }
  }
`;

export const CS2_BUILD_VERSIONS_SUBSCRIPTION = gql`
  subscription Cs2BuildVersions {
    game_versions(order_by: { build_id: desc }) {
      build_id
      version
      current
      updated_at
    }
  }
`;

export const CS2_BUILD_NODES_SUBSCRIPTION = gql`
  subscription Cs2BuildNodes {
    game_server_nodes(order_by: [{ label: asc }, { id: asc }]) {
      id
      label
      status
      enabled
      build_id
      update_status
      gpu
      enabled_for_match_making
      e_region {
        description
      }
    }
  }
`;

export const VALIDATE_GAMEDATA_MUTATION = gql`
  mutation ValidateGamedata($game_server_node_id: String) {
    validateGamedata(game_server_node_id: $game_server_node_id) {
      success
    }
  }
`;

export const BUILD_MAP_ASSETS_MUTATION = gql`
  mutation BuildMapAssets($game_server_node_id: String, $force: Boolean) {
    buildMapAssets(game_server_node_id: $game_server_node_id, force: $force) {
      success
    }
  }
`;
