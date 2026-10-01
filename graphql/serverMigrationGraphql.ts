import gql from "graphql-tag";

// Raw documents: server_migrations and available_dedicated_slot_count are newer
// than the generated zeus client. Subscribe with SERVER_MIGRATION_OPTIONAL so
// web shipping ahead of the api's metadata hides the move instead of erroring.
export const SERVER_MIGRATION_OPTIONAL = { optional: true };

export const SERVER_MIGRATION_SUBSCRIPTION = gql`
  subscription ServerMigration($server_id: uuid!) {
    servers_by_pk(id: $server_id) {
      id
      game
      region
      plugin_runtime
      game_server_node_id
      game_server_node {
        id
        label
        status
        node_ip
        offline_at
        pin_plugin_runtime
      }
      migrations(order_by: { created_at: desc }, limit: 1) {
        id
        status
        with_files
        bytes_total
        bytes_done
        error
        warnings
        created_at
        started_at
        finished_at
        from_game_server_node {
          id
          label
        }
        to_game_server_node {
          id
          label
        }
      }
    }
  }
`;

export const SERVER_MOVE_NODES_SUBSCRIPTION = gql`
  subscription ServerMoveNodes {
    game_server_nodes(order_by: [{ label: asc }, { id: asc }]) {
      id
      label
      status
      node_ip
      enabled
      build_id
      csgo_build_id
      update_status
      region
      e_region {
        description
      }
      disk_available_gb
      available_dedicated_slot_count
      pin_plugin_runtime
    }
  }
`;

export const MOVE_DEDICATED_SERVER_MUTATION = gql`
  mutation MoveDedicatedServerToNode(
    $server_id: uuid!
    $game_server_node_id: String!
    $without_files: Boolean
  ) {
    moveDedicatedServerToNode(
      server_id: $server_id
      game_server_node_id: $game_server_node_id
      without_files: $without_files
    ) {
      success
    }
  }
`;

export const CANCEL_DEDICATED_SERVER_MOVE_MUTATION = gql`
  mutation CancelDedicatedServerMove($server_id: uuid!) {
    cancelDedicatedServerMove(server_id: $server_id) {
      success
    }
  }
`;
