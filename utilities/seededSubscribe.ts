import type { ApolloClient, FetchResult } from "@apollo/client/core";
import type { DocumentNode } from "graphql";
import type { Seed } from "~/graphql/seedLink";

export function seededSubscribe<T = any>(
  client: ApolloClient<any>,
  options: {
    query: DocumentNode;
    variables?: Record<string, unknown>;
    seed?: Seed;
  },
  observer: {
    next: (result: FetchResult<T>) => void;
    error?: (error: any) => void;
  },
) {
  return client
    .subscribe<T>({
      query: options.query,
      variables: options.variables,
      context: { seed: options.seed ?? true },
    })
    .subscribe(observer);
}
