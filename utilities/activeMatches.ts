import type { ApolloClient } from "@apollo/client/core";
import { Kind, type DocumentNode } from "graphql";
import { schemaHasField } from "~/utilities/schemaHasType";

const ROOTS: Record<string, string> = {
  matches: "active_matches",
  matches_aggregate: "active_matches_aggregate",
};

// A subscription's status filter reaches Postgres as a value it only sees at
// run time, so reading matches scans every match ever played on every poll.
// active_matches holds just the matches not yet over (Live, Veto,
// WaitingForCheckIn, WaitingForServer, Scheduled, PickingPlayers), and any
// filter inside those statuses gets the same rows from it. The top-level
// matches field is read from there under its own name, so results arrive
// where they always did. Until the API serves it, the document is unchanged.
export async function fromActiveMatches(
  client: ApolloClient<any>,
  document: DocumentNode,
): Promise<DocumentNode> {
  if (!(await schemaHasField(client, "subscription_root", "active_matches"))) {
    return document;
  }
  return reroot(document, ROOTS);
}

// "My matches" from my_active_matches: the signed-in player's own active
// matches, found from their lineups rather than by checking every active
// match on the site for each player. Until the API serves it, as
// fromActiveMatches.
export async function fromMyActiveMatches(
  client: ApolloClient<any>,
  document: DocumentNode,
): Promise<DocumentNode> {
  if (
    !(await schemaHasField(client, "subscription_root", "my_active_matches"))
  ) {
    return fromActiveMatches(client, document);
  }
  return reroot(document, { matches: "my_active_matches" });
}

// The top-level fields named in roots, read from their new root under the key
// they had.
function reroot(
  document: DocumentNode,
  roots: Record<string, string>,
): DocumentNode {
  return {
    ...document,
    definitions: document.definitions.map((definition) =>
      definition.kind !== Kind.OPERATION_DEFINITION
        ? definition
        : {
            ...definition,
            selectionSet: {
              ...definition.selectionSet,
              selections: definition.selectionSet.selections.map((selection) =>
                selection.kind === Kind.FIELD && roots[selection.name.value]
                  ? {
                      ...selection,
                      alias: selection.alias ?? selection.name,
                      name: {
                        ...selection.name,
                        value: roots[selection.name.value],
                      },
                    }
                  : selection,
              ),
            },
          },
    ),
  };
}

// For subscriptions started synchronously: the handle can be dropped before
// the root is known, and then nothing is subscribed.
export function subscribeFromActiveMatches(
  client: ApolloClient<any>,
  document: DocumentNode,
  subscribe: (query: DocumentNode) => { unsubscribe: () => void },
): { unsubscribe: () => void } {
  let closed = false;
  let inner: { unsubscribe: () => void } | undefined;
  void fromActiveMatches(client, document).then((query) => {
    if (!closed) inner = subscribe(query);
  });
  return {
    unsubscribe() {
      closed = true;
      inner?.unsubscribe();
    },
  };
}
