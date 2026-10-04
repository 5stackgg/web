import type { ApolloClient, FetchResult } from "@apollo/client/core";
import { OperationTypeNode, type DocumentNode } from "graphql";

const queries = new WeakMap<DocumentNode, DocumentNode>();

function asQuery(subscription: DocumentNode): DocumentNode {
  let query = queries.get(subscription);
  if (!query) {
    query = {
      ...subscription,
      definitions: subscription.definitions.map((definition) =>
        definition.kind === "OperationDefinition"
          ? { ...definition, operation: OperationTypeNode.QUERY }
          : definition,
      ),
    };
    queries.set(subscription, query);
  }
  return query;
}

// A subscription's first payload waits on the socket handshake and Hasura's
// poll, which on a cold load lands well after the page has painted. The same
// selection as a plain query comes back in one HTTP round-trip, so both go out
// and whichever answers first renders; the subscription stays the live source.
export function seededSubscribe<T = any>(
  client: ApolloClient<any>,
  options: { query: DocumentNode; variables?: Record<string, unknown> },
  observer: {
    next: (result: FetchResult<T>) => void;
    error?: (error: any) => void;
  },
) {
  let live = false;
  const subscription = client.subscribe<T>(options).subscribe({
    next: (result) => {
      live = true;
      observer.next(result);
    },
    error: observer.error,
  });

  client
    .query<T>({
      query: asQuery(options.query),
      variables: options.variables,
      fetchPolicy: "no-cache",
      context: { optional: true },
    })
    .then(({ data }) => {
      if (data && !live && !subscription.closed) {
        observer.next({ data });
      }
    })
    .catch(() => {});

  return subscription;
}
