// The per-node mutations the table menu, the inspector and its sections share.
import { generateMutation } from "~/graphql/graphqlGen";

type MutationClient = {
  mutate: (options: Record<string, any>) => Promise<any>;
};

export function setNodeFields(
  client: MutationClient,
  id: string,
  _set: Record<string, unknown>,
) {
  return client.mutate({
    mutation: generateMutation({
      update_game_server_nodes_by_pk: [
        { pk_columns: { id }, _set: _set as any },
        { __typename: true },
      ],
    }),
  });
}

// Installs or updates CS2, or CS:GO with game "csgo".
export function updateGame(client: MutationClient, id: string, game?: "csgo") {
  return client.mutate({
    mutation: generateMutation({
      updateCs: [
        game ? { game, game_server_node_id: id } : { game_server_node_id: id },
        { success: true },
      ],
    }),
  });
}

export function deleteNode(client: MutationClient, id: string) {
  return client.mutate({
    mutation: generateMutation({
      delete_game_server_nodes_by_pk: [{ id }, { __typename: true }],
    }),
  });
}

// Switching to GPU only drops the region and ports with matchmaking.
export function nodeModeFields(mode: "match" | "gpu") {
  return mode === "gpu"
    ? {
        enabled_for_match_making: false,
        region: null,
        start_port_range: null,
        end_port_range: null,
      }
    : { enabled_for_match_making: true };
}
