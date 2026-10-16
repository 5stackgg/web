import { ApolloLink, execute, type FetchResult } from "@apollo/client/core";
import { Observable, getMainDefinition } from "@apollo/client/utilities";
import { OperationTypeNode, type DocumentNode } from "graphql";

export type Seed = boolean | ((data: Record<string, any>) => boolean);

const queries = new WeakMap<DocumentNode, DocumentNode>();
const failingSockets = new WeakMap<DocumentNode, Set<string>>();

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

// Hasura sends a subscription's first payload on its next live-query poll, up
// to a second after the same selection would come back over HTTP. A
// subscription with `context: { seed }` sends both; the HTTP answer renders
// only while the socket has not answered, and is never applied after it, since
// Hasura would not resend an unchanged result to correct a stale one. A
// function `seed` vets the HTTP answer: a refused one is neither emitted nor
// remembered, so the socket's first payload always reaches the caller.
// A seeded answer also resets vue-apollo's restart budget, so a subscription
// whose socket is failing is not seeded again until the socket answers cleanly.
export function createSeedLink(httpLink: ApolloLink) {
  return new ApolloLink((operation, forward) => {
    const seed: Seed | undefined = operation.getContext().seed;
    const definition = getMainDefinition(operation.query);
    if (
      !seed ||
      definition.kind !== "OperationDefinition" ||
      definition.operation !== OperationTypeNode.SUBSCRIPTION
    ) {
      return forward(operation);
    }

    const failing = failingSockets.get(operation.query) ?? new Set<string>();
    failingSockets.set(operation.query, failing);
    const key = JSON.stringify(operation.variables ?? {});

    return new Observable<FetchResult>((observer) => {
      let live = false;
      let seeded: string | undefined;
      const seeding = !failing.has(key);

      const socket = forward(operation).subscribe({
        next: (result) => {
          if (result.errors?.length) {
            failing.add(key);
          } else {
            failing.delete(key);
          }
          const repeatsSeed =
            !live &&
            seeded !== undefined &&
            JSON.stringify(result.data) === seeded;
          live = true;
          if (!repeatsSeed) {
            observer.next(result);
          }
        },
        error: (error) => {
          failing.add(key);
          observer.error(error);
        },
        complete: () => observer.complete(),
      });

      if (!seeding) {
        return () => socket.unsubscribe();
      }

      const http = execute(httpLink, {
        query: asQuery(operation.query),
        variables: operation.variables,
        operationName: operation.operationName,
        context: operation.getContext(),
      }).subscribe({
        next: (result) => {
          if (live || !result.data || result.errors?.length) {
            return;
          }
          if (typeof seed === "function" && !seed(result.data)) {
            return;
          }
          seeded = JSON.stringify(result.data);
          observer.next(result);
        },
        error: () => {},
      });

      return () => {
        http.unsubscribe();
        socket.unsubscribe();
      };
    });
  });
}
