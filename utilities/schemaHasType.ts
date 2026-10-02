import gql from "graphql-tag";
import type { ApolloClient } from "@apollo/client/core";

const SCHEMA_HAS_TYPE = gql`
  query SchemaHasType($name: String!) {
    __type(name: $name) {
      name
    }
  }
`;

const known = new Map<string, Promise<boolean>>();

// Whether the API serves a type yet. Asked through introspection so a view the
// web ships ahead of the API answers null instead of raising a GraphQL error,
// which the app would toast.
export function schemaHasType(
  client: ApolloClient<any>,
  name: string,
): Promise<boolean> {
  let answer = known.get(name);
  if (!answer) {
    answer = client
      .query({
        query: SCHEMA_HAS_TYPE,
        variables: { name },
        fetchPolicy: "cache-first",
      })
      .then(({ data }) => !!(data as any)?.__type)
      .catch(() => false);
    known.set(name, answer);
  }
  return answer;
}
