// The per-node mutations the table menu, the inspector and its sections share.
import gql from "graphql-tag";
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

// Raw gql: removeCs is newer than the generated zeus types.
export function removeGame(
  client: MutationClient,
  id: string,
  game: "cs2" | "csgo",
) {
  return client.mutate({
    mutation: gql`
      mutation RemoveCs($game_server_node_id: String!, $game: String!) {
        removeCs(game_server_node_id: $game_server_node_id, game: $game) {
          success
        }
      }
    `,
    variables: { game_server_node_id: id, game },
  });
}

export function deleteNode(client: MutationClient, id: string) {
  return client.mutate({
    mutation: generateMutation({
      delete_game_server_nodes_by_pk: [{ id }, { __typename: true }],
    }),
  });
}
